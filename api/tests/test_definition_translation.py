"""Translating a template-generated workflow into the agent's language.

The template service generates English and takes no language parameter, so the
prose has to be translated after the fact or a Chinese agent reads an English
prompt. These cover the translation and — more of them — the ways it is allowed
to do nothing, because every one of those is a case where doing something would
be worse: a silent agent, a prompt with its variables eaten, or a creation that
fails over a nicety.
"""

import copy
from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from api.services.workflow.definition_translation import (
    _protect_variables,
    _restore_variables,
    translate_definition,
)

DEFINITION = {
    "nodes": [
        {
            "id": "1",
            "type": "startCall",
            "data": {
                "name": "Greeting",
                "prompt": "Greet the caller from {{company_name}} warmly.",
                "greeting": "Hi {{first_name}}!",
            },
        },
        {
            "id": "2",
            "type": "endCall",
            "data": {"name": "Done", "prompt": "Say goodbye."},
        },
    ],
    "edges": [],
}


def _definition() -> dict:
    return copy.deepcopy(DEFINITION)


@contextmanager
def _model(reply):
    """Install a fake model whose `run_inference` is `reply`."""
    llm = SimpleNamespace(run_inference=AsyncMock(side_effect=reply))
    with (
        patch(
            "api.services.workflow.definition_translation."
            "get_resolved_ai_model_configuration",
            AsyncMock(
                return_value=SimpleNamespace(
                    effective=SimpleNamespace(llm=SimpleNamespace())
                )
            ),
        ),
        patch(
            "api.services.workflow.definition_translation.create_llm_service",
            lambda *args, **kwargs: llm,
        ),
    ):
        yield llm


@contextmanager
def _no_model():
    """The configuration resolves, but carries no llm to translate with."""
    with patch(
        "api.services.workflow.definition_translation."
        "get_resolved_ai_model_configuration",
        AsyncMock(return_value=SimpleNamespace(effective=SimpleNamespace(llm=None))),
    ):
        yield


async def _translates(context, system_instruction=None):
    """A compliant model: translates, leaves the markers where they are."""
    return "【中文】" + context.messages[0]["content"]


def _prompt(definition: dict, node_index: int = 0, field: str = "prompt") -> str:
    return definition["nodes"][node_index]["data"][field]


def _english(node_index: int = 0, field: str = "prompt") -> str:
    return DEFINITION["nodes"][node_index]["data"][field]


# ─── Variables ───────────────────────────────────────────────────────────


def test_markers_round_trip():
    protected, variables = _protect_variables("Say hi to {{company_name}} now.")

    assert "{{company_name}}" not in protected
    assert "%%DOGRAH_VAR_0%%" in protected
    assert _restore_variables(protected, variables) == "Say hi to {{company_name}} now."


def test_a_garbled_marker_is_refused():
    """A marker nothing resolves would ship a placeholder into the prompt."""
    _, variables = _protect_variables("Hi {{first_name}}")

    assert _restore_variables("Hi DOGRAH VAR 0", variables) is None


def test_a_marker_the_model_translated_away_is_refused():
    """Worse than a garbled marker: the variable is simply gone, and the prompt
    still runs — it just never says the caller's name."""
    _, variables = _protect_variables("Hi {{first_name}}")

    assert _restore_variables("你好", variables) is None


# ─── What it translates ──────────────────────────────────────────────────


async def test_it_translates_the_text_a_model_reads():
    with _model(_translates):
        result = await translate_definition(_definition(), "zh", organization_id=1)

    assert _prompt(result).startswith("【中文】")
    assert _prompt(result, 0, "greeting").startswith("【中文】")
    assert _prompt(result, 1, "prompt").startswith("【中文】")
    # The node name labels the graph in the editor; no model reads it.
    assert result["nodes"][0]["data"]["name"] == "Greeting"


async def test_a_variable_comes_back_as_a_variable():
    with _model(_translates):
        result = await translate_definition(_definition(), "zh", organization_id=1)

    translated = _prompt(result)
    assert "{{company_name}}" in translated
    assert "DOGRAH_VAR" not in translated


