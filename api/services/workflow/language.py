"""Agent language rules: build, inject into prompts, and apply to definitions.

A workflow stores its agent language under ``workflow_configurations.language``
(``zh`` / ``en`` / ``auto``). The stored value is the single source of truth:

- At creation time the rule is written into the workflow definition's prompts so
  the model sees it even outside our runtime (exports, MCP-created agents).
- At runtime the composer prepends the same rule to every node's system prompt,
  so a user editing the node prompt cannot accidentally drop it.

An unset/unknown language yields ``None`` and changes nothing — workflows
created before this feature keep behaving exactly as before.
"""

import re

from api.schemas.workflow_configurations import AgentLanguage

# Node types whose prompt is part of what the caller experiences. Both the
# start node and the global node contribute text to the system prompt.
_PROMPT_NODE_TYPES = ("startCall", "globalNode")

# Anchored to a whole rule line ("- Language: ...", "* Language: ..." or a bare
# "Language: ..."), so prose like "respond in the caller's language" is left
# alone. Captures the bullet prefix so a replaced rule keeps its list marker.
_LANGUAGE_RULE_RE = re.compile(
    r"^[ \t]*(?P<bullet>[-*][ \t]+)?Language[ \t]*:[^\n]*",
    re.IGNORECASE | re.MULTILINE,
)

_INSTRUCTIONS: dict[AgentLanguage, str] = {
    "zh": "始终使用简体中文与对方交流,即使对方使用其他语言,也用中文回应。",
    "en": "Always respond in English, regardless of the language the caller uses.",
    "auto": (
        "Always respond in the same language the caller is speaking; if they "
        "switch languages, follow them."
    ),
}

# The rule is rendered as a list item so it reads as part of the prompt's
# existing rules list.
_RULE_TEMPLATE = "- Language: {instruction}"


def build_language_instruction(language: str | None) -> str | None:
    """Return the language rule line for a language, or None to inject nothing."""
    if not language:
        return None
    instruction = _INSTRUCTIONS.get(language)  # type: ignore[arg-type]
    if instruction is None:
        # Unknown values are treated as unset rather than raising: a row saved
        # by a newer/older client must never break a live call.
        return None
    return _RULE_TEMPLATE.format(instruction=instruction)


def upsert_language_rule(prompt: str, instruction: str) -> str:
    """Replace the prompt's existing language rule with ``instruction``.

    Appends the rule when the prompt has none. Idempotent: applying the same
    instruction twice produces the same text.
    """
    if not prompt:
        return instruction

    def _replace(match: re.Match[str]) -> str:
        bullet = match.group("bullet") or ""
        return f"{bullet}{instruction.lstrip('-* ').rstrip()}"

    # Only the first rule is replaced; a prompt with two of them was already
    # contradictory and the rest is left for the user to clean up.
    updated, replacements = _LANGUAGE_RULE_RE.subn(_replace, prompt, count=1)
    if replacements:
        return updated
    return f"{prompt.rstrip()}\n{instruction}"


def apply_language_instruction(
    workflow_definition: dict, language: str | None
) -> dict:
    """Return ``workflow_definition`` with the language rule upserted in-place.

    Walks every prompt-bearing node; nodes without a prompt are left untouched.
    Mutates and returns the given definition (it comes fresh from the generator
    or the request body at creation time).
    """
    instruction = build_language_instruction(language)
    if instruction is None:
        return workflow_definition

    for node in workflow_definition.get("nodes") or []:
        if not isinstance(node, dict) or node.get("type") not in _PROMPT_NODE_TYPES:
            continue
        data = node.get("data")
        if not isinstance(data, dict):
            continue
        prompt = data.get("prompt")
        if isinstance(prompt, str) and prompt.strip():
            data["prompt"] = upsert_language_rule(prompt, instruction)

    return workflow_definition