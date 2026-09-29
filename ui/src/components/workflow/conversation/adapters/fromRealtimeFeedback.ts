import type {
    ConversationItem,
    LatencyBreakdown,
    RealtimeFeedbackEvent,
    RealtimeFeedbackMessage,
} from "../types";

/** Map a pipecat processor name to a latency category.
 * "TencentASRService" has no "STT" in it, so ASR is matched too;
 * "STTS" contains "TTS", so STT/ASR must be tested first. */
function latencyCategory(processor?: string): keyof LatencyBreakdown | null {
    if (!processor) return null;
    if (processor.includes("STT")) return "stt";
    if (processor.includes("ASR")) return "stt";
    if (processor.includes("TTS")) return "tts";
    if (processor.includes("LLM")) return "llm";
    return null;
}

/** Record a TTFB metric; the first value per category wins (a turn can emit
 * several TTS TTFBs, one per sentence, and the first is what the user waits on). */
function recordLatency(pending: LatencyBreakdown, processor: string | undefined, seconds?: number) {
    const category = latencyCategory(processor);
    if (category && seconds !== undefined && pending[category] === undefined) {
        pending[category] = seconds * 1000;
    }
}

function hasLatency(pending: LatencyBreakdown) {
    return pending.stt !== undefined || pending.llm !== undefined || pending.tts !== undefined;
}

/** Backfill a late TTS TTFB onto the most recent assistant output. TTS first
 * audio can arrive after the turn's bot text was already emitted, so the
 * pending accumulator has been consumed; patch the item that is still
 * missing it. Returns false when this turn has no assistant output yet (the
 * metric should go into the pending accumulator instead). */
function backfillTtsLatency(items: ConversationItem[], seconds: number): boolean {
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        if (item.kind === "message" && item.role === "user") return false;
        if (item.kind === "tool-call" || (item.kind === "message" && item.role === "assistant")) {
            if (item.latencyMs?.tts === undefined) {
                item.latencyMs = { ...item.latencyMs, tts: seconds * 1000 };
            }
            return true;
        }
    }
    return false;
}

function feedbackEventText(event: RealtimeFeedbackEvent) {
    return (
        event.payload.text ??
        event.payload.error ??
        (typeof event.payload.result === "string" ? event.payload.result : undefined) ??
        event.payload.function_name ??
        event.payload.node_name ??
        ""
    );
}

function liveFeedbackItem(
    message: RealtimeFeedbackMessage,
    reasoningDurationMs?: number,
    latencyMs?: LatencyBreakdown,
): ConversationItem | null {
    if (message.type === "ttfb-metric") {
        return null;
    }

    if (message.type === "user-transcription") {
        return {
            kind: "message",
            id: message.id,
            timestamp: message.timestamp,
            role: "user",
            text: message.text,
            final: message.final,
        };
    }

    if (message.type === "bot-text") {
        return {
            kind: "message",
            id: message.id,
            timestamp: message.timestamp,
            role: "assistant",
            text: message.text,
            final: message.final,
            reasoningDurationMs,
            latencyMs,
        };
    }

    if (message.type === "function-call") {
        return {
            kind: "tool-call",
            id: message.id,
            timestamp: message.timestamp,
            functionName: message.functionName ?? "tool",
            toolCallId: message.toolCallId,
            arguments: message.arguments,
            result: message.result,
            status: message.status ?? "completed",
            reasoningDurationMs,
            latencyMs,
        };
    }

    if (message.type === "node-transition") {
        return {
            kind: "node-transition",
            id: message.id,
            timestamp: message.timestamp,
            nodeId: message.nodeId,
            nodeName: message.nodeName ?? message.text,
            previousNodeId: message.previousNodeId,
            previousNodeName: message.previousNode,
            allowInterrupt: message.allowInterrupt,
        };
    }

    if (message.type === "interrupt-warning") {
        return {
            kind: "notice",
            id: message.id,
            timestamp: message.timestamp,
            tone: "warning",
            title: "Interruption Disabled",
            text: message.text,
            linkHref: "https://docs.dograh.com/configurations/interruption",
            linkLabel: "Learn more",
        };
    }

    if (message.type === "pipeline-error") {
        return {
            kind: "notice",
            id: message.id,
            timestamp: message.timestamp,
            tone: "error",
            title: message.fatal ? "Fatal Pipeline Error" : "Pipeline Error",
            text: message.text,
            fatal: message.fatal,
        };
    }

    return null;
}

export function conversationItemsFromLiveFeedback(messages: RealtimeFeedbackMessage[]) {
    const items: ConversationItem[] = [];
    let pendingLatency: LatencyBreakdown = {};

    messages.forEach((message) => {
        if (message.type === "ttfb-metric") {
            // First-audio TTFB usually lands after this turn's bot text has
            // consumed the pending accumulator; patch the message directly.
            if (
                latencyCategory(message.processor) === "tts" &&
                message.ttfbSeconds !== undefined &&
                pendingLatency.tts === undefined &&
                backfillTtsLatency(items, message.ttfbSeconds)
            ) {
                return;
            }
            recordLatency(pendingLatency, message.processor, message.ttfbSeconds);
            return;
        }

        const item = liveFeedbackItem(
            message,
            pendingLatency.llm,
            hasLatency(pendingLatency) ? { ...pendingLatency } : undefined,
        );
        if (!item) {
            return;
        }

        items.push(item);

        // Latencies attach to the next assistant output; user transcriptions
        // must not consume them (STT TTFB arrives with the final transcript).
        if (item.kind === "tool-call" || (item.kind === "message" && item.role === "assistant")) {
            pendingLatency = {};
        }
    });

    return items;
}

