"""MCP tool that surfaces voice-prompting guidance to the workflow-authoring LLM.

The guide is split into stages (plan / create / review) and atoms
(topics). Stage calls return a tight briefing — an intro plus a list of
relevant topics with one-line lenses. Topic calls return the full
reference content for one atom. No-arg calls return a flat index.

The LLM is expected to read the briefing for the current stage first,
then drill into specific topics only when complexity warrants it. The
authoritative guidance lives in `api.services.voice_prompting_guide`;
this tool is a thin MCP-facing projection.
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import HTTPException

from api.mcp_server.auth import authenticate_mcp_request
from api.mcp_server.tracing import traced_tool
from api.services.voice_prompting_guide import (
    Stage,
    build_briefing,
    get_topic,
    list_topic_index,
)
from api.services.workflow.language import (
    build_language_instruction,
    upsert_language_rule,
)


def _in_language(content: str, language: Optional[str]) -> str:
    """Point the reference content at the agent's language.

    The guide is written in English because it is advice *to* the authoring
    LLM, and English advice is fine — what is not fine is the LLM copying its
    template verbatim into a Chinese agent, which is what happened: the
    template's own `Language:` line said "Default English" and the examples
    were English too.

    So the rule line is rewritten in place, and one sentence tells the author
    to write the rest in the same language. Without a known language the
    content is returned exactly as it was.
    """
    rule = build_language_instruction(language)
    if rule is None:
        return content

    return (
        f"{upsert_language_rule(content, rule)}\n\n"
        "Write the whole template in the agent's language — its examples and "
        "its objection handling included. The `Language:` rule line is already "
        "set for you; copy it as it stands."
    )


@traced_tool
async def get_voice_prompting_guide(
    stage: Optional[str] = None,
    topic: Optional[str] = None,
    node_type: Optional[str] = None,
    language: Optional[str] = None,
) -> dict[str, Any]:
    """Fetch staged voice-prompting guidance for authoring Dograh workflows.

    Call this BEFORE composing or revising any prompt field on a node. The
    guide is the authoritative source for prompt-authoring craft (global
    guidelines, turn-taking, tool calls, success criteria, guardrails);
    product-mechanics questions
    (how a node type works at runtime) belong in `search_docs` / `read_doc`.

    Args:
        stage: "plan" | "create" | "review". Returns a stage briefing — a
            short intro plus the list of topics relevant at this stage,
            each with a one-line lens. Combine with `node_type` during the
            create stage to narrow to topics that apply to that node type's
            prompts (e.g. `node_type="agent"`).
        topic: A topic id from a prior briefing. Returns the full content
            for that atom. Use after the briefing flags a topic worth
            drilling into. Mutually exclusive with `stage`.
        node_type: Optional filter. Most useful with `stage="create"`.
        language: The agent's language ("zh" | "en" | "auto"), the same value
            you pass to `create_workflow`. The guide's own text is English,
            but topic content returned with this set has its `Language:` rule
            line and its instructions written for that language — so the
            global-node template you copy out of it comes out in the right
            one. Omit it and the content is returned as written.

    Returns:
        - With `topic`: { id, title, severity, content, stages_relevant,
          applies_to_node_types?, cross_refs? }.
        - With `stage`: { stage, intro, topics: [{id, title, lens}],
          drill_in, filtered_to_node_type? }.
        - With no args: { topics: [{id, title}], next }.

    Briefings are designed to be cheap — read the lens, decide what to
    drill into, then ask for full content for the 1–3 topics that matter
    for the prompt you're about to write. Always drill into
    topic="common_guidelines" before writing or revising a globalNode so the
    template content is actually read. Do not pull every topic.
    """
    await authenticate_mcp_request()

    if topic is not None and stage is not None:
        raise ValueError(
            "Pass either `topic` or `stage`, not both. Use `stage` for a "
            "briefing index; use `topic` for full content of one atom."
        )

    if topic is not None:
        atom = get_topic(topic)
        if atom is None:
            available = ", ".join(t["id"] for t in list_topic_index())
            raise HTTPException(
                status_code=404,
                detail=(
                    f"Unknown voice-prompting topic: {topic!r}. "
                    f"Available topics: {available or '(none registered)'}."
                ),
            )
        rendered = atom.to_deep_dict()
        rendered["content"] = _in_language(rendered["content"], language)
        return rendered

    if stage is not None:
        try:
            stage_enum = Stage(stage)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Unknown stage: {stage!r}. "
                    f"Use one of: {', '.join(s.value for s in Stage)}."
                ),
            )
        return build_briefing(stage_enum, node_type=node_type)

    return {
        "topics": list_topic_index(),
        "next": (
            "Call with stage='plan'|'create'|'review' for a briefing, or "
            "topic=<id> for the full content of one atom."
        ),
    }