async def test_a_field_that_loses_its_variable_keeps_its_english():
    async def _eats_the_variable(context, system_instruction=None):
        return "【中文】" + context.messages[0]["content"].replace(
            "%%DOGRAH_VAR_0%%", "公司"
        )

    with _model(_eats_the_variable):
        result = await translate_definition(_definition(), "zh", organization_id=1)

    assert _prompt(result) == _english()


# ─── When it does nothing ────────────────────────────────────────────────


async def test_a_language_with_no_target_is_never_translated():
    for language in ("en", "auto", None):
        with (
            _model(_translates),
            patch(
                "api.services.workflow.definition_translation.create_llm_service"
            ) as factory,
        ):
            result = await translate_definition(
                _definition(), language, organization_id=1
            )

        assert _prompt(result) == _english()
        factory.assert_not_called()


async def test_a_definition_with_nothing_to_translate_is_untouched():
    definition = {"nodes": [{"id": "1", "type": "endCall", "data": {"name": "x"}}]}

    with (
        _model(_translates),
        patch(
            "api.services.workflow.definition_translation.create_llm_service"
        ) as factory,
    ):
        result = await translate_definition(definition, "zh", organization_id=1)

    assert result["nodes"][0]["data"] == {"name": "x"}
    factory.assert_not_called()


async def test_no_model_configured_leaves_it_alone():
    with _no_model():
        result = await translate_definition(_definition(), "zh", organization_id=1)

    assert _prompt(result) == _english()


async def test_a_field_that_fails_does_not_take_the_others_with_it():
    async def _fails_on_the_greeting(context, system_instruction=None):
        content = context.messages[0]["content"]
        if content.startswith("Hi"):
            raise RuntimeError("model unavailable")
        return "【中文】" + content

    with _model(_fails_on_the_greeting):
        result = await translate_definition(_definition(), "zh", organization_id=1)

    assert _prompt(result).startswith("【中文】")
    assert _prompt(result, 0, "greeting") == _english(0, "greeting")


async def test_a_model_that_cannot_be_built_leaves_it_alone():
    """An organization can have an llm configured and still fail to build one —
    a credential that does not work, a provider that is down. Creation carries
    on in English rather than failing."""
    with (
        patch(
            "api.services.workflow.definition_translation."
            "get_resolved_ai_model_configuration",
            AsyncMock(
                return_value=SimpleNamespace(
                    effective=SimpleNamespace(llm=SimpleNamespace())
                )
            ),
        ),
        patch(
            "api.services.workflow.definition_translation.create_llm_service",
            side_effect=RuntimeError("no credentials"),
        ),
    ):
        result = await translate_definition(_definition(), "zh", organization_id=1)

    assert _prompt(result) == _english()


async def test_the_marker_instruction_is_withheld_when_there_is_no_variable():
    """Explaining a marker the model was sent none of is how a field gets thrown
    away for nothing: the model reuses the example, and a marker arriving with
    no variable to resolve it for is indistinguishable from one the model lost.
    Found by running the thing, not by reading it."""
    instructions: list[str] = []

    async def _records(context, system_instruction=None):
        instructions.append(system_instruction or "")
        return "【中文】" + context.messages[0]["content"]

    with _model(_records):
        await translate_definition(
            {"nodes": [{"id": "1", "type": "startCall", "data": {"prompt": "Greet."}}]},
            "zh",
            organization_id=1,
        )

    assert instructions, "the model was never called"
    assert all("DOGRAH_VAR" not in instruction for instruction in instructions)


async def test_the_marker_instruction_is_sent_when_a_variable_needs_protecting():
    instructions: list[str] = []

    async def _records(context, system_instruction=None):
        instructions.append(system_instruction or "")
        return "【中文】" + context.messages[0]["content"]

    with _model(_records):
        await translate_definition(_definition(), "zh", organization_id=1)

    assert any("DOGRAH_VAR" in instruction for instruction in instructions)
