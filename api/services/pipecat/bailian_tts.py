"""Alibaba Cloud Bailian (DashScope) CosyVoice streaming TTS.

Implements the DashScope native websocket protocol
(``wss://dashscope.aliyuncs.com/api-ws/v1/inference``) used by the
SpeechSynthesizer function (cosyvoice / sambert models). Lives on the api
side (not the pipecat submodule) — same pattern as ``tencent_asr.py``.

Protocol summary (duplex streaming):

- Client connects with an ``Authorization: Bearer <key>`` header.
- One synthesis task per sentence: ``run-task`` (model + voice + pcm format)
  → server ``task-started`` → ``continue-task`` (text) → ``finish-task`` →
  binary PCM audio frames → server ``task-finished`` (or ``task-failed``).
- A fresh websocket is opened per task. DashScope tasks are single-shot, and
  an interrupted task leaves the connection unusable; per-task connections
  keep interruption handling trivial at a small handshake cost.
"""

import asyncio
import json
import uuid
from collections.abc import AsyncGenerator

import websockets
from loguru import logger
from pipecat.frames.frames import ErrorFrame, Frame, TTSAudioRawFrame
from pipecat.services.settings import TTSSettings
from pipecat.services.tts_service import TTSService
from pipecat.utils.tracing.service_decorators import traced_tts

BAILIAN_TTS_DEFAULT_WS_URL = "wss://dashscope.aliyuncs.com/api-ws/v1/inference"


def build_run_task_message(
    *,
    task_id: str,
    model: str,
    voice: str,
    sample_rate: int,
    volume: int = 50,
    rate: float = 1.0,
    pitch: float = 1.0,
) -> str:
    """Build the DashScope ``run-task`` command that opens a synthesis task."""
    return json.dumps(
        {
            "header": {
                "action": "run-task",
                "task_id": task_id,
                "streaming": "duplex",
            },
            "payload": {
                "task_group": "audio",
                "task": "tts",
                "function": "SpeechSynthesizer",
                "model": model,
                "parameters": {
                    "text_type": "Plain",
                    "voice": voice,
                    "format": "pcm",
                    "sample_rate": sample_rate,
                    "volume": volume,
                    "rate": rate,
                    "pitch": pitch,
                },
                "input": {},
            },
        }
    )


def build_continue_task_message(*, task_id: str, text: str) -> str:
    """Build the ``continue-task`` command carrying one text fragment."""
    return json.dumps(
        {
            "header": {
                "action": "continue-task",
                "task_id": task_id,
                "streaming": "duplex",
            },
            "payload": {"input": {"text": text}},
        }
    )


def build_finish_task_message(*, task_id: str) -> str:
    """Build the ``finish-task`` command that closes the task's text input."""
    return json.dumps(
        {
            "header": {
                "action": "finish-task",
                "task_id": task_id,
                "streaming": "duplex",
            },
            "payload": {"input": {}},
        }
    )


def _event_of(message: str) -> tuple[str, dict]:
    """Return (event, header) for a JSON control message."""
    header = json.loads(message).get("header", {})
    return header.get("event", ""), header


