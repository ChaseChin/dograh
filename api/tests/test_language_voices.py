"""The agent's language reaching the voice it speaks with.

The organization picks one voice for every agent in it; a workflow picks the
language each agent speaks. These cover the layer that connects the two, and —
more importantly — the cases where it must decline to. A voice paired with a
language it cannot speak does not fall back, it fails to synthesize, so every
"does nothing" case below is a case that would otherwise be a silent agent.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock

from api.schemas.ai_model_configuration import EffectiveAIModelConfiguration
from api.services.configuration.ai_model_configuration import (
    get_effective_ai_model_configuration_for_workflow,
)
from api.services.configuration.language_voices import apply_language_voice


def _effective(provider: str = "bailian", voice: str = "longxiaochun_v2"):
    return EffectiveAIModelConfiguration(
        tts={
            "provider": provider,
            "model": "cosyvoice-v2",
            "voice": voice,
            "api_key": "test-key",
        }
    )


def test_a_chinese_agent_keeps_the_chinese_voice():
    assert apply_language_voice(_effective(), "zh").tts.voice == "longxiaochun_v2"


def test_an_english_agent_gets_an_english_voice():
    """The case this exists for: an English agent handed the organization's
    Chinese voice."""
    assert apply_language_voice(_effective(), "en").tts.voice == "loongava_v2"


def test_follow_the_caller_never_switches_a_voice():
    """The language is not known until someone speaks, and the voice is chosen
    when the call is set up."""
    assert apply_language_voice(_effective(), "auto").tts.voice == "longxiaochun_v2"


def test_a_workflow_with_no_language_is_untouched():
    """Those predate the setting and get no rule injected at runtime either."""
    assert apply_language_voice(_effective(), None).tts.voice == "longxiaochun_v2"


def test_a_workflow_that_chose_its_own_voice_keeps_it():
    """An explicit override sits above the language rule, not below it."""
    effective = _effective()

    assert (
        apply_language_voice(effective, "en", own_tts_override=True).tts.voice
        == "longxiaochun_v2"
    )


def test_a_provider_with_no_published_voice_list_is_untouched():
    """Google's voice ids carry their locale, so a language cannot be set
    without the voice that goes with it — and inventing that pair would break
    synthesis rather than degrade it."""
    assert (
        apply_language_voice(_effective("google"), "zh").tts.voice == "longxiaochun_v2"
    )


def test_a_configuration_with_no_tts_is_untouched():
    """Nothing to match a voice on — a realtime agent, say."""
    assert apply_language_voice(EffectiveAIModelConfiguration(), "en").tts is None


async def test_the_workflow_language_reaches_the_voice(monkeypatch):
    """The wiring, not just the helper: this is what run_pipeline calls."""
    monkeypatch.setattr(
        "api.services.configuration.ai_model_configuration."
        "get_resolved_ai_model_configuration",
        AsyncMock(return_value=SimpleNamespace(effective=_effective())),
    )

    effective = await get_effective_ai_model_configuration_for_workflow(
        organization_id=1,
        workflow_configurations={"language": "en"},
    )

    assert effective.tts.voice == "loongava_v2"


async def test_a_workflows_own_tts_override_survives_the_wiring(monkeypatch):
    monkeypatch.setattr(
        "api.services.configuration.ai_model_configuration."
        "get_resolved_ai_model_configuration",
        AsyncMock(return_value=SimpleNamespace(effective=_effective())),
    )

    effective = await get_effective_ai_model_configuration_for_workflow(
        organization_id=1,
        workflow_configurations={
            "language": "en",
            "model_overrides": {"tts": {"voice": "some-voice-they-chose"}},
        },
    )

    assert effective.tts.voice == "some-voice-they-chose"
