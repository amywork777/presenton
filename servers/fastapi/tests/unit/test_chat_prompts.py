from services.chat.prompts import _trim_block, build_system_prompt
from services.chat.v2.prompts import build_template_v2_system_prompt


def test_trim_block_returns_empty_for_blank_text():
    assert _trim_block("label", "") == ""
    assert _trim_block("label", "   \n\t") == ""


def test_build_system_prompt_includes_trimmed_memory_blocks():
    system_prompt = build_system_prompt(
        presentation_memory_context="  Prior deck decision  ",
        chat_memory_context="\nEarlier user request\n",
    )

    assert "Deck memory (semantic / long-term" in system_prompt
    assert "Chat memory (earlier messages in this conversation only):" in system_prompt
    assert "\nPrior deck decision\n" in system_prompt
    assert "\nEarlier user request\n" in system_prompt


def test_build_system_prompt_omits_empty_memory_blocks():
    system_prompt = build_system_prompt("", " ")

    assert "Deck memory (semantic / long-term" not in system_prompt
    assert "Chat memory (earlier messages in this conversation only):" not in system_prompt
    assert "Tool-use protocol (live SQL slide data)" in system_prompt


def test_build_template_v2_system_prompt_includes_structured_tool_guidance():
    system_prompt = build_template_v2_system_prompt(
        template_context="  Slide 1 has a hero component.  ",
        chat_memory_context="\nUse concise labels.\n",
    )

    assert "Operating priorities" in system_prompt
    assert "Source-of-truth policy" in system_prompt
    assert "Layout construction priority" in system_prompt
    assert "existing template blocks/components" in system_prompt
    assert "rectangle, ellipse, or line" in system_prompt
    assert "When to use each tool" in system_prompt
    assert "getEditableElements: use before content edits" in system_prompt
    assert "updateElementContent: use only after" in system_prompt
    assert "\nSlide 1 has a hero component.\n" in system_prompt
    assert "\nUse concise labels.\n" in system_prompt


def test_build_template_v2_system_prompt_omits_empty_context_blocks():
    system_prompt = build_template_v2_system_prompt(
        template_context="",
        chat_memory_context=" ",
    )

    assert "TemplateV2 context (compact live summary" not in system_prompt
    assert "Chat history context (earlier messages in this conversation):" not in system_prompt
    assert "Supported scope" in system_prompt
