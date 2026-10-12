"""The voice-prompting guide, pointed at the agent's language.

The guide is advice *to* the authoring LLM, so its own English is fine. What is
not fine is the LLM copying its template verbatim into a Chinese agent, which
is what happened before this: the global-node template carried a literal
"Language: respond in the caller's language. Default English." line and English
examples, and the author was never told what language the agent was for.
"""

from api.mcp_server.tools.voice_prompting_guide import _in_language

# The line the global-node template has always carried.
GUIDE_CONTENT = (
    "Template:\n\n#goal\nYou are the voice of Acme Rent Auto.\n\n"
    "## Rules\n"
    "Language: respond in the caller's language. Default English.\n"
    'If unclear: "Sorry, can you repeat that?"\n'
)


def test_the_rule_line_is_rewritten_for_the_agent_language():
    content = _in_language(GUIDE_CONTENT, "zh")

    assert "简体中文" in content
    assert "Default English" not in content
    # The template itself is still there for the author to adapt.
    assert "#goal" in content
    assert "Acme Rent Auto" in content


def test_the_author_is_told_which_language_to_write_in():
    """Rewriting the rule line alone would leave the author copying English
    examples into a Chinese agent — the rule line does not cover prose."""
    content = _in_language(GUIDE_CONTENT, "en")

    assert "Write the whole template in the agent's language" in content


def test_without_a_language_the_content_is_untouched():
    """The tool is also called without one (a caller that does not know the
    agent yet), and must not invent an answer."""
    assert _in_language(GUIDE_CONTENT, None) == GUIDE_CONTENT
    assert _in_language(GUIDE_CONTENT, "") == GUIDE_CONTENT
    assert _in_language(GUIDE_CONTENT, "fr") == GUIDE_CONTENT
