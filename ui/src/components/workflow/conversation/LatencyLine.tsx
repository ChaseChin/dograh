"use client";

import { Brain, Timer } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

import type { LatencyBreakdown } from "./types";

interface LatencyLineProps {
    latencyMs?: LatencyBreakdown;
    /** Legacy LLM-only reasoning delay; used as a fallback when no breakdown exists. */
    reasoningDurationMs?: number;
    className?: string;
}

/** Per-service TTFB latency line: "ASR 320ms · LLM 450ms · TTS 280ms · Total 1050ms".
 * Falls back to the legacy LLM-only "Reasoning Delay" when only that is known. */
export function LatencyLine({ latencyMs, reasoningDurationMs, className }: LatencyLineProps) {
    const { t } = useTranslation();
    const parts: string[] = [];
    if (latencyMs?.stt !== undefined) parts.push(`ASR ${Math.round(latencyMs.stt)}ms`);
    if (latencyMs?.llm !== undefined) parts.push(`LLM ${Math.round(latencyMs.llm)}ms`);
    if (latencyMs?.tts !== undefined) parts.push(`TTS ${Math.round(latencyMs.tts)}ms`);

    if (parts.length > 0) {
        const total = (latencyMs?.stt ?? 0) + (latencyMs?.llm ?? 0) + (latencyMs?.tts ?? 0);
        parts.push(`${t("conversation.latency.total")} ${Math.round(total)}ms`);
        return (
            <div className={cn("flex items-center gap-1.5 px-1 text-xs text-muted-foreground", className)}>
                <Timer className="h-3 w-3" />
                <span>{parts.join(" · ")}</span>
            </div>
        );
    }

    if (reasoningDurationMs === undefined) {
        return null;
    }

    return (
        <div className={cn("flex items-center gap-1.5 px-1 text-xs text-muted-foreground", className)}>
            <Brain className="h-3 w-3" />
            <span className="font-medium">{t("conversation.latency.reasoningDelay")}</span>
            <span>{Math.round(reasoningDurationMs)}ms</span>
        </div>
    );
}
