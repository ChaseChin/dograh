"""Tencent Cloud realtime ASR (websocket) STT service.

Implements the Tencent Cloud 实时语音识别 streaming protocol:
``wss://asr.cloud.tencent.com/asr/v2/{app_id}`` with HMAC-SHA1 request
signing. Lives on the api side (not the pipecat submodule) because it is only
used through Dograh's service factory — same pattern as ``minimax_tts.py``.

Protocol summary:
- Client connects with a signed URL, server replies a handshake JSON
  (``code == 0``, no ``result`` field).
- Client streams raw PCM (16-bit little-endian mono) as binary frames.
- Server VAD (``needvad=1``) segments speech: each result carries a
  ``slice_type`` — 0 (slice start) and 1 (interim) map to
  InterimTranscriptionFrame, 2 (slice end, a stable sentence) maps to
  TranscriptionFrame.
- Client sends ``{"type": "end"}`` to flush, server answers with ``final=1``
  and closes.
"""

import base64
import hashlib
import hmac
import json
import random
import time
import uuid
from collections.abc import AsyncGenerator
from urllib.parse import urlencode

import websockets
from loguru import logger
from pipecat.audio.utils import create_stream_resampler
from pipecat.frames.frames import (
    Frame,
    InterimTranscriptionFrame,
    TranscriptionFrame,
)
from pipecat.processors.frame_processor import FrameProcessorSetup
from pipecat.services.settings import STTSettings
from pipecat.services.stt_service import WebsocketSTTService
from pipecat.utils.time import time_now_iso8601
from websockets.protocol import State

TENCENT_ASR_HOST = "asr.cloud.tencent.com"
TENCENT_ASR_PATH = "/asr/v2/{app_id}"

# voice_format=1: raw PCM, 16-bit little-endian mono.
TENCENT_VOICE_FORMAT_PCM = 1


def build_tencent_asr_url(
    *,
    app_id: str,
    secret_id: str,
    secret_key: str,
    engine_model_type: str,
    voice_id: str,
    timestamp: int,
    expired: int,
    nonce: int,
    needvad: int = 1,
    vad_silence_time: int | None = None,
) -> str:
    """Build the signed Tencent ASR websocket URL.

    The signature is base64(HMAC-SHA1(secret_key, sign_str)) where sign_str is
    ``host + path + "?" + sorted_params`` over every parameter except the
    signature itself. Values in sign_str are not URL-encoded; the signature
    is URL-encoded only when appended to the final query.
    """
    params = {
        "engine_model_type": engine_model_type,
        "expired": expired,
        "needvad": needvad,
        "nonce": nonce,
        "secretid": secret_id,
        "timestamp": timestamp,
        "voice_format": TENCENT_VOICE_FORMAT_PCM,
        "voice_id": voice_id,
    }
    if vad_silence_time is not None:
        params["vad_silence_time"] = vad_silence_time

    path = TENCENT_ASR_PATH.format(app_id=app_id)
    sign_str = f"{TENCENT_ASR_HOST}{path}?" + "&".join(
        f"{key}={params[key]}" for key in sorted(params)
    )
    signature = base64.b64encode(
        hmac.new(
            secret_key.encode("utf-8"), sign_str.encode("utf-8"), hashlib.sha1
        ).digest()
    ).decode("utf-8")

    query = urlencode({**params, "signature": signature})
    return f"wss://{TENCENT_ASR_HOST}{path}?{query}"


def tencent_engine_sample_rate(engine_model_type: str) -> int:
    """Return the PCM sample rate a Tencent engine model expects."""
    return 8000 if engine_model_type.startswith("8k") else 16000


