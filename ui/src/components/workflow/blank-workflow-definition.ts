// Prompt text shipped with a freshly created "blank canvas" workflow.
//
// This is model-facing production text, not UI copy: it is written in the
// language the agent should speak and must NOT be routed through the UI i18n
// dictionaries (an English UI must still be able to create a Chinese agent).
//
// The "- Language:" bullet deliberately keeps its English label for every
// language: the backend rewrites that exact anchor at creation time
// (api/services/workflow/language.py, `_LANGUAGE_RULE_RE`), so using any other
// label would leave two competing rules in the prompt. Keep the instruction
// text here byte-identical to `_INSTRUCTIONS` there.

import { DEFAULT_AGENT_LANGUAGE } from "@/types/workflow-configurations";
import type { AgentLanguage } from "@/types/workflow-configurations";

export { DEFAULT_AGENT_LANGUAGE };
export type { AgentLanguage };

const ZH_RULE = "始终使用简体中文与对方交流,即使对方使用其他语言,也用中文回应。";
const EN_RULE = "Always respond in English, regardless of the language the caller uses.";
const AUTO_RULE =
    "Always respond in the same language the caller is speaking; if they switch languages, follow them.";

const ZH_PROMPT = `# 目标
你是一位通过语音与真人对话的智能助手。这是语音通话,转写文本可能有误。

## 规则
- Language: ${ZH_RULE}
- 回答简短,最多 2-3 句话
- 如果需要重复前两轮说过的内容,换一种说法表达相同的意思,不要重复完全相同的措辞。

## 语音处理
- 转写可能有多种错误
- 接受各种说法:是/对/嗯/好的,不/不是/不用
- 如果用户说"抱歉?"、"你说什么?"、"能再说一遍吗?",可能是没听清——把刚才的话再说一遍。

### 流程
先用"你好"开场。保持礼貌和热情。`;

const EN_PROMPT = `# Goal
You are a helpful agent who is handing a conversation over voice with a human. This is a voice conversation, so transcripts can be error prone.

## Rules
- Language: ${EN_RULE}
- Keep responses short and 2-3 sentences max
- If you have to repeat something that you said in your previous two turns, then rephrase a bit while keeping the same meaning. Never repeat the exact same words as in your previous 2 responses.

## Speech Handling
- There could be multiple transcription errors.
- Accept variations: yes/yeah/yep/aye, no/nah/nope
- If user says "sorry?" or "pardon me" or "can you repeat"  or "what?", they might not have heard you- so just repeat what you just said.

### Flow
Start by saying "Hi". Be polite and courteous. `;

const AUTO_PROMPT = `# Goal
You are a helpful agent who is handing a conversation over voice with a human. This is a voice conversation, so transcripts can be error prone.

## Rules
- Language: ${AUTO_RULE}
- Keep responses short and 2-3 sentences max
- If you have to repeat something that you said in your previous two turns, then rephrase a bit while keeping the same meaning. Never repeat the exact same words as in your previous 2 responses.

## Speech Handling
- There could be multiple transcription errors.
- Accept variations: yes/yeah/yep/aye, no/nah/nope
- If user says "sorry?" or "pardon me" or "can you repeat"  or "what?", they might not have heard you- so just repeat what you just said.

### Flow
Start by saying "Hi". Be polite and courteous. `;

const PROMPTS: Record<AgentLanguage, string> = {
    zh: ZH_PROMPT,
    en: EN_PROMPT,
    auto: AUTO_PROMPT,
};

/** A single startCall node carrying the opening prompt for `language`. */
export function buildBlankWorkflowDefinition(language: AgentLanguage) {
    return {
        nodes: [
            {
                id: "1",
                type: "startCall",
                position: { x: 175, y: 60 },
                data: {
                    prompt: PROMPTS[language] ?? ZH_PROMPT,
                    name: "start call",
                    allow_interrupt: false,
                    invalid: false,
                    validationMessage: null,
                    add_global_prompt: false,
                    delayed_start: false,
                    is_start: true,
                    selected_through_edge: false,
                    hovered_through_edge: false,
                    extraction_enabled: false,
                    selected: false,
                    dragging: false,
                },
            },
        ],
        edges: [],
        viewport: { x: 808, y: 269, zoom: 0.75 },
    };
}