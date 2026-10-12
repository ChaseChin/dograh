"""The template route: translated prose, and the rule line written last.

The translation only helps if it is wired into creation and runs in the right
order — the `- Language:` rule has to be written *after* the translation, or
the translation would translate the rule too. Neither is visible from the unit
tests of the translator, and this is the route a user actually clicks.
"""

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.routes.workflow import router
from api.services.auth.depends import get_user

ENGLISH_PROMPT = (
    "# MAIN ACTION POINT AT THIS STAGE\n\n"
    "You have received an inbound call from a user.\n"
    "Greet the user and ask how you can help them today.\n"
)


def _mps_definition() -> dict:
    return {
        "name": "牙医预约 - inbound",
        "workflow_definition": {
            "nodes": [
                {
                    "id": "start",
                    "type": "startCall",
                    "data": {"name": "Greeting", "prompt": ENGLISH_PROMPT},
                }
            ],
            "edges": [],
        },
    }


def _app() -> FastAPI:
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_user] = lambda: SimpleNamespace(
        id=1, provider_id="provider-1", selected_organization_id=11
    )
    return app


def test_a_new_template_workflow_is_translated_before_the_rule_goes_in():
    seen: dict = {}
    saved: dict = {}

    async def _fake_translate(definition, language, *, organization_id):
        seen["language"] = language
        seen["organization_id"] = organization_id
        # The rule must not be in the prompt yet: it is written afterwards, so
        # that the translation cannot translate it.
        seen["rule_already_there"] = any(
            "- Language:" in (node.get("data", {}).get("prompt") or "")
            for node in definition["nodes"]
        )
        for node in definition["nodes"]:
            node["data"]["prompt"] = "【中文】" + node["data"]["prompt"]
        return definition

    async def _capture(**kwargs):
        saved.update(kwargs)
        return SimpleNamespace(
            id=7,
            name=kwargs["name"],
            status="active",
            created_at=datetime.now(UTC),
            current_definition_id=1,
            template_context_variables={},
            call_disposition_codes={},
            workflow_configurations=kwargs["workflow_configurations"],
        )

    with (
        patch(
            "api.routes.workflow.mps_service_key_client.call_workflow_api",
            AsyncMock(return_value=_mps_definition()),
        ),
        patch("api.routes.workflow.translate_definition", _fake_translate),
        patch(
            "api.routes.workflow.db_client.create_workflow",
            AsyncMock(side_effect=_capture),
        ),
    ):
        response = TestClient(_app()).post(
            "/workflow/create/template",
            json={
                "call_type": "inbound",
                "use_case": "dentist appointment",
                "activity_description": "book appointments",
                "language": "zh",
            },
        )

    assert response.status_code == 200, response.text
    assert seen["language"] == "zh"
    assert seen["organization_id"] == 11
    assert seen["rule_already_there"] is False

    prompt = saved["workflow_definition"]["nodes"][0]["data"]["prompt"]
    assert prompt.startswith("【中文】")
    assert "- Language: 始终使用简体中文" in prompt


def test_an_english_template_workflow_is_still_asked_to_translate():
    """The route hands the language over unconditionally; deciding which
    languages are worth translating is the translator's job, in one place."""
    seen: dict = {}

    async def _fake_translate(definition, language, *, organization_id):
        seen["language"] = language
        return definition

    with (
        patch(
            "api.routes.workflow.mps_service_key_client.call_workflow_api",
            AsyncMock(return_value=_mps_definition()),
        ),
        patch("api.routes.workflow.translate_definition", _fake_translate),
        patch(
            "api.routes.workflow.db_client.create_workflow",
            AsyncMock(
                return_value=SimpleNamespace(
                    id=7,
                    name="x",
                    status="active",
                    created_at=datetime.now(UTC),
                    current_definition_id=1,
                    template_context_variables={},
                    call_disposition_codes={},
                    workflow_configurations={"language": "en"},
                )
            ),
        ),
    ):
        response = TestClient(_app()).post(
            "/workflow/create/template",
            json={
                "call_type": "inbound",
                "use_case": "dentist appointment",
                "activity_description": "book appointments",
                "language": "en",
            },
        )

    assert response.status_code == 200, response.text
    assert seen["language"] == "en"
