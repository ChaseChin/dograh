"""System prompt composition: language rule placement and legacy behaviour."""

import pytest

from api.services.workflow.pipecat_engine_context_composer import (
    compose_system_prompt_for_node,
)
from api.services.workflow.language import build_language_instruction


class _Node:
    def __init__(self, prompt: str, add_global_prompt: bool = True):
        self.prompt = prompt
        self.add_global_prompt = add_global_prompt


class _Workflow:
    def __init__(self, global_prompt: str | None):
        self.global_node_id = "global" if global_prompt is not None else None
        self.nodes = {"global": _Node(global_prompt)} if global_prompt else {}


def _compose(*, node, workflow, language_instruction=None):
    return compose_system_prompt_for_node(
        node=node,
        workflow=workflow,
        format_prompt=lambda prompt: prompt,
        has_recordings=False,
        language_instruction=language_instruction,
    )


def test_language_instruction_is_prepended_to_the_prompt():
    prompt = _compose(
        node=_Node("NODE"),
        workflow=_Workflow("GLOBAL"),
        language_instruction=build_language_instruction("zh"),
    )

    parts = prompt.split("\n\n")
    assert parts[0].startswith("- Language: 始终使用简体中文")
    assert parts[1:] == ["GLOBAL", "NODE"]


def test_missing_language_instruction_keeps_the_legacy_prompt():
    prompt = _compose(node=_Node("NODE"), workflow=_Workflow("GLOBAL"))

    assert prompt == "GLOBAL\n\nNODE"


def test_unknown_language_injects_nothing():
    prompt = _compose(
        node=_Node("NODE"),
        workflow=_Workflow(None),
        language_instruction=build_language_instruction("fr"),
    )

    assert prompt == "NODE"


@pytest.mark.parametrize("language", ["zh", "en", "auto"])
def test_every_supported_language_produces_a_rule(language):
    prompt = _compose(
        node=_Node("NODE"),
        workflow=_Workflow(None),
        language_instruction=build_language_instruction(language),
    )

    assert prompt.startswith("- Language: ")
    assert prompt.endswith("NODE")