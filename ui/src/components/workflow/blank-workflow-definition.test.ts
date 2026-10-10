import { describe, expect, it } from 'vitest';

import {
    buildBlankWorkflowDefinition,
    DEFAULT_AGENT_LANGUAGE,
    type AgentLanguage,
} from './blank-workflow-definition';

// Mirrors _INSTRUCTIONS in api/services/workflow/language.py. The backend
// rewrites the "- Language:" line at creation time, so these strings must stay
// byte-identical or the saved prompt ends up with two competing rules.
const LANGUAGE_RULES: Record<AgentLanguage, string> = {
    zh: '始终使用简体中文与对方交流,即使对方使用其他语言,也用中文回应。',
    en: 'Always respond in English, regardless of the language the caller uses.',
    auto: 'Always respond in the same language the caller is speaking; if they switch languages, follow them.',
};

const promptFor = (language: AgentLanguage): string =>
    (buildBlankWorkflowDefinition(language).nodes[0].data as { prompt: string }).prompt;

describe('buildBlankWorkflowDefinition', () => {
    it('defaults to Chinese', () => {
        expect(DEFAULT_AGENT_LANGUAGE).toBe('zh');
    });

    it.each<AgentLanguage>(['zh', 'en', 'auto'])(
        'writes the %s language rule on its own "- Language:" line',
        (language) => {
            const lines = promptFor(language).split('\n');

            expect(lines).toContain(`- Language: ${LANGUAGE_RULES[language]}`);
        },
    );

    it('never ships the retired UK English rule', () => {
        for (const language of ['zh', 'en', 'auto'] as AgentLanguage[]) {
            expect(promptFor(language)).not.toContain('UK English');
        }
    });

    it('localizes the Chinese prompt body for the model', () => {
        const prompt = promptFor('zh');

        expect(prompt).toContain('# 目标');
        expect(prompt).toContain('- 回答简短');
        expect(prompt).toContain('先用"你好"开场');
    });

    it('keeps the single startCall node scaffolding shared by every language', () => {
        const zh = buildBlankWorkflowDefinition('zh');
        const en = buildBlankWorkflowDefinition('en');

        expect(zh.edges).toEqual([]);
        expect(zh.viewport).toEqual({ x: 808, y: 269, zoom: 0.75 });
        expect(zh.nodes).toHaveLength(1);
        expect(zh.nodes[0]).toMatchObject({
            id: '1',
            type: 'startCall',
            data: { name: 'start call', is_start: true, add_global_prompt: false },
        });

        // Only the prompt differs between languages.
        const { prompt: _zhPrompt, ...zhRest } = zh.nodes[0].data as Record<string, unknown>;
        const { prompt: _enPrompt, ...enRest } = en.nodes[0].data as Record<string, unknown>;
        expect(zhRest).toEqual(enRest);
    });

    it('falls back to the Chinese prompt for an unknown language', () => {
        expect(promptFor('fr' as AgentLanguage)).toBe(promptFor('zh'));
    });
});