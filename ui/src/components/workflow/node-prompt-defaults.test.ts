import { describe, expect, it } from 'vitest';

import { NodeType } from '@/components/flow/types';
import { nodePromptDefault } from '@/components/workflow/node-prompt-defaults';

// Byte-identical to GlobalNodeData.prompt's spec_default on the backend
// (api/services/workflow/dto.py). An English workflow must read exactly as it
// did before this file existed.
const SPEC_DEFAULT =
    "You are a helpful assistant whose mode of interaction with the user is voice. So don't use any special characters which can not be pronounced. Use short sentences and simple language.";

describe('nodePromptDefault', () => {
    it('writes the global node prompt in the agent language', () => {
        const zh = nodePromptDefault(NodeType.GLOBAL_NODE, 'zh', SPEC_DEFAULT);

        expect(zh).not.toBe(SPEC_DEFAULT);
        expect(zh).toContain('智能助手');
        // The rule line belongs to the backend, which upserts it on save; a
        // second one here would be the competing rule that mechanism prevents.
        expect(zh).not.toContain('Language:');
    });

    it('leaves the English default byte-identical to the spec', () => {
        expect(nodePromptDefault(NodeType.GLOBAL_NODE, 'en', SPEC_DEFAULT)).toBe(
            SPEC_DEFAULT,
        );
    });

    it('follows the blank canvas for "follow the caller"', () => {
        // The blank canvas writes an English body with an auto rule line, since
        // the language is not known until someone speaks.
        expect(nodePromptDefault(NodeType.GLOBAL_NODE, 'auto', SPEC_DEFAULT)).toBe(
            SPEC_DEFAULT,
        );
    });

    it('leaves a workflow with no language alone', () => {
        // Those predate the setting, get no rule injected at runtime, and must
        // keep behaving exactly as they did.
        expect(nodePromptDefault(NodeType.GLOBAL_NODE, null, SPEC_DEFAULT)).toBe(
            SPEC_DEFAULT,
        );
        expect(nodePromptDefault(NodeType.GLOBAL_NODE, undefined, SPEC_DEFAULT)).toBe(
            SPEC_DEFAULT,
        );
    });

    it('only touches the global node', () => {
        for (const type of [NodeType.START_CALL, NodeType.AGENT_NODE, NodeType.END_CALL]) {
            expect(nodePromptDefault(type, 'zh', SPEC_DEFAULT)).toBe(SPEC_DEFAULT);
        }
    });

    it('passes through anything that is not a prompt', () => {
        expect(nodePromptDefault(NodeType.GLOBAL_NODE, 'zh', undefined)).toBeUndefined();
        expect(nodePromptDefault(NodeType.GLOBAL_NODE, 'zh', null)).toBeNull();
        expect(nodePromptDefault(NodeType.GLOBAL_NODE, 'zh', '')).toBe('');
    });
});
