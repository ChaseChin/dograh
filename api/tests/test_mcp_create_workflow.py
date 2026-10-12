import inspect
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from api.mcp_server.tools.create_workflow import create_workflow
from api.schemas.workflow_configurations import DEFAULT_AGENT_LANGUAGE


@pytest.mark.asyncio
async def test_create_workflow_rejects_duplicate_api_triggers():
    user = MagicMock()
    user.id = 1
    user.selected_organization_id = 1
    payload = {
        "nodes": [
            {
                "id": "start-1",
                "type": "startCall",
                "position": {"x": 0, "y": 0},
                "data": {"name": "Start", "prompt": "Greet."},
            },
            {
                "id": "trigger-1",
                "type": "trigger",
                "position": {"x": 0, "y": 200},
                "data": {"name": "Trigger A", "trigger_path": "support_west"},
            },
            {
                "id": "trigger-2",
                "type": "trigger",
                "position": {"x": 0, "y": 400},
                "data": {"name": "Trigger B", "trigger_path": "support_east"},
            },
        ],
        "edges": [],
    }

    with (
        patch(
            "api.mcp_server.tools.create_workflow.authenticate_mcp_request",
            AsyncMock(return_value=user),
        ),
        patch(
            "api.mcp_server.tools.create_workflow.parse_code",
            AsyncMock(
                return_value={
                    "ok": True,
                    "workflowName": "duplicate-trigger-test",
                    "workflow": payload,
                }
            ),
        ),
        patch(
            "api.mcp_server.tools.create_workflow.reconcile_positions",
            return_value=payload,
        ),
        patch(
            "api.mcp_server.tools.create_workflow.db_client.create_workflow",
            AsyncMock(),
        ) as create_mock,
    ):
        result = await create_workflow(code="ignored")

    assert result["created"] is False
    assert result["error_code"] == "graph_validation"
    assert "at most one API Trigger" in result["error"]
    create_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_create_workflow_carries_the_agent_language():
    """The authored prompts leave here in the workflow's language.

    The guide the authoring LLM copies from is written in English, so without
    this a Chinese agent would be created with an English rule line in its
    global prompt — and nothing downstream would have the language to correct
    it with, since the author is never told what was chosen.
    """
    user = MagicMock(id=1, provider_id="provider-1", selected_organization_id=1)
    payload = {
        "nodes": [
            {
                "id": "start-1",
                "type": "startCall",
                "position": {"x": 0, "y": 0},
                "data": {
                    "name": "Start",
                    "prompt": "Language: Default English.\nGreet warmly.",
                },
            },
        ],
        "edges": [],
    }

    with (
        patch(
            "api.mcp_server.tools.create_workflow.authenticate_mcp_request",
            AsyncMock(return_value=user),
        ),
        patch(
            "api.mcp_server.tools.create_workflow.parse_code",
            AsyncMock(
                return_value={
                    "ok": True,
                    "workflowName": "language-test",
                    "workflow": payload,
                }
            ),
        ),
        patch(
            "api.mcp_server.tools.create_workflow.reconcile_positions",
            return_value=payload,
        ),
        patch(
            "api.mcp_server.tools.create_workflow.validate_workflow_tool_name_collisions",
            AsyncMock(return_value=[]),
        ),
        patch("api.mcp_server.tools.create_workflow.capture_event"),
        patch(
            "api.mcp_server.tools.create_workflow.db_client.create_workflow",
            AsyncMock(
                return_value=SimpleNamespace(
                    id=7, name="language-test", status="active"
                )
            ),
        ) as create_mock,
    ):
        result = await create_workflow(code="ignored", language="zh")

    assert result["created"] is True
    assert create_mock.call_args.kwargs["workflow_configurations"] == {
        "language": "zh"
    }
    # The definition is the second positional argument (name, definition,
    # user_id, organization_id).
    saved_definition = create_mock.call_args.args[1]
    prompt = saved_definition["nodes"][0]["data"]["prompt"]
    assert "简体中文" in prompt
    assert "Default English" not in prompt


@pytest.mark.asyncio
async def test_create_workflow_defaults_to_the_house_language():
    """A caller that says nothing gets the same default the UI does."""
    assert inspect.signature(create_workflow).parameters["language"].default == (
        DEFAULT_AGENT_LANGUAGE
    )