export function conversationItemsFromRealtimeFeedbackEvents(events: RealtimeFeedbackEvent[]) {
    const items: ConversationItem[] = [];
    const toolCallIndexById = new Map<string, number>();
    let pendingLatency: LatencyBreakdown = {};
    let currentBotItemIndex: number | null = null;
    let currentBotTurn: number | null = null;

    events.forEach((event, index) => {
        if (event.type === "rtf-ttfb-metric") {
            // First-audio TTFB usually lands after this turn's bot text has
            // consumed the pending accumulator; patch the message directly.
            if (
                latencyCategory(event.payload.processor) === "tts" &&
                event.payload.ttfb_seconds !== undefined &&
                pendingLatency.tts === undefined &&
                backfillTtsLatency(items, event.payload.ttfb_seconds)
            ) {
                return;
            }
            recordLatency(pendingLatency, event.payload.processor, event.payload.ttfb_seconds);
            return;
        }

        if (event.type === "rtf-user-transcription") {
            currentBotItemIndex = null;
            currentBotTurn = null;
            items.push({
                kind: "message",
                id: `user-${event.turn}-${index}`,
                timestamp: event.timestamp,
                role: "user",
                text: feedbackEventText(event),
                final: event.payload.final,
            });
            return;
        }

        if (event.type === "rtf-bot-text") {
            const text = feedbackEventText(event);
            const lastItem = currentBotItemIndex !== null ? items[currentBotItemIndex] : null;

            if (
                currentBotItemIndex !== null &&
                currentBotTurn === event.turn &&
                lastItem?.kind === "message" &&
                lastItem.role === "assistant"
            ) {
                items[currentBotItemIndex] = {
                    ...lastItem,
                    text: `${lastItem.text} ${text}`.trim(),
                };
                return;
            }

            items.push({
                kind: "message",
                id: `bot-${event.turn}-${index}`,
                timestamp: event.timestamp,
                role: "assistant",
                text,
                final: event.payload.final,
                reasoningDurationMs: pendingLatency.llm,
                latencyMs: hasLatency(pendingLatency) ? { ...pendingLatency } : undefined,
            });
            currentBotItemIndex = items.length - 1;
            currentBotTurn = event.turn;
            pendingLatency = {};
            return;
        }

        currentBotItemIndex = null;
        currentBotTurn = null;

        if (event.type === "rtf-function-call-start") {
            const toolCallId = event.payload.tool_call_id;
            items.push({
                kind: "tool-call",
                id: toolCallId ?? `tool-${event.turn}-${index}`,
                timestamp: event.timestamp,
                functionName: event.payload.function_name ?? "tool",
                toolCallId,
                arguments: event.payload.arguments,
                status: "running",
                reasoningDurationMs: pendingLatency.llm,
                latencyMs: hasLatency(pendingLatency) ? { ...pendingLatency } : undefined,
            });
            if (toolCallId) {
                toolCallIndexById.set(toolCallId, items.length - 1);
            }
            pendingLatency = {};
            return;
        }

        if (event.type === "rtf-function-call-end") {
            const toolCallId = event.payload.tool_call_id;
            const existingIndex = toolCallId ? toolCallIndexById.get(toolCallId) : undefined;

            if (existingIndex !== undefined) {
                const existingItem = items[existingIndex];
                if (existingItem?.kind === "tool-call") {
                    items[existingIndex] = {
                        ...existingItem,
                        status: "completed",
                        result: event.payload.result,
                    };
                }
                return;
            }

            items.push({
                kind: "tool-call",
                id: toolCallId ?? `tool-result-${event.turn}-${index}`,
                timestamp: event.timestamp,
                functionName: event.payload.function_name ?? "tool",
                toolCallId,
                result: event.payload.result,
                status: "completed",
                reasoningDurationMs: pendingLatency.llm,
                latencyMs: hasLatency(pendingLatency) ? { ...pendingLatency } : undefined,
            });
            pendingLatency = {};
            return;
        }

        if (event.type === "rtf-node-transition") {
            items.push({
                kind: "node-transition",
                id: `node-${event.turn}-${index}`,
                timestamp: event.timestamp,
                nodeId: event.payload.node_id,
                nodeName: event.payload.node_name ?? feedbackEventText(event) ?? "Node",
                previousNodeId: event.payload.previous_node_id,
                previousNodeName: event.payload.previous_node_name ?? event.payload.previous_node,
                allowInterrupt: event.payload.allow_interrupt,
            });
            return;
        }

        if (event.type === "rtf-interrupt-warning") {
            items.push({
                kind: "notice",
                id: `warning-${event.turn}-${index}`,
                timestamp: event.timestamp,
                tone: "warning",
                title: "Interruption Disabled",
                text: feedbackEventText(event),
                linkHref: "https://docs.dograh.com/configurations/interruption",
                linkLabel: "Learn more",
            });
            return;
        }

        if (event.type === "rtf-pipeline-error") {
            items.push({
                kind: "notice",
                id: `error-${event.turn}-${index}`,
                timestamp: event.timestamp,
                tone: "error",
                title: event.payload.fatal ? "Fatal Pipeline Error" : "Pipeline Error",
                text: feedbackEventText(event),
                fatal: event.payload.fatal,
            });
        }
    });

    return items;
}
