"use client";

import { cn } from "@/lib/utils";

import { LatencyLine } from "./LatencyLine";
import type { LatencyBreakdown } from "./types";

interface MessageBubbleProps {
    role: "user" | "assistant";
    text: string;
    final?: boolean;
    tone?: "default" | "muted";
    reasoningDurationMs?: number;
    latencyMs?: LatencyBreakdown;
    containerClassName?: string;
}

export function MessageBubble({
    role,
    text,
    final = true,
    tone = "default",
    reasoningDurationMs,
    latencyMs,
    containerClassName,
}: MessageBubbleProps) {
    const isUser = role === "user";
    const isMuted = tone === "muted";

    return (
        <div className={cn("flex", isUser ? "justify-end" : "justify-start", containerClassName)}>
            <div className="flex max-w-[85%] flex-col gap-1">
                {!isUser ? (
                    <LatencyLine latencyMs={latencyMs} reasoningDurationMs={reasoningDurationMs} />
                ) : null}
                <div
                    className={cn(
                        "whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                        isUser
                            ? "rounded-br-md bg-primary text-primary-foreground"
                            : isMuted
                                ? "rounded-bl-md border border-dashed border-border bg-background text-muted-foreground"
                                : "rounded-bl-md border border-slate-200/80 bg-muted text-foreground",
                        !final && "opacity-70",
                    )}
                >
                    <div>{text}</div>
                    {!final ? (
                        <div
                            className={cn(
                                "mt-1 text-[10px] italic",
                                isUser ? "text-primary-foreground/70" : "text-muted-foreground",
                            )}
                        >
                            speaking...
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
