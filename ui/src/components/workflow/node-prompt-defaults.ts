// Default prompt text for nodes added after the workflow exists, written in the
// workflow's agent language.
//
// Same rule as blank-workflow-definition.ts: this is text the model reads, so
// it is written in the language the agent should speak and must NOT be routed
// through the UI i18n dictionaries — an English UI must still be able to build
// a Chinese agent.
//
// Only the global node is localized here. It is the one node type whose spec
// carries a non-empty prompt default (api/services/workflow/dto.py,
// GlobalNodeData.prompt) and the one whose text is prepended to every prompted
// node's system prompt, so it is the only default that both reaches the live
// prompt and is worth writing in the right language. Every other node starts
// with an empty prompt for the user to write.
//
// No "- Language:" rule belongs in this text: the backend writes that line into
// every prompt-bearing node when the workflow is saved (api/services/workflow/
// language.py), and a prompt carrying two competing rules is the thing that
// mechanism exists to prevent.

import { NodeType } from '@/components/flow/types';
import type { AgentLanguage } from '@/types/workflow-configurations';

// Byte-identical to GlobalNodeData.prompt's spec_default on the backend, so an
// English workflow added to in the builder reads exactly as it always has.
const EN_GLOBAL_PROMPT =
    "You are a helpful assistant whose mode of interaction with the user is voice. So don't use any special characters which can not be pronounced. Use short sentences and simple language.";

const ZH_GLOBAL_PROMPT =
    '你是一位通过语音与对方交流的智能助手。不要使用任何无法朗读的特殊字符,请使用简短的句子和简单的语言。';

const GLOBAL_NODE_PROMPTS: Record<AgentLanguage, string> = {
    zh: ZH_GLOBAL_PROMPT,
    en: EN_GLOBAL_PROMPT,
    // "Follow the caller" has no language of its own to write in, so it keeps
    // the English body and lets the injected rule pick the language per call —
    // the same choice the blank canvas makes for its opening prompt.
    auto: EN_GLOBAL_PROMPT,
};

/**
 * The prompt a node of `type` should start life with, in `language`.
 *
 * Returns `specDefault` unchanged for any node type this does not localize,
 * and — just as deliberately — for a workflow with no language set. Those
 * predate the setting, get no rule injected at runtime, and have to keep
 * behaving exactly as they did.
 */
export function nodePromptDefault(
    type: string,
    language: AgentLanguage | null | undefined,
    specDefault: unknown,
): unknown {
    if (type !== NodeType.GLOBAL_NODE || !language) return specDefault;
    if (typeof specDefault !== 'string' || !specDefault) return specDefault;
    return GLOBAL_NODE_PROMPTS[language] ?? specDefault;
}
