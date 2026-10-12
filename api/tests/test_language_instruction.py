"""Agent language rules: injection, replacement, and definition walking."""

from api.services.workflow.language import (
    apply_language_instruction,
    build_language_instruction,
    resolve_workflow_language,
    upsert_language_rule,
)

UK_ENGLISH_PROMPT = (
    "# Goal\nYou are a helpful agent.\n\n"
    "## Rules\n"
    "- Language: UK English but does not have to be correct english\n"
    "- Keep responses short\n"
)


def test_build_language_instruction_covers_supported_languages():
    assert "简体中文" in build_language_instruction("zh")
    assert "English" in build_language_instruction("en")
    assert "same language the caller" in build_language_instruction("auto")


def test_build_language_instruction_is_none_for_unset_or_unknown():
    assert build_language_instruction(None) is None
    assert build_language_instruction("") is None
    assert build_language_instruction("fr") is None


def test_upsert_replaces_existing_language_rule():
    instruction = build_language_instruction("zh")
    updated = upsert_language_rule(UK_ENGLISH_PROMPT, instruction)

    assert "UK English" not in updated
    assert "- Language: 始终使用简体中文" in updated
    # Only the rule line changes; the rest of the prompt survives untouched.
    assert "- Keep responses short" in updated
    assert updated.startswith("# Goal")


def test_upsert_keeps_bullet_and_is_idempotent():
    instruction = build_language_instruction("en")
    once = upsert_language_rule(UK_ENGLISH_PROMPT, instruction)
    twice = upsert_language_rule(once, instruction)

    assert once == twice
    assert once.count("English, regardless of the language the caller uses") == 1


def test_upsert_appends_when_prompt_has_no_rule():
    updated = upsert_language_rule(
        "# Goal\nYou are a helpful agent.", build_language_instruction("auto")
    )

    assert updated.startswith("# Goal")
    assert updated.endswith(
        "- Language: Always respond in the same language the caller is speaking; "
        "if they switch languages, follow them."
    )


def test_upsert_does_not_touch_prose_about_the_callers_language():
    prompt = (
        "## Rules\n"
        "- Mirror the caller's tone.\n"
        "The caller's language may change mid-call; handle it gracefully.\n"
    )
    updated = upsert_language_rule(prompt, build_language_instruction("zh"))

    # The prose sentence is intact and the rule was appended, not substituted.
    assert "The caller's language may change mid-call" in updated
    assert updated.count("语言") >= 1


def test_upsert_handles_empty_prompt():
    instruction = build_language_instruction("zh")
    assert upsert_language_rule("", instruction) == instruction


def _definition(**prompt_overrides) -> dict:
    return {
        "nodes": [
            {
                "id": "start",
                "type": "startCall",
                "data": {"prompt": prompt_overrides.get("start", UK_ENGLISH_PROMPT)},
            },
            {
                "id": "global",
                "type": "globalNode",
                "data": {"prompt": prompt_overrides.get("global", "# Global\nBe nice.")},
            },
            {"id": "end", "type": "endCall", "data": {}},
        ],
        "edges": [],
    }


def test_apply_language_instruction_walks_prompt_nodes_only():
    definition = apply_language_instruction(_definition(), "zh")
    by_type = {n["type"]: n["data"].get("prompt", "") for n in definition["nodes"]}

    assert "简体中文" in by_type["startCall"]
    assert "简体中文" in by_type["globalNode"]
    assert by_type["endCall"] == ""


def test_apply_language_instruction_is_a_noop_without_a_language():
    definition = _definition()
    before = str(definition)

    assert apply_language_instruction(definition, None) is definition
    assert str(definition) == before


def test_a_save_that_sets_a_language_speaks_for_it():
    """The settings page sends configurations and no graph."""
    assert resolve_workflow_language({"language": "en"}, {"language": "zh"}) == "en"


def test_a_save_that_says_nothing_defers_to_what_is_stored():
    """The builder sends a graph and no configurations."""
    assert resolve_workflow_language(None, {"language": "zh"}) == "zh"
    assert resolve_workflow_language({"dictionary": ""}, {"language": "auto"}) == "auto"
    assert resolve_workflow_language(None, None) is None


def test_an_explicitly_unset_language_is_not_second_guessed():
    """`exclude_unset` keeps an explicitly-null field, which means "unset" —
    a save saying so must leave the prompt alone rather than restore the
    stored value."""
    assert resolve_workflow_language({"language": None}, {"language": "zh"}) is None
