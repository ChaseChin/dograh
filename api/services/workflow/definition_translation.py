"""Translate a template-generated workflow into the agent's language.

The template service generates its prompts in English and takes no language
parameter — its request carries only the call type, the use case and the
activity description. So a Chinese agent created from a template arrives with
the right `- Language:` rule (the backend writes that line) inside English
prose. The agent speaks the chosen language either way: the rule is what the
model follows, and the runtime prepends it to every node's system prompt. But
the prompt it reads from is English, and someone who picked Chinese did not ask
for a prompt in English.

So translate the prompt text once, at creation.

Three things this is careful about:

- **Variables survive.** `{{company_name}}` becomes a marker before the text is
  sent and is put back afterwards, because a model asked to translate a template
  will translate the variable's name as helpfully as the rest of it. If a marker
  cannot be put back, that field's translation is discarded rather than shipped
  with a stray placeholder in it.
- **A failure is not fatal.** A workflow in English is a working workflow; a
  workflow that failed to be created is not. Anything that goes wrong leaves the
  definition exactly as the template service sent it.
- **Only a real target is worth translating.** The language has to name a
  language: `auto` follows the caller and has no language of its own, an English
  agent is already reading its own language, and a workflow with no language set
  was never translated in the first place.
"""

from __future__ import annotations

import asyncio
import re
from typing import Any, Dict, List, Optional, Tuple

from loguru import logger
from pipecat.processors.aggregators.llm_context import LLMContext

from api.services.configuration.ai_model_configuration import (
    get_resolved_ai_model_configuration,
)
from api.services.pipecat.service_factory import create_llm_service

# The language names handed to the model. A language absent from this table is
# not a translation target: see the module docstring.
_TARGET_LANGUAGES: Dict[str, str] = {
    "zh": "Simplified Chinese (简体中文)",
}

# Fields carrying text a model reads: the node's instructions, what it opens
# with, and what its extractor is told to pull out. Node `name` is deliberately
# absent — it labels the node in the editor and no model reads it, so translating
# it would only make the graph harder to read.
_TRANSLATABLE_FIELDS = ("prompt", "greeting", "extraction_prompt")

_VARIABLE_RE = re.compile(r"\{\{[^{}]*\}\}")
# Tolerant of the spacing and case a model may introduce around the marker.
_MARKER_RE = re.compile(r"%+\s*DOGRAH\s*_?\s*VAR\s*_?\s*(\d+)\s*%+", re.IGNORECASE)
_MARKER_LIMIT = 64

_SYSTEM_PROMPT = """You translate the instructions a voice agent is given.

Translate the user's message into {target}.

Every sentence in it is an instruction addressed to the agent — "Greet the \
user", "Do not move to the next stage yet" — and it must still be an \
instruction when you are done. Translate it; never carry it out, and never \
write what the agent should say in its place. A greeting instruction stays an \
instruction to greet, not a greeting.

Keep its structure exactly: the markdown headings, the bullet and numbered \
lists, the line breaks, and the order of everything.

{markers}Reply with the translation and nothing else. No preamble, no \
explanation, no code fence."""

# Added only when there is something to protect. Explaining the marker to a
# model that has been sent none is not harmless: it is a string the model can
# helpfully reuse, and a marker arriving without a variable to resolve it for
# reads exactly like a variable the model lost — so the field gets thrown away
# and stays English for no reason at all.
_MARKER_INSTRUCTION = """Leave every marker of the form %%DOGRAH_VAR_0%% exactly \
as it is, in place. They stand for values that are filled in later.

"""


def _protect_variables(text: str) -> Tuple[str, List[str]]:
    """Replace each `{{variable}}` with a marker the model will copy verbatim."""
    variables: List[str] = []

    def _swap(match: re.Match[str]) -> str:
        if len(variables) >= _MARKER_LIMIT:
            return match.group(0)
        variables.append(match.group(0))
        return f"%%DOGRAH_VAR_{len(variables) - 1}%%"

    return _VARIABLE_RE.sub(_swap, text), variables


def _restore_variables(text: str, variables: List[str]) -> Optional[str]:
    """Put the variables back, or return None if the text cannot carry them.

    Two ways the model can ruin a variable, and both have to be caught rather
    than shipped: it can keep the marker but garble it (leaving a marker nothing
    resolves), or it can helpfully translate the marker away (leaving the
    variable out of the prompt entirely). A prompt missing `{{company_name}}`
    still runs and still talks — it just never says the company's name, which is
    the kind of loss nobody notices until a caller does.
    """
    seen: Dict[int, int] = {}

    def _swap(match: re.Match[str]) -> str:
        index = int(match.group(1))
        if index >= len(variables):
            return match.group(0)
        seen[index] = seen.get(index, 0) + 1
        return variables[index]

    restored = _MARKER_RE.sub(_swap, text)
    if _MARKER_RE.search(restored):
        return None
    if len(seen) != len(variables):
        return None
    return restored


async def _translate_field(llm: Any, text: str, target: str) -> str:
    """Translate one field, raising rather than returning something unusable."""
    protected, variables = _protect_variables(text)
    context = LLMContext([{"role": "user", "content": protected}])
    response = await llm.run_inference(
        context,
        system_instruction=_SYSTEM_PROMPT.format(
            target=target,
            markers=_MARKER_INSTRUCTION if variables else "",
        ),
    )

    if not response or not response.strip():
        raise ValueError("the model returned nothing")

    restored = _restore_variables(response.strip(), variables)
    if restored is None:
        raise ValueError("a template variable did not survive translation")
    return restored


def _translatable_fields(nodes: List[Any]) -> List[Tuple[int, str, str]]:
    found: List[Tuple[int, str, str]] = []
    for index, node in enumerate(nodes):
        if not isinstance(node, dict):
            continue
        data = node.get("data")
        if not isinstance(data, dict):
            continue
        for field in _TRANSLATABLE_FIELDS:
            value = data.get(field)
            if isinstance(value, str) and value.strip():
                found.append((index, field, value))
    return found


async def translate_definition(
    workflow_definition: Dict[str, Any],
    language: Optional[str],
    *,
    organization_id: Optional[int],
) -> Dict[str, Any]:
    """Return ``workflow_definition`` with its model-facing text translated.

    Returns the definition untouched — the same object — when there is nothing
    to translate into, nothing to translate, or no model to translate with.
    Fields that fail individually keep their original text; the caller cannot
    tell a translated definition from an untouched one except by reading it,
    which is the point: neither outcome is an error.
    """
    target = _TARGET_LANGUAGES.get(language or "")
    if target is None:
        return workflow_definition

    nodes = workflow_definition.get("nodes")
    if not isinstance(nodes, list):
        return workflow_definition

    fields = _translatable_fields(nodes)
    if not fields:
        return workflow_definition

    try:
        resolved = await get_resolved_ai_model_configuration(
            organization_id=organization_id
        )
        if resolved.effective.llm is None:
            logger.info(
                "[Template translation] No LLM configured for organization "
                f"{organization_id}; leaving the generated prompts as they are"
            )
            return workflow_definition
        llm = create_llm_service(resolved.effective, usage_context="translation")
    except Exception as error:
        logger.warning(
            f"[Template translation] Could not build a model to translate with: {error}"
        )
        return workflow_definition

    # One call per field, concurrently: a template has a handful of them, and
    # a field's failure is then its own rather than the whole definition's.
    async def _attempt(index: int, field: str, text: str) -> Optional[str]:
        try:
            return await _translate_field(llm, text, target)
        except Exception as error:
            logger.warning(
                f"[Template translation] Left node {index} field {field!r} in "
                f"English: {error}"
            )
            return None

    translated = await asyncio.gather(
        *(_attempt(index, field, text) for index, field, text in fields)
    )

    for (index, field, _), result in zip(fields, translated):
        if result is not None:
            nodes[index]["data"][field] = result

    return workflow_definition
