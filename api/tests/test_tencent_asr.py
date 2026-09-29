"""Unit tests for the Tencent Cloud realtime ASR STT service.

Covers the HMAC-SHA1 signed websocket URL construction, engine sample-rate
derivation, service factory wiring, and the translation of Tencent result
messages into pipecat transcription frames. No real credentials or network
access required.
"""

import base64
import hashlib
import hmac
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from urllib.parse import parse_qs, urlparse

from pipecat.frames.frames import InterimTranscriptionFrame, TranscriptionFrame
from websockets.protocol import State

from api.services.configuration.options import TENCENT_STT_MODELS
from api.services.configuration.registry import (
    ServiceProviders,
    TencentSTTConfiguration,
)
from api.services.pipecat.audio_config import AudioConfig
from api.services.pipecat.service_factory import create_stt_service
from api.services.pipecat.tencent_asr import (
    TencentASRSTTService,
    build_tencent_asr_url,
    tencent_engine_sample_rate,
)

SECRET_ID = "AKIDexampleSecretId"
SECRET_KEY = "exampleSecretKey"
APP_ID = "1300000000"

FIXED_URL_KWARGS = dict(
    app_id=APP_ID,
    secret_id=SECRET_ID,
    secret_key=SECRET_KEY,
    engine_model_type="8k_zh",
    voice_id="0123456789abcdef",
    timestamp=1700000000,
    expired=1700086400,
    nonce=42,
)


def _expected_signature(params: dict) -> str:
    """Recompute the expected signature the way Tencent documents it."""
    sign_str = "asr.cloud.tencent.com/asr/v2/1300000000?" + "&".join(
        f"{key}={params[key]}" for key in sorted(params)
    )
    return base64.b64encode(
        hmac.new(SECRET_KEY.encode("utf-8"), sign_str.encode("utf-8"), hashlib.sha1).digest()
    ).decode("utf-8")


class _FakeWebsocket:
    """Async-iterable websocket stub that replays canned messages."""

    def __init__(self, messages=()):
        self._messages = list(messages)
        self.state = State.OPEN
        self.send = AsyncMock()
        self.close = AsyncMock()

    def __aiter__(self):
        return self._iterate()

    async def _iterate(self):
        for message in self._messages:
            yield message


def _make_service(**overrides) -> TencentASRSTTService:
    kwargs = dict(
        secret_id=SECRET_ID,
        secret_key=SECRET_KEY,
        app_id=APP_ID,
        engine_model_type="8k_zh",
        sample_rate=8000,
    )
    kwargs.update(overrides)
    return TencentASRSTTService(**kwargs)


# ---------------------------------------------------------------------------
# Configuration registry
# ---------------------------------------------------------------------------


def test_tencent_stt_configuration_defaults():
    config = TencentSTTConfiguration(
        tencent_secret_id=SECRET_ID,
        tencent_secret_key=SECRET_KEY,
        tencent_app_id=APP_ID,
    )

    assert config.provider == ServiceProviders.TENCENT
    assert config.model == "8k_zh"
    assert config.api_key is None

    model_schema = TencentSTTConfiguration.model_json_schema()["properties"]["model"]
    assert list(model_schema["examples"]) == list(TENCENT_STT_MODELS)
    assert model_schema["allow_custom_input"] is True


def test_tencent_engine_sample_rate():
    assert tencent_engine_sample_rate("8k_zh") == 8000
    assert tencent_engine_sample_rate("16k_zh") == 16000


# ---------------------------------------------------------------------------
# Signed URL construction
# ---------------------------------------------------------------------------


def test_build_tencent_asr_url_produces_valid_signature():
    url = build_tencent_asr_url(**FIXED_URL_KWARGS)

    parsed = urlparse(url)
    assert parsed.scheme == "wss"
    assert parsed.netloc == "asr.cloud.tencent.com"
    assert parsed.path == f"/asr/v2/{APP_ID}"

    query = parse_qs(parsed.query)
    assert query["secretid"] == [SECRET_ID]
    assert query["engine_model_type"] == ["8k_zh"]
    assert query["voice_format"] == ["1"]
    assert query["needvad"] == ["1"]
    assert query["timestamp"] == ["1700000000"]
    assert query["expired"] == ["1700086400"]
    assert query["nonce"] == ["42"]
    assert query["voice_id"] == ["0123456789abcdef"]
    assert "vad_silence_time" not in query

    expected_params = {
        "engine_model_type": "8k_zh",
        "expired": 1700086400,
        "needvad": 1,
        "nonce": 42,
        "secretid": SECRET_ID,
        "timestamp": 1700000000,
        "voice_format": 1,
        "voice_id": "0123456789abcdef",
    }
    assert query["signature"] == [_expected_signature(expected_params)]


def test_build_tencent_asr_url_is_deterministic_for_fixed_inputs():
    assert build_tencent_asr_url(**FIXED_URL_KWARGS) == build_tencent_asr_url(
        **FIXED_URL_KWARGS
    )


def test_build_tencent_asr_url_includes_vad_silence_time_when_set():
    url = build_tencent_asr_url(**FIXED_URL_KWARGS, vad_silence_time=800)

    query = parse_qs(urlparse(url).query)
    assert query["vad_silence_time"] == ["800"]

    expected_params = {
        "engine_model_type": "8k_zh",
        "expired": 1700086400,
        "needvad": 1,
        "nonce": 42,
        "secretid": SECRET_ID,
        "timestamp": 1700000000,
        "vad_silence_time": 800,
        "voice_format": 1,
        "voice_id": "0123456789abcdef",
    }
    assert query["signature"] == [_expected_signature(expected_params)]


# ---------------------------------------------------------------------------
# Service factory wiring
# ---------------------------------------------------------------------------


def test_create_stt_service_wires_tencent_credentials():
    user_config = SimpleNamespace(
        stt=SimpleNamespace(
            provider=ServiceProviders.TENCENT.value,
            model="8k_zh",
            tencent_secret_id=SECRET_ID,
            tencent_secret_key=SECRET_KEY,
            tencent_app_id=APP_ID,
        )
    )
    audio_config = AudioConfig(
        transport_in_sample_rate=8000,
        transport_out_sample_rate=8000,
    )

    with patch(
        "api.services.pipecat.service_factory.TencentASRSTTService"
    ) as tencent_service:
        create_stt_service(user_config, audio_config)

    tencent_service.assert_called_once()
    kwargs = tencent_service.call_args.kwargs
    assert kwargs["secret_id"] == SECRET_ID
    assert kwargs["secret_key"] == SECRET_KEY
    assert kwargs["app_id"] == APP_ID
    assert kwargs["engine_model_type"] == "8k_zh"
    assert kwargs["sample_rate"] == 8000
    assert kwargs["should_interrupt"] is False


# ---------------------------------------------------------------------------
# Connection lifecycle
# ---------------------------------------------------------------------------


async def test_setup_opens_connection():
    """setup() must open the websocket; the base classes never connect by
    themselves, so without this every audio frame would be dropped."""
    from pipecat.services.stt_service import WebsocketSTTService

    service = _make_service()
    service._connect = AsyncMock()

    with patch.object(WebsocketSTTService, "setup", new=AsyncMock()):
        await service.setup(SimpleNamespace())

    service._connect.assert_awaited_once()


# ---------------------------------------------------------------------------
# Audio sending (run_stt)
# ---------------------------------------------------------------------------


async def test_run_stt_sends_audio_without_resample_at_engine_rate():
    service = _make_service(sample_rate=8000)
    # STTService.setup() normally copies _init_sample_rate into _sample_rate.
    service._sample_rate = 8000
    service._websocket = _FakeWebsocket()
    service._connection_active = True

    audio = b"\x01\x02" * 200
    async for _ in service.run_stt(audio):
        pass

    service._websocket.send.assert_awaited_once_with(audio)


async def test_run_stt_resamples_when_pipeline_rate_differs():
    service = _make_service(sample_rate=16000)  # engine 8k_zh expects 8000
    service._sample_rate = 16000
    service._websocket = _FakeWebsocket()
    service._connection_active = True
    service._resampler.resample = AsyncMock(return_value=b"resampled")

    async for _ in service.run_stt(b"\x00\x01" * 400):
        pass

    service._resampler.resample.assert_awaited_once()
    service._websocket.send.assert_awaited_once_with(b"resampled")


