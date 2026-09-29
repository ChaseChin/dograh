"""Unit tests for the Alibaba Cloud Bailian (DashScope CosyVoice) TTS service.

Covers the DashScope websocket protocol message construction, service factory
wiring, configuration registry, API-key validation base_url handling, and the
translation of DashScope events into pipecat frames. No real credentials or
network access required.
"""

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from pydantic import TypeAdapter

from api.services.configuration.check_validity import UserConfigurationValidator
from api.services.configuration.options import (
    BAILIAN_DEFAULT_BASE_URL,
    BAILIAN_TTS_DEFAULT_BASE_URL,
    BAILIAN_TTS_MODELS,
    BAILIAN_TTS_VOICES,
)
from api.services.configuration.registry import (
    BailianTTSConfiguration,
    ServiceProviders,
    TTSConfig,
)
from api.services.pipecat.bailian_tts import (
    BAILIAN_TTS_DEFAULT_WS_URL,
    BailianTTSService,
    build_continue_task_message,
    build_finish_task_message,
    build_run_task_message,
)
from api.services.pipecat.service_factory import create_tts_service

API_KEY = "sk-test-bailian"


def _make_service(**overrides) -> BailianTTSService:
    kwargs = dict(
        api_key=API_KEY,
        model="cosyvoice-v2",
        voice="longxiaochun_v2",
        sample_rate=16000,
    )
    kwargs.update(overrides)
    service = BailianTTSService(**kwargs)
    # TTSService defers sample-rate init to setup(); pin it directly in tests.
    service._sample_rate = 16000
    service.start_tts_usage_metrics = AsyncMock()
    service.stop_ttfb_metrics = AsyncMock()
    return service


class _FakeConnection:
    """Async-iterable websocket stub that replays canned messages.

    Iteration is stateful: a second ``async for`` resumes where the previous
    one stopped, like a real websocket.
    """

    def __init__(self, messages=()):
        self._messages = list(messages)
        self._position = 0
        self.send = self._send
        self.sent = []

    async def _send(self, message):
        self.sent.append(json.loads(message))

    def __aiter__(self):
        return self._iterate()

    async def _iterate(self):
        while self._position < len(self._messages):
            message = self._messages[self._position]
            self._position += 1
            yield message


class _FakeConnect:
    """Stand-in for websockets.connect usable as an async context manager."""

    def __init__(self, connection: _FakeConnection):
        self.connection = connection
        self.calls = []

    def __call__(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return self

    async def __aenter__(self):
        return self.connection

    async def __aexit__(self, *args):
        return False


def _task_event(event: str, **header) -> str:
    return json.dumps({"header": {"event": event, **header}, "payload": {}})


async def _collect(agen):
    return [frame async for frame in agen]


# ---------------------------------------------------------------------------
# Protocol message builders
# ---------------------------------------------------------------------------


def test_build_run_task_message():
    message = json.loads(
        build_run_task_message(
            task_id="abc123",
            model="cosyvoice-v2",
            voice="longxiaochun_v2",
            sample_rate=16000,
        )
    )

    assert message["header"] == {
        "action": "run-task",
        "task_id": "abc123",
        "streaming": "duplex",
    }
    payload = message["payload"]
    assert payload["task_group"] == "audio"
    assert payload["task"] == "tts"
    assert payload["function"] == "SpeechSynthesizer"
    assert payload["model"] == "cosyvoice-v2"
    assert payload["parameters"] == {
        "text_type": "Plain",
        "voice": "longxiaochun_v2",
        "format": "pcm",
        "sample_rate": 16000,
        "volume": 50,
        "rate": 1.0,
        "pitch": 1.0,
    }
    assert payload["input"] == {}


def test_build_continue_task_message():
    message = json.loads(build_continue_task_message(task_id="abc", text="你好"))

    assert message["header"]["action"] == "continue-task"
    assert message["header"]["task_id"] == "abc"
    assert message["payload"]["input"] == {"text": "你好"}


def test_build_finish_task_message():
    message = json.loads(build_finish_task_message(task_id="abc"))

    assert message["header"]["action"] == "finish-task"
    assert message["payload"]["input"] == {}


# ---------------------------------------------------------------------------
# Configuration registry
# ---------------------------------------------------------------------------


def test_bailian_tts_configuration_defaults():
    config = BailianTTSConfiguration(api_key=API_KEY)

    assert config.provider == ServiceProviders.BAILIAN
    assert config.model == "cosyvoice-v2"
    assert config.voice == "longxiaochun_v2"
    assert config.base_url == BAILIAN_TTS_DEFAULT_BASE_URL
    assert "cosyvoice-v2" in BAILIAN_TTS_MODELS
    assert "longxiaochun_v2" in BAILIAN_TTS_VOICES


def test_tts_config_discriminator_parses_bailian():
    config = TypeAdapter(TTSConfig).validate_python(
        {"provider": "bailian", "api_key": API_KEY, "model": "cosyvoice-v1"}
    )

    assert isinstance(config, BailianTTSConfiguration)
    assert config.model == "cosyvoice-v1"


# ---------------------------------------------------------------------------
# Service factory wiring
# ---------------------------------------------------------------------------


def test_create_tts_service_wires_bailian():
    user_config = SimpleNamespace(
        tts=SimpleNamespace(
            provider=ServiceProviders.BAILIAN.value,
            api_key=API_KEY,
            model="cosyvoice-v2",
            voice="longxiaoxia",
            speed=1.2,
            base_url=BAILIAN_TTS_DEFAULT_WS_URL,
        )
    )
    audio_config = SimpleNamespace(transport_out_sample_rate=8000)

    service = create_tts_service(user_config, audio_config)

    assert isinstance(service, BailianTTSService)
    assert service._api_key == API_KEY
    assert service._model == "cosyvoice-v2"
    assert service._voice == "longxiaoxia"
    assert service._base_url == BAILIAN_TTS_DEFAULT_WS_URL
    assert service._rate == 1.2


def test_create_tts_service_bailian_defaults_when_fields_missing():
    user_config = SimpleNamespace(
        tts=SimpleNamespace(
            provider=ServiceProviders.BAILIAN.value,
            api_key=API_KEY,
            model="cosyvoice-v1",
        )
    )
    audio_config = SimpleNamespace(transport_out_sample_rate=16000)

    service = create_tts_service(user_config, audio_config)

    assert service._voice == "longxiaochun_v2"
    assert service._base_url == BAILIAN_TTS_DEFAULT_WS_URL
    assert service._rate == 1.0


# ---------------------------------------------------------------------------
# API key validation
# ---------------------------------------------------------------------------


def test_api_key_validation_rewrites_websocket_base_url(monkeypatch):
    captured = {}

    class FakeModels:
        def list(self):
            return []

    class FakeOpenAI:
        def __init__(self, **kwargs):
            captured.update(kwargs)
            self.models = FakeModels()

    monkeypatch.setattr(
        "api.services.configuration.check_validity.openai.OpenAI", FakeOpenAI
    )

    config = BailianTTSConfiguration(api_key=API_KEY)
    is_valid = UserConfigurationValidator()._check_api_key(
        ServiceProviders.BAILIAN.value, API_KEY, config
    )

    assert is_valid is True
    # The wss:// TTS endpoint must be rewritten to the HTTPS compatible-mode
    # endpoint for key validation.
    assert captured == {"api_key": API_KEY, "base_url": BAILIAN_DEFAULT_BASE_URL}


# ---------------------------------------------------------------------------
# run_tts frame mapping
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_run_tts_yields_audio_frames():
    service = _make_service()
    connection = _FakeConnection(
        messages=[
            _task_event("task-started"),
            b"\x01\x02",
            _task_event("result-generated"),
            b"\x03\x04\x05",
            _task_event("task-finished"),
        ]
    )
    connect = _FakeConnect(connection)

    with patch(
        "api.services.pipecat.bailian_tts.websockets.connect", connect
    ):
        frames = await _collect(service.run_tts("你好，世界", context_id="ctx-1"))

    from pipecat.frames.frames import TTSAudioRawFrame

    audio_frames = [f for f in frames if isinstance(f, TTSAudioRawFrame)]
    assert [f.audio for f in audio_frames] == [b"\x01\x02", b"\x03\x04\x05"]
    assert all(f.sample_rate == 16000 for f in audio_frames)
    assert all(f.num_channels == 1 for f in audio_frames)
    assert all(f.context_id == "ctx-1" for f in audio_frames)

    url, kwargs = connect.calls[0]
    assert url == BAILIAN_TTS_DEFAULT_WS_URL
    assert kwargs["additional_headers"] == {"Authorization": f"Bearer {API_KEY}"}

    actions = [message["header"]["action"] for message in connection.sent]
    assert actions == ["run-task", "continue-task", "finish-task"]
    assert connection.sent[1]["payload"]["input"] == {"text": "你好，世界"}

    service.start_tts_usage_metrics.assert_awaited_once_with("你好，世界")
    service.stop_ttfb_metrics.assert_awaited()


@pytest.mark.asyncio
async def test_run_tts_task_failed_yields_error_frame():
    service = _make_service()
    connection = _FakeConnection(
        messages=[
            _task_event("task-started"),
            _task_event(
                "task-failed",
                error_code="InvalidParameter",
                error_message="unsupported voice",
            ),
        ]
    )
    connect = _FakeConnect(connection)

    with patch("api.services.pipecat.bailian_tts.websockets.connect", connect):
        frames = await _collect(service.run_tts("text", context_id="ctx-2"))

    from pipecat.frames.frames import ErrorFrame

    assert len(frames) == 1
    assert isinstance(frames[0], ErrorFrame)
    assert "InvalidParameter" in frames[0].error
    assert "unsupported voice" in frames[0].error


@pytest.mark.asyncio
async def test_run_tts_task_failed_before_start_yields_error_frame():
    service = _make_service()
    connection = _FakeConnection(
        messages=[
            _task_event(
                "task-failed",
                error_code="InvalidApiKey",
                error_message="Invalid API-key provided.",
            ),
        ]
    )
    connect = _FakeConnect(connection)

    with patch("api.services.pipecat.bailian_tts.websockets.connect", connect):
        frames = await _collect(service.run_tts("text", context_id="ctx-3"))

    from pipecat.frames.frames import ErrorFrame

    assert len(frames) == 1
    assert isinstance(frames[0], ErrorFrame)
    assert "InvalidApiKey" in frames[0].error
    # No continue/finish messages should be sent for a task that never started.
    actions = [message["header"]["action"] for message in connection.sent]
    assert actions == ["run-task"]


@pytest.mark.asyncio
async def test_run_tts_connection_error_yields_error_frame():
    service = _make_service()

    class FailingConnect:
        def __call__(self, url, **kwargs):
            raise ConnectionError("network unreachable")

    with patch(
        "api.services.pipecat.bailian_tts.websockets.connect", FailingConnect()
    ):
        frames = await _collect(service.run_tts("text", context_id="ctx-4"))

    from pipecat.frames.frames import ErrorFrame

    assert len(frames) == 1
    assert isinstance(frames[0], ErrorFrame)
    assert "network unreachable" in frames[0].error
