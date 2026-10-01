"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { DisabledNotice } from "./shared";

export function AiSimulatorPlaceholder({
    disabledReason,
}: {
    disabledReason: string | null;
}) {
    const { t } = useTranslation();
    const [simulatorPrompt, setSimulatorPrompt] = useState(
        "Act like a skeptical prospect. Push on pricing, ask about integrations, and end the chat if the assistant becomes repetitive.",
    );

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
            {disabledReason ? <DisabledNotice reason={disabledReason} /> : null}
            <p className="text-sm text-muted-foreground">
                {t("workflow.tester.chat.simulatorHelp")}
            </p>
            <Textarea
                value={simulatorPrompt}
                onChange={(event) => setSimulatorPrompt(event.target.value)}
                placeholder={t("workflow.tester.chat.simulatorPlaceholder")}
                className="min-h-32 resize-none text-sm leading-6"
            />
            <Button size="sm" disabled className="self-start">
                <Sparkles className="h-4 w-4" />
                {t("workflow.tester.chat.comingSoon")}
            </Button>
        </div>
    );
}