class BailianTTSService(TTSService):
    """Streams synthesized speech from Bailian CosyVoice over websocket."""

    def __init__(
        self,
        *,
        api_key: str,
        model: str = "cosyvoice-v2",
        voice: str = "longxiaochun_v2",
        base_url: str = BAILIAN_TTS_DEFAULT_WS_URL,
        volume: int = 50,
        rate: float = 1.0,
        pitch: float = 1.0,
        task_started_timeout: float = 10.0,
        **kwargs,
    ):
        """Initialize the Bailian CosyVoice TTS service.

        Args:
            api_key: DashScope (Bailian) API key.
            model: TTS model, e.g. ``cosyvoice-v2``.
            voice: Voice id, e.g. ``longxiaochun_v2``. cosyvoice-v2 voices
                carry a ``_v2`` suffix; cosyvoice-v1 voices do not.
            base_url: DashScope websocket inference endpoint.
            volume: Output volume, 0-100.
            rate: Speech rate multiplier, 0.5-2.
            pitch: Pitch multiplier, 0.5-2.
            task_started_timeout: Seconds to wait for the ``task-started``
                event before giving up.
            **kwargs: Passed to TTSService (sample_rate, text_filters, etc.).
        """
        super().__init__(
            settings=TTSSettings(model=model, voice=voice, language=None),
            **kwargs,
        )
        self._api_key = api_key
        self._model = model
        self._voice = voice
        self._base_url = base_url
        self._volume = volume
        self._rate = rate
        self._pitch = pitch
        self._task_started_timeout = task_started_timeout

    def can_generate_metrics(self) -> bool:
        """Whether this service reports processing metrics.

        The base class defaults to False; without this override the
        TTS TTFB (synthesis request → first audio byte) is never reported.
        """
        return True

    async def _wait_task_started(self, ws, task_id: str) -> str | None:
        """Wait for the task-started event; return an error message on failure."""
        async def _wait() -> str | None:
            async for message in ws:
                if isinstance(message, (bytes, bytearray)):
                    # No audio is expected before task-started; drop it.
                    continue
                event, header = _event_of(message)
                if event == "task-started":
                    return None
                if event == "task-failed":
                    return (
                        f"{header.get('error_code')} "
                        f"{header.get('error_message')}"
                    )
            return "connection closed before task-started"

        try:
            return await asyncio.wait_for(_wait(), timeout=self._task_started_timeout)
        except asyncio.TimeoutError:
            return f"timed out waiting for task-started ({self._task_started_timeout}s)"

    @traced_tts
    async def run_tts(self, text: str, context_id: str) -> AsyncGenerator[Frame, None]:
        """Synthesize one text fragment; yields audio frames as they arrive.

        Args:
            text: The sentence to synthesize (aggregated upstream).
            context_id: pipecat context id for frame correlation.

        Yields:
            TTSAudioRawFrame for each binary audio message, ErrorFrame on
            protocol or connection failures.
        """
        task_id = uuid.uuid4().hex
        # The base class only starts TTFB metrics itself when push_start_frame
        # is set, so start them here like the other streaming TTS services.
        await self.start_ttfb_metrics()
        try:
            async with websockets.connect(
                self._base_url,
                additional_headers={"Authorization": f"Bearer {self._api_key}"},
            ) as ws:
                await ws.send(
                    build_run_task_message(
                        task_id=task_id,
                        model=self._model,
                        voice=self._voice,
                        sample_rate=self.sample_rate,
                        volume=self._volume,
                        rate=self._rate,
                        pitch=self._pitch,
                    )
                )
                await self.start_tts_usage_metrics(text)

                error = await self._wait_task_started(ws, task_id)
                if error:
                    logger.error(f"{self} Bailian TTS task failed to start: {error}")
                    yield ErrorFrame(error=f"Bailian TTS error: {error}")
                    return

                await ws.send(build_continue_task_message(task_id=task_id, text=text))
                await ws.send(build_finish_task_message(task_id=task_id))

                async for message in ws:
                    if isinstance(message, (bytes, bytearray)):
                        await self.stop_ttfb_metrics()
                        yield TTSAudioRawFrame(
                            audio=bytes(message),
                            sample_rate=self.sample_rate,
                            num_channels=1,
                            context_id=context_id,
                        )
                        continue

                    event, header = _event_of(message)
                    if event == "task-finished":
                        break
                    if event == "task-failed":
                        error_msg = (
                            f"Bailian TTS error: {header.get('error_code')} "
                            f"{header.get('error_message')}"
                        )
                        logger.error(f"{self} {error_msg}")
                        yield ErrorFrame(error=error_msg)
                        return
                    # result-generated events carry no payload we need.
        except Exception as e:
            logger.error(f"{self} Bailian TTS connection error: {e}")
            yield ErrorFrame(error=f"Bailian TTS error: {e}", exception=e)
        finally:
            await self.stop_ttfb_metrics()