class TencentASRSTTService(WebsocketSTTService):
    """Streams call audio to Tencent Cloud realtime ASR over websocket."""

    def __init__(
        self,
        *,
        secret_id: str,
        secret_key: str,
        app_id: str,
        engine_model_type: str = "8k_zh",
        language: str = "zh-CN",
        vad_silence_time: int | None = None,
        signature_ttl_seconds: int = 24 * 3600,
        **kwargs,
    ):
        """Initialize the Tencent Cloud realtime ASR service.

        Args:
            secret_id: Tencent Cloud CAM SecretId.
            secret_key: Tencent Cloud CAM SecretKey, used only to sign locally.
            app_id: Tencent Cloud account APPID (part of the websocket path).
            engine_model_type: Engine model, e.g. ``8k_zh`` for telephony.
            language: BCP-47 tag attached to emitted transcription frames.
            vad_silence_time: Optional server-side VAD silence timeout in ms.
            signature_ttl_seconds: How long the signed URL stays valid.
            **kwargs: Passed to WebsocketSTTService (sample_rate, etc.).
        """
        # Newer pipecat requires fully-initialized settings at construction.
        super().__init__(
            settings=STTSettings(model=engine_model_type, language=language),
            **kwargs,
        )
        self._secret_id = secret_id
        self._secret_key = secret_key
        self._app_id = app_id
        self._engine_model_type = engine_model_type
        self._language = language
        self._vad_silence_time = vad_silence_time
        self._signature_ttl_seconds = signature_ttl_seconds

        self._engine_sample_rate = tencent_engine_sample_rate(engine_model_type)
        self._resampler = create_stream_resampler()
        self._receive_task = None
        self._connection_active = False

    def can_generate_metrics(self) -> bool:
        """Whether this service reports processing metrics.

        The base class defaults to False; without this override the
        STT TTFB (speech end → final transcript) is never reported.
        """
        return True

    async def setup(self, setup: FrameProcessorSetup):
        """Set up the service and open the websocket.

        The pipecat base classes never call ``_connect()`` themselves; without
        this the connection stays down and run_stt drops every audio frame.
        """
        await super().setup(setup)
        await self._connect()

    async def run_stt(self, audio: bytes) -> AsyncGenerator[Frame | None, None]:
        """Send audio to Tencent ASR; results arrive on the receive task.

        Args:
            audio: PCM audio at the pipeline's input sample rate. Resampled to
                the engine model's rate when the two differ.

        Yields:
            None (transcriptions are pushed asynchronously).
        """
        if (
            not self._connection_active
            or not self._websocket
            or self._websocket.state is not State.OPEN
        ):
            # Lazy (re)connect, e.g. after a dropped connection.
            await self._connect()

        if self.sample_rate and self.sample_rate != self._engine_sample_rate:
            audio = await self._resampler.resample(
                audio, self.sample_rate, self._engine_sample_rate
            )

        if (
            self._connection_active
            and self._websocket
            and self._websocket.state is State.OPEN
        ):
            try:
                await self._websocket.send(audio)
            except websockets.exceptions.ConnectionClosed as e:
                logger.warning(f"{self} Websocket closed while sending audio: {e}")
                self._connection_active = False

        yield None

    async def _connect(self):
        """Connect to Tencent ASR and start the receive task."""
        await self._connect_websocket()
        await super()._connect()
        if self._websocket and not self._receive_task:
            self._receive_task = self.create_task(
                self._receive_task_handler(self._report_error)
            )

    async def _disconnect(self):
        """Disconnect from Tencent ASR and stop the receive task."""
        await super()._disconnect()
        self._connection_active = False
        if self._receive_task:
            await self.cancel_task(self._receive_task)
            self._receive_task = None
        await self._disconnect_websocket()

    async def _connect_websocket(self):
        """Open the signed websocket and consume the handshake response."""
        try:
            if self._websocket and self._websocket.state is State.OPEN:
                return

            now = int(time.time())
            url = build_tencent_asr_url(
                app_id=self._app_id,
                secret_id=self._secret_id,
                secret_key=self._secret_key,
                engine_model_type=self._engine_model_type,
                voice_id=uuid.uuid4().hex[:16],
                timestamp=now,
                expired=now + self._signature_ttl_seconds,
                nonce=random.randint(1, 2**31 - 1),
                vad_silence_time=self._vad_silence_time,
            )
            self._websocket = await self._websocket_connect(url)

            # First message is the handshake ack: {"code": 0, ...} with no result.
            handshake = json.loads(await self._websocket.recv())
            if handshake.get("code") != 0:
                raise RuntimeError(
                    f"Tencent ASR handshake rejected: {handshake.get('code')} "
                    f"{handshake.get('message')}"
                )

            self._connection_active = True
            await self._call_event_handler("on_connected")
            logger.debug(f"{self} Connected to Tencent ASR websocket")
        except Exception as e:
            self._websocket = None
            self._connection_active = False
            await self.push_error(
                error_msg=f"Unable to connect to Tencent ASR: {e}", exception=e
            )

    async def _disconnect_websocket(self):
        """Flush pending results and close the websocket."""
        try:
            if self._websocket and self._websocket.state is State.OPEN:
                try:
                    await self._websocket.send(json.dumps({"type": "end"}))
                except Exception as e:
                    logger.warning(f"{self} Failed to send end message: {e}")
                await self._websocket.close()
        except Exception as e:
            await self.push_error(
                error_msg=f"Error closing Tencent ASR websocket: {e}", exception=e
            )
        finally:
            self._websocket = None
            await self._call_event_handler("on_disconnected")

    def _get_websocket(self):
        if self._websocket:
            return self._websocket
        raise Exception("Tencent ASR websocket not connected")

    async def _receive_messages(self):
        """Translate Tencent result messages into transcription frames."""
        async for message in self._get_websocket():
            try:
                content = json.loads(message)
            except json.JSONDecodeError:
                logger.warning(f"{self} Received non-JSON message: {message}")
                continue

            code = content.get("code", 0)
            if code != 0:
                await self.push_error(
                    error_msg=(
                        f"Tencent ASR error {code}: {content.get('message')}"
                    )
                )
                continue

            result = content.get("result")
            if not result:
                # Handshake ack and final session ack carry no result field.
                continue

            text = result.get("voice_text_str", "")
            if not text:
                continue

            logger.debug(
                f"{self} Tencent ASR slice_type={result.get('slice_type')} "
                f"text={text!r}"
            )
            # slice_type: 0 = slice start, 1 = interim, 2 = slice end (final).
            if result.get("slice_type") == 2:
                # Report usage before the transcription frame so tracing can
                # attach it to the STT span the frame closes.
                await self.emit_stt_usage_metrics()
                await self.push_frame(
                    TranscriptionFrame(
                        text,
                        self._user_id,
                        time_now_iso8601(),
                        self._language,
                        result=content,
                        # slice end == final for this utterance; finalized=True
                        # also makes the STT TTFB metric report immediately
                        # (push_frame) instead of via the 2s timeout path.
                        finalized=True,
                    )
                )
            else:
                await self.push_frame(
                    InterimTranscriptionFrame(
                        text,
                        self._user_id,
                        time_now_iso8601(),
                        self._language,
                        result=content,
                    )
                )
