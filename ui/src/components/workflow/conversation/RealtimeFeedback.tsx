"use client";

import { useTranslation } from "react-i18next";

import {
    conversationItemsFromLiveFeedback,
    conversationItemsFromRealtimeFeedbackEvents,
} from "./adapters/fromRealtimeFeedback";
import { ConversationContainer } from "./ConversationContainer";
import { ConversationTimeline } from "./ConversationTimeline";
import type {
    ConversationStatus,
    RealtimeFeedbackMessage,
    WorkflowRunLogs,
} from "./types";
import { countConversationMessages } from "./utils";

interface LiveModeProps {
    mode: "live";
    messages: RealtimeFeedbackMessage[];
    isCallActive: boolean;
    isCallCompleted: boolean;
}

interface HistoricalModeProps {
    mode: "historical";
    logs: WorkflowRunLogs | null;
}

type RealtimeFeedbackProps = LiveModeProps | HistoricalModeProps;

export function RealtimeFeedback(props: RealtimeFeedbackProps) {
    const { t } = useTranslation();
    let items;
    let status: ConversationStatus;
    let title: string;
    let emptyState: { title: string; subtitle: string };
    let autoScroll = false;

    if (props.mode === "historical") {
        items = props.logs?.realtime_feedback_events
            ? conversationItemsFromRealtimeFeedbackEvents(props.logs.realtime_feedback_events, t)
            : [];
        status = "ended";
        title = t("conversation.realtime.historicalTitle");
        emptyState = {
            title: t("conversation.realtime.historicalEmptyTitle"),
            subtitle: t("conversation.realtime.historicalEmptySubtitle"),
        };
    } else {
        items = conversationItemsFromLiveFeedback(props.messages, t);
        status = props.isCallActive ? "live" : props.isCallCompleted ? "ended" : "ready";
        title = t("conversation.realtime.liveTitle");
        emptyState = {
            title: t("conversation.realtime.liveEmptyTitle"),
            subtitle: props.isCallActive
                ? t("conversation.realtime.liveEmptyActiveSubtitle")
                : t("conversation.realtime.liveEmptyIdleSubtitle"),
        };
        autoScroll = true;
    }

    return (
        <ConversationContainer
            title={title}
            status={status}
            messageCount={countConversationMessages(items) || undefined}
        >
            <ConversationTimeline
                items={items}
                autoScroll={autoScroll}
                emptyState={emptyState}
            />
        </ConversationContainer>
    );
}
