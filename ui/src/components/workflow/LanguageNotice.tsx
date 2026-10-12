'use client';

import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { AgentLanguage } from '@/types/workflow-configurations';

/**
 * The half of the speech path that picking a language does not cover.
 *
 * The voice follows: the backend matches it to the agent's language where the
 * text-to-speech provider publishes a voice for it, so an English agent no
 * longer speaks with the organization's Chinese voice. Transcription does not
 * follow — it still comes from the organization's model configuration — so a
 * non-Chinese agent can be listened to by a Chinese recognizer until someone
 * changes that in Model configuration.
 */
export function LanguageNotice({ language }: { language: AgentLanguage }) {
    const { t } = useTranslation();

    if (language === 'zh') return null;

    return (
        <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>{t('workflow.language.ttsNotice')}</span>
        </p>
    );
}