async def test_run_stt_reconnects_and_skips_send_when_connect_fails():
    """run_stt lazily reconnects; audio is dropped if reconnect didn't help."""
    service = _make_service()
    service._sample_rate = 8000
    service._websocket = _FakeWebsocket()
    service._connection_active = False
    service._connect = AsyncMock()  # reconnect does not restore the connection

    async for _ in service.run_stt(b"\x01\x02" * 100):
        pass

    service._connect.assert_awaited_once()
    service._websocket.send.assert_not_awaited()


async def test_run_stt_lazy_connect_then_sends():
    """run_stt connects on first audio when setup() never ran."""
    service = _make_service()
    service._sample_rate = 8000
    service._connection_active = False
    service._websocket = None

    async def fake_connect():
        service._websocket = _FakeWebsocket()
        service._connection_active = True

    service._connect = AsyncMock(side_effect=fake_connect)

    audio = b"\x01\x02" * 100
    async for _ in service.run_stt(audio):
        pass

    service._connect.assert_awaited_once()
    service._websocket.send.assert_awaited_once_with(audio)


# ---------------------------------------------------------------------------
# Result message -> pipecat frame mapping
# ---------------------------------------------------------------------------


def _result_message(text: str, slice_type: int) -> str:
    return json.dumps(
        {
            "code": 0,
            "voice_id": "0123456789abcdef",
            "result": {
                "slice_type": slice_type,
                "voice_text_str": text,
            },
        }
    )


async def test_receive_messages_emits_transcription_frame_for_final_result():
    service = _make_service()
    service._websocket = _FakeWebsocket([_result_message("你好世界", 2)])
    service.push_frame = AsyncMock()
    service.push_error = AsyncMock()
    service.emit_stt_usage_metrics = AsyncMock()

    await service._receive_messages()

    service.emit_stt_usage_metrics.assert_awaited_once()
    service.push_frame.assert_awaited_once()
    frame = service.push_frame.await_args.args[0]
    assert isinstance(frame, TranscriptionFrame)
    assert not isinstance(frame, InterimTranscriptionFrame)
    assert frame.text == "你好世界"
    assert frame.language == "zh-CN"
    # slice end == final; finalized=True makes the STT TTFB metric report
    # immediately instead of via the 2s timeout path.
    assert frame.finalized is True
    assert frame.result["result"]["voice_text_str"] == "你好世界"
    service.push_error.assert_not_awaited()


async def test_receive_messages_emits_interim_frame_for_interim_result():
    service = _make_service()
    service._websocket = _FakeWebsocket([_result_message("你好", 0)])
    service.push_frame = AsyncMock()
    service.push_error = AsyncMock()
    service.emit_stt_usage_metrics = AsyncMock()

    await service._receive_messages()

    frame = service.push_frame.await_args.args[0]
    assert isinstance(frame, InterimTranscriptionFrame)
    assert frame.text == "你好"
    service.emit_stt_usage_metrics.assert_not_awaited()
    service.push_error.assert_not_awaited()


async def test_receive_messages_skips_empty_and_resultless_messages():
    service = _make_service()
    service._websocket = _FakeWebsocket(
        [
            json.dumps({"code": 0, "message": "success", "voice_id": "abc"}),  # handshake ack
            _result_message("", 0),  # empty interim text
            _result_message("", 2),  # empty final text
            json.dumps({"code": 0, "final": 1, "voice_id": "abc"}),  # session end ack
        ]
    )
    service.push_frame = AsyncMock()
    service.push_error = AsyncMock()
    service.emit_stt_usage_metrics = AsyncMock()

    await service._receive_messages()

    service.push_frame.assert_not_awaited()
    service.push_error.assert_not_awaited()


async def test_receive_messages_reports_error_codes_without_frames():
    service = _make_service()
    service._websocket = _FakeWebsocket(
        [json.dumps({"code": 4001, "message": "invalid signature"})]
    )
    service.push_frame = AsyncMock()
    service.push_error = AsyncMock()

    await service._receive_messages()

    service.push_error.assert_awaited_once()
    assert "4001" in service.push_error.await_args.kwargs["error_msg"]
    service.push_frame.assert_not_awaited()


async def test_receive_messages_ignores_non_json_payloads():
    service = _make_service()
    service._websocket = _FakeWebsocket(["not-json", _result_message("你好", 1)])
    service.push_frame = AsyncMock()
    service.push_error = AsyncMock()
    service.emit_stt_usage_metrics = AsyncMock()

    await service._receive_messages()

    service.push_frame.assert_awaited_once()
    service.push_error.assert_not_awaited()
