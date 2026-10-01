"use client";

import { Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatComposerProps {
    composerId: string;
    draft: string;
    ready: boolean;
    ended: boolean;
    editing: boolean;
    sendingMessage: boolean;
    inputDisabled: boolean;
    onDraftChange: (value: string) => void;
    onCancelEditing: () => void;
    onSubmit: () => Promise<void> | void;
}

export function ChatComposer({
    composerId,
    draft,
    ready,
    ended,
    editing,
    sendingMessage,
    inputDisabled,
    onDraftChange,
    onCancelEditing,
    onSubmit,
}: ChatComposerProps) {
    const { t } = useTranslation();
    return (
        <div className="pt-3">
            {editing ? (
                <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
                    <span>{t("workflow.tester.chat.editHint")}</span>
                    <button
                        type="button"
                        onClick={onCancelEditing}
                        className="inline-flex items-center gap-1 rounded text-foreground hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                        <X className="h-3.5 w-3.5" />
                        {t("common.cancel")}
                    </button>
                </div>
            ) : null}
            <div className="relative">
                <Textarea
                    id={composerId}
                    value={draft}
                    onChange={(event) => onDraftChange(event.target.value)}
                    placeholder={ended ? t("workflow.tester.chat.placeholderEnded") : ready ? (editing ? t("workflow.tester.chat.placeholderEdit") : t("workflow.tester.chat.placeholderSend")) : t("workflow.tester.chat.placeholderPreparing")}
                    rows={1}
                    className="min-h-11! resize-none pr-20 text-sm leading-6"
                    disabled={inputDisabled}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            if (sendingMessage) return;
                            void onSubmit();
                        }
                    }}
                />
                <Button
                    type="button"
                    size="sm"
                    onClick={() => void onSubmit()}
                    disabled={inputDisabled || sendingMessage || !draft.trim()}
                    className="absolute bottom-1.5 right-1.5 h-8 px-4"
                >
                    {sendingMessage ? (
                        <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            {editing ? t("workflow.tester.chat.rerunning") : t("workflow.tester.chat.sending")}
                        </>
                    ) : (
                        editing ? t("workflow.tester.chat.rerun") : t("workflow.tester.chat.send")
                    )}
                </Button>
            </div>
        </div>
    );
}
