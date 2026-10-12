"""Which voice an agent speaks with, chosen from the language it was given.

A workflow picks the language its agent speaks (``zh`` / ``en`` / ``auto``), but
the voice has always come from the organization's model configuration — one
voice for every agent in the organization, whatever language each was for. An
English agent could therefore be handed a Chinese voice, and nothing in the
product connected the two. This connects them, where it safely can.

"Where it safely can" is most of the point. A voice and a language have to
agree: Google's Chirp 3 HD voice ids carry the locale in the id itself, Azure
rejects a voice from another locale, and neither of them falls back — the
synthesis fails. A wrongly paired voice therefore turns an agent that worked
into one that says nothing, which is worse than leaving it as it was. So the
table below holds only pairs whose voice id comes from the vendor's own
published voice list, and a provider that is absent from it keeps the
organization's voice and behaviour exactly as before.

Two things this deliberately does not do:

- ``auto`` never switches a voice. Following the caller means the language is
  not known until someone speaks, and the voice is chosen when the call is set
  up. Such an agent keeps the organization's voice and follows the caller in
  its prompt, which is what the language rule already arranges.
- It does not overrule a workflow that chose its own tts settings. Those arrive
  as a model override and are applied before this runs; see
  ``own_tts_override``.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from api.schemas.ai_model_configuration import EffectiveAIModelConfiguration

# provider -> language -> the tts fields to set. Keys are the provider config's
# own field names (`voice`, `language`); a field a provider does not define is
# skipped rather than forced onto it.
#
# Bailian's entries come from Aliyun's published CosyVoice v2 voice list. The
# zh voice is the one this repository already ships in
# `api/services/configuration/options/bailian.py` and the one the deployment
# this was written for runs, so a zh agent keeps the voice it had. The en voice
# is one of that list's American-English voices; CosyVoice voices also carry a
# gender, and longxiaochun_v2 is a female voice, so this picks the female
# American-English one to keep an organization's agents sounding consistent
# across the two languages. Any other id from that list works as well.
LANGUAGE_VOICES: Dict[str, Dict[str, Dict[str, str]]] = {
    "bailian": {
        "zh": {"voice": "longxiaochun_v2"},
        "en": {"voice": "loongava_v2"},
    },
}


def apply_language_voice(
    effective: EffectiveAIModelConfiguration,
    language: Optional[str],
    *,
    own_tts_override: bool = False,
) -> EffectiveAIModelConfiguration:
    """Return ``effective`` with its tts voice matched to ``language``.

    A no-op — the same object, untouched — whenever there is nothing defensible
    to change: no language on the workflow, a language with no entry for this
    provider (``auto`` included), no tts section at all, or a workflow that
    brought its own tts settings.

    Mutates and returns ``effective``, the way ``resolve_effective_config``
    does; the object is built fresh per call.
    """
    if own_tts_override or not language:
        return effective

    tts = effective.tts
    if tts is None:
        return effective

    fields: Any = LANGUAGE_VOICES.get(tts.provider, {}).get(language)
    if not fields:
        return effective

    # Only the fields this provider's config actually defines — a table entry
    # is data, and data must not be able to make a provider's config invalid.
    applicable = {k: v for k, v in fields.items() if k in type(tts).model_fields}
    if not applicable:
        return effective

    effective.tts = tts.model_copy(update=applicable)
    return effective
