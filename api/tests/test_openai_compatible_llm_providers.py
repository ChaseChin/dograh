"""Tests for the DeepSeek and Alibaba Cloud Bailian LLM providers.

Both are OpenAI-compatible endpoints: they reuse pipecat's OpenAILLMService
with a base_url override, and the openai SDK key check against their own
base URL. No network access required — the SDK client is monkeypatched.
"""

from types import SimpleNamespace
from unittest.mock import patch

import pytest
from pydantic import TypeAdapter

from api.services.configuration import check_validity
from api.services.configuration.check_validity import UserConfigurationValidator
from api.services.configuration.options import (
    BAILIAN_DEFAULT_BASE_URL,
    BAILIAN_LLM_MODELS,
    DEEPSEEK_DEFAULT_BASE_URL,
    DEEPSEEK_LLM_MODELS,
)
from api.services.configuration.registry import (
    BailianLLMConfiguration,
    DeepSeekLLMConfiguration,
    LLMConfig,
    ServiceProviders,
)
from api.services.pipecat.service_factory import create_llm_service


# ---------------------------------------------------------------------------
# Configuration registry
# ---------------------------------------------------------------------------


def test_deepseek_llm_configuration_defaults():
    config = DeepSeekLLMConfiguration(api_key="sk-deepseek")

    assert config.provider == ServiceProviders.DEEPSEEK
    assert config.model == "deepseek-chat"
    assert config.base_url == DEEPSEEK_DEFAULT_BASE_URL
    assert "deepseek-chat" in DEEPSEEK_LLM_MODELS


def test_bailian_llm_configuration_defaults():
    config = BailianLLMConfiguration(api_key="sk-bailian")

    assert config.provider == ServiceProviders.BAILIAN
    assert config.model == "qwen-plus"
    assert config.base_url == BAILIAN_DEFAULT_BASE_URL
    assert "qwen-turbo" in BAILIAN_LLM_MODELS


@pytest.mark.parametrize(
    "provider,expected_cls",
    [
        ("deepseek", DeepSeekLLMConfiguration),
        ("bailian", BailianLLMConfiguration),
    ],
)
def test_llm_config_discriminator_parses_new_providers(provider, expected_cls):
    config = TypeAdapter(LLMConfig).validate_python(
        {"provider": provider, "api_key": "sk-test", "model": "custom-model"}
    )

    assert isinstance(config, expected_cls)
    assert config.model == "custom-model"


# ---------------------------------------------------------------------------
# API key validation
# ---------------------------------------------------------------------------


def _fake_openai_client(captured: dict):
    class FakeModels:
        def list(self):
            return []

    class FakeOpenAI:
        def __init__(self, **kwargs):
            captured.update(kwargs)
            self.models = FakeModels()

    return FakeOpenAI


@pytest.mark.parametrize(
    "provider,config_cls,expected_base_url",
    [
        (
            ServiceProviders.DEEPSEEK.value,
            DeepSeekLLMConfiguration,
            DEEPSEEK_DEFAULT_BASE_URL,
        ),
        (
            ServiceProviders.BAILIAN.value,
            BailianLLMConfiguration,
            BAILIAN_DEFAULT_BASE_URL,
        ),
    ],
)
def test_api_key_validation_uses_provider_base_url(
    monkeypatch, provider, config_cls, expected_base_url
):
    captured = {}
    monkeypatch.setattr(
        "api.services.configuration.check_validity.openai.OpenAI",
        _fake_openai_client(captured),
    )

    is_valid = UserConfigurationValidator()._check_api_key(
        provider, "sk-test", config_cls(api_key="sk-test")
    )

    assert is_valid is True
    assert captured == {"api_key": "sk-test", "base_url": expected_base_url}


@pytest.mark.parametrize(
    "provider,config_cls,expected_name",
    [
        (ServiceProviders.DEEPSEEK.value, DeepSeekLLMConfiguration, "DeepSeek"),
        (
            ServiceProviders.BAILIAN.value,
            BailianLLMConfiguration,
            "Alibaba Cloud Bailian",
        ),
    ],
)
def test_api_key_validation_error_names_provider(
    monkeypatch, provider, config_cls, expected_name
):
    class FakeAuthenticationError(Exception):
        pass

    class FakeModels:
        def list(self):
            raise FakeAuthenticationError

    class FakeOpenAI:
        def __init__(self, **kwargs):
            self.models = FakeModels()

    monkeypatch.setattr(check_validity.openai, "OpenAI", FakeOpenAI)
    monkeypatch.setattr(
        check_validity.openai, "AuthenticationError", FakeAuthenticationError
    )

    with pytest.raises(ValueError) as exc_info:
        UserConfigurationValidator()._check_api_key(
            provider, "sk-bad", config_cls(api_key="sk-bad")
        )

    message = str(exc_info.value)
    assert f"Invalid {expected_name} API key" in message
    assert "Invalid OpenAI API key" not in message


# ---------------------------------------------------------------------------
# Service factory wiring
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "provider,base_url",
    [
        (ServiceProviders.DEEPSEEK.value, DEEPSEEK_DEFAULT_BASE_URL),
        (ServiceProviders.BAILIAN.value, BAILIAN_DEFAULT_BASE_URL),
    ],
)
def test_create_llm_service_wires_base_url_into_openai_service(provider, base_url):
    user_config = SimpleNamespace(
        llm=SimpleNamespace(
            provider=provider,
            api_key="sk-test",
            model="my-model",
            base_url=base_url,
        )
    )

    with patch(
        "api.services.pipecat.service_factory.OpenAILLMService"
    ) as openai_service:
        create_llm_service(user_config)

    openai_service.assert_called_once()
    kwargs = openai_service.call_args.kwargs
    assert kwargs["api_key"] == "sk-test"
    assert kwargs["base_url"] == base_url
    assert kwargs["settings"].model == "my-model"
