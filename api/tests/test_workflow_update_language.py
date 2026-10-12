"""PUT /workflow/{id}: the stored language reaches the stored prompt.

Two shapes of save arrive at this route — the settings page sends the
configurations and no graph, the builder sends the graph and no configurations
— and neither used to touch the other. The rule line in a workflow's prompt
was therefore whatever the language was when it was created, for good.

These cover the helper the route uses to reconcile the two, because getting it
wrong is silent: the runtime prepends the same rule on every call, so a stale
stored rule costs nothing until someone opens the prompt and reads it.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from api.routes.workflow import _definition_for_update

# The shape a prompt is in after someone hand-edited its language rule.
UK_ENGLISH_PROMPT = (
    "# Goal\nYou are a helpful agent.\n\n"
    "## Rules\n"
    "- Language: UK English but does not have to be correct english\n"
    "- Keep responses short\n"
)


def _definition(prompt: str = UK_ENGLISH_PROMPT) -> dict:
    return {
        "nodes": [
            {"id": "start", "type": "startCall", "data": {"prompt": prompt}},
        ],
        "edges": [],
    }


def _stored(language: str | None, prompt: str = UK_ENGLISH_PROMPT):
    configurations = {} if language is None else {"language": language}
    return SimpleNamespace(
        workflow_json=_definition(prompt),
        workflow_configurations=configurations,
    )


def _patch_db(draft):
    return patch(
        "api.routes.workflow.db_client",
        SimpleNamespace(
            get_draft_version=AsyncMock(return_value=draft),
            get_workflow=AsyncMock(return_value=None),
        ),
    )


async def test_a_settings_save_rewrites_the_stored_prompt():
    """The language arrived in the configurations; the graph is on the row."""
    draft = _stored("zh")

    with _patch_db(draft):
        result = await _definition_for_update(
            None, {"language": "en"}, workflow_id=7, organization_id=11
        )

    prompt = result["nodes"][0]["data"]["prompt"]
    assert "Always respond in English" in prompt
    assert "UK English" not in prompt
    # The hand-written prose around the rule is untouched.
    assert "- Keep responses short" in prompt
    assert prompt.startswith("# Goal")


async def test_the_stored_definition_is_not_mutated_in_place():
    """It comes off the ORM; editing it would dirty the session with a change
    nobody asked for."""
    draft = _stored("zh")
    before = draft.workflow_json["nodes"][0]["data"]["prompt"]

    with _patch_db(draft):
        await _definition_for_update(
            None, {"language": "en"}, workflow_id=7, organization_id=11
        )

    assert draft.workflow_json["nodes"][0]["data"]["prompt"] == before


async def test_a_graph_save_follows_the_language_already_on_the_row():
    """The builder sends no configurations, so the row decides."""
    submitted = _definition("# Goal\nA prompt the user just edited in the builder.")

    with _patch_db(_stored("zh")):
        result = await _definition_for_update(
            submitted, None, workflow_id=7, organization_id=11
        )

    prompt = result["nodes"][0]["data"]["prompt"]
    assert "简体中文" in prompt
    # What the user typed is still what is stored, plus the rule.
    assert prompt.startswith("# Goal\nA prompt the user just edited in the builder.")
    assert result is submitted


async def test_a_legacy_workflow_is_left_alone():
    """No stored language means the rule was never in play, so a save must not
    start writing one."""
    submitted = _definition("# Goal\nNo language rule here.")

    with _patch_db(_stored(None)):
        result = await _definition_for_update(
            submitted, None, workflow_id=7, organization_id=11
        )

    assert result["nodes"][0]["data"]["prompt"] == "# Goal\nNo language rule here."


async def test_a_save_that_carries_neither_does_not_read_the_row():
    """Nothing to reconcile: the settings page always sends configurations, so
    a request without them is a name change or a template-variable edit."""
    with _patch_db(_stored("zh")) as patched:
        result = await _definition_for_update(
            None, {"max_call_duration": 300}, workflow_id=7, organization_id=11
        )

    assert result is None
    assert patched.get_draft_version.await_count == 0
