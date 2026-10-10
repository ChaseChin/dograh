'use client';

import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { AgentLanguage } from '@/types/workflow-configurations';

/**
 * Tells the user that picking a non-Chinese agent language does not switch the
 * speech engines yet: TTS and STT still come from the organization's model
 * configuration, so an English agent can be paired with a Chinese voice unless
 * the user changes that separately.
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