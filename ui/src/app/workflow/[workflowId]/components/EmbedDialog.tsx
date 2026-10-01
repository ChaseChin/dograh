"use client";

import { Check, ChevronDown, Copy, ExternalLink, Loader2, MessageCircle, Mic, Plus, Rocket, Send, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
    createOrUpdateEmbedTokenApiV1WorkflowWorkflowIdEmbedTokenPost,
    deactivateEmbedTokenApiV1WorkflowWorkflowIdEmbedTokenDelete,
    getEmbedTokenApiV1WorkflowWorkflowIdEmbedTokenGet,
} from "@/client/sdk.gen";
import type { TextChatInactivityTimeoutConstraints, WidgetTexts } from "@/client/types.gen";
import { Button } from "@/components/ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { WIDGET_CONTEXT_DOC_URL, WIDGET_MODE_DOCUMENTATION_URLS } from "@/constants/documentation";
import { HEADLESS_CHAT_EXAMPLE } from "@/constants/embedExamples";
import { detailFromError } from "@/lib/apiError";
import { copyTextToClipboard } from "@/lib/clipboard";
import type { WorkflowConfigurations } from "@/types/workflow-configurations";

interface EmbedDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workflowId: number;
    workflowName: string;
    workflowConfigurations: WorkflowConfigurations;
    textChatInactivityTimeoutConstraints: TextChatInactivityTimeoutConstraints | null;
    widgetTextDefaults: WidgetTexts | null;
    onSaveWorkflowConfigurations: (
        configurations: WorkflowConfigurations,
        workflowName: string,
    ) => Promise<void>;
}

type WidgetType = "voice" | "chat";

// Per-type defaults, swapped on toggle only when the user hasn't customized
// the text (i.e. it still equals the other type's default).
const WIDGET_TYPE_DEFAULTS: Record<WidgetType, { buttonText: string; callToActionText: string }> = {
    voice: {
        buttonText: "Talk to Agent",
        callToActionText: "Click to start voice conversation",
    },
    chat: {
        buttonText: "Chat with Agent",
        callToActionText: "Click to start chatting",
    },
};

// Visitor-facing copy the agent owner can translate. The default strings live
// only in api/schemas/widget_texts.py — they reach this dialog as placeholders
// via the generated client, and reach the widget already resolved. Everything
// below is presentation: which key goes in which group, and what to call it.
type WidgetTextKey = keyof WidgetTexts;

type WidgetTextHintId = "nextToConfirmation" | "screenReadersOnly" | "pairedWithCta";

interface WidgetTextField {
    key: WidgetTextKey;
    hint?: WidgetTextHintId;
}

// Field labels resolve at render via workflow.embed.fields.<key> — the field
// keys match the i18n leaf names 1:1.
const CHAT_TEXT_FIELDS: WidgetTextField[] = [
    { key: "endChatText" },
    { key: "endChatConfirmText" },
    { key: "endChatCancelText", hint: "nextToConfirmation" },
    { key: "endingChatText" },
    { key: "conversationEndedText" },
    { key: "startNewChatText" },
    { key: "chatRetryText" },
    { key: "chatInputPlaceholder" },
    { key: "sendMessageLabel", hint: "screenReadersOnly" },
    { key: "closeChatLabel", hint: "screenReadersOnly" },
];

// Floating voice widgets only ever show the CTA pill, so they get the button
// labels alone; the status headings below are inline-only.
const VOICE_BUTTON_TEXT_FIELDS: WidgetTextField[] = [
    { key: "voiceConnectingText" },
    { key: "voiceEndCallText" },
    { key: "voiceRetryText" },
];

const VOICE_STATUS_TEXT_FIELDS: WidgetTextField[] = [
    { key: "voiceReadyTitle", hint: "pairedWithCta" },
    { key: "voiceConnectingSubtext" },
    { key: "voiceConnectedTitle" },
    { key: "voiceConnectedSubtext" },
    { key: "voiceCallEndedTitle" },
    { key: "voiceCallEndedSubtext" },
    { key: "voiceConnectionFailedTitle" },
    { key: "voiceConnectionFailedSubtext" },
    { key: "voiceConnectionLostTitle" },
    { key: "voiceConnectionLostSubtext" },
];

const WIDGET_TEXT_KEYS: WidgetTextKey[] = [
    ...CHAT_TEXT_FIELDS,
    ...VOICE_BUTTON_TEXT_FIELDS,
    ...VOICE_STATUS_TEXT_FIELDS,
].map((field) => field.key);

/**
 * Collapsed-by-default panel of text overrides. Kept at module scope so
 * toggling it open doesn't remount the inputs and drop focus.
 */
function WidgetTextSection({
    title,
    description,
    groups,
    values,
    defaults,
    onChange,
}: {
    title: string;
    description: string;
    groups: { heading?: string; fields: WidgetTextField[] }[];
    values: Partial<Record<WidgetTextKey, string>>;
    defaults: WidgetTexts | null;
    onChange: (key: WidgetTextKey, value: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const { t } = useTranslation();

    // Typed lookups — field keys mirror the workflow.embed.fields.* leaf names.
    const fieldLabels: Record<WidgetTextKey, string> = {
        endChatText: t("workflow.embed.fields.endChatText"),
        endChatConfirmText: t("workflow.embed.fields.endChatConfirmText"),
        endChatCancelText: t("workflow.embed.fields.endChatCancelText"),
        endingChatText: t("workflow.embed.fields.endingChatText"),
        conversationEndedText: t("workflow.embed.fields.conversationEndedText"),
        startNewChatText: t("workflow.embed.fields.startNewChatText"),
        chatRetryText: t("workflow.embed.fields.chatRetryText"),
        chatInputPlaceholder: t("workflow.embed.fields.chatInputPlaceholder"),
        sendMessageLabel: t("workflow.embed.fields.sendMessageLabel"),
        closeChatLabel: t("workflow.embed.fields.closeChatLabel"),
        voiceConnectingText: t("workflow.embed.fields.voiceConnectingText"),
        voiceEndCallText: t("workflow.embed.fields.voiceEndCallText"),
        voiceRetryText: t("workflow.embed.fields.voiceRetryText"),
        voiceReadyTitle: t("workflow.embed.fields.voiceReadyTitle"),
        voiceConnectingSubtext: t("workflow.embed.fields.voiceConnectingSubtext"),
        voiceConnectedTitle: t("workflow.embed.fields.voiceConnectedTitle"),
        voiceConnectedSubtext: t("workflow.embed.fields.voiceConnectedSubtext"),
        voiceCallEndedTitle: t("workflow.embed.fields.voiceCallEndedTitle"),
        voiceCallEndedSubtext: t("workflow.embed.fields.voiceCallEndedSubtext"),
        voiceConnectionFailedTitle: t("workflow.embed.fields.voiceConnectionFailedTitle"),
        voiceConnectionFailedSubtext: t("workflow.embed.fields.voiceConnectionFailedSubtext"),
        voiceConnectionLostTitle: t("workflow.embed.fields.voiceConnectionLostTitle"),
        voiceConnectionLostSubtext: t("workflow.embed.fields.voiceConnectionLostSubtext"),
    };
    const fieldHints: Record<WidgetTextHintId, string> = {
        nextToConfirmation: t("workflow.embed.fieldHints.nextToConfirmation"),
        screenReadersOnly: t("workflow.embed.fieldHints.screenReadersOnly"),
        pairedWithCta: t("workflow.embed.fieldHints.pairedWithCta"),
    };

    return (
        <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border bg-muted/20">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 p-4 text-left">
                <div className="space-y-0.5">
                    <div className="text-sm font-medium">{title}</div>
                    <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 border-t p-4">
                {groups.map((group, groupIndex) => (
                    <div key={group.heading ?? groupIndex} className="space-y-3">
                        {group.heading && (
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {group.heading}
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            {group.fields.map(({ key, hint }) => (
                                <div key={key} className="space-y-2">
                                    <Label htmlFor={`widget-text-${key}`} className="text-sm">
                                        {fieldLabels[key]}
                                        {hint && (
                                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                                                ({fieldHints[hint]})
                                            </span>
                                        )}
                                    </Label>
                                    <Input
                                        id={`widget-text-${key}`}
                                        // Untouched fields show the backend default, so the
                                        // owner edits real copy rather than a blank box.
                                        value={values[key] ?? defaults?.[key] ?? ""}
                                        onChange={(e) => onChange(key, e.target.value)}
                                        placeholder={defaults?.[key] ?? ""}
                                        maxLength={80}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </CollapsibleContent>
        </Collapsible>
    );
}

const SECONDS_PER_MINUTE = 60;

interface EmbedToken {
    id: number;
    token: string;
    allowed_domains: string[] | null;
    settings: Record<string, unknown> | null;
    is_active: boolean;
    usage_count: number;
    usage_limit: number | null;
    expires_at: string | null;
    created_at: string;
    embed_script: string;
}

export function EmbedDialog({
    open,
    onOpenChange,
    workflowId,
    workflowName,
    workflowConfigurations,
    textChatInactivityTimeoutConstraints,
    widgetTextDefaults,
    onSaveWorkflowConfigurations,
}: EmbedDialogProps) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [embedToken, setEmbedToken] = useState<EmbedToken | null>(null);
    const [copied, setCopied] = useState(false);

    // Form state
    const [isEnabled, setIsEnabled] = useState(false);
    const [domains, setDomains] = useState<string[]>([]);
    const [newDomain, setNewDomain] = useState("");
    const [widgetType, setWidgetType] = useState<WidgetType>("voice");
    const [embedMode, setEmbedMode] = useState<"floating" | "inline" | "headless">("floating");
    const [position, setPosition] = useState("bottom-right");
    const [buttonText, setButtonText] = useState("Talk to Agent");
    const [buttonColor, setButtonColor] = useState("#10b981");
    const [callToActionText, setCallToActionText] = useState("Click to start voice conversation");
    // Sparse: only keys the owner has overridden. Anything absent renders (and
    // saves as) the backend default.
    const [widgetTexts, setWidgetTexts] = useState<Partial<Record<WidgetTextKey, string>>>({});
    const configuredTextChatInactivitySeconds =
        workflowConfigurations.text_chat_inactivity_timeout_seconds
        ?? textChatInactivityTimeoutConstraints?.default_seconds;
    const [textChatInactivityMinutes, setTextChatInactivityMinutes] = useState(() =>
        configuredTextChatInactivitySeconds === undefined
            ? ""
            : String(configuredTextChatInactivitySeconds / SECONDS_PER_MINUTE),
    );

    const parsedTextChatInactivityMinutes = Number(textChatInactivityMinutes);
    const parsedTextChatInactivitySeconds =
        parsedTextChatInactivityMinutes * SECONDS_PER_MINUTE;
    const minimumTextChatInactivitySeconds =
        textChatInactivityTimeoutConstraints?.minimum_seconds;
    const maximumTextChatInactivitySeconds =
        textChatInactivityTimeoutConstraints?.maximum_seconds;
    const minimumTextChatInactivityMinutes = minimumTextChatInactivitySeconds !== undefined
        ? minimumTextChatInactivitySeconds / SECONDS_PER_MINUTE
        : undefined;
    const maximumTextChatInactivityMinutes = maximumTextChatInactivitySeconds !== undefined
        ? maximumTextChatInactivitySeconds / SECONDS_PER_MINUTE
        : undefined;
    const hasTextChatInactivityBounds =
        minimumTextChatInactivitySeconds !== undefined &&
        maximumTextChatInactivitySeconds !== undefined;
    const textChatInactivityIsValid =
        textChatInactivityMinutes.trim() !== "" &&
        Number.isInteger(parsedTextChatInactivityMinutes) &&
        (!hasTextChatInactivityBounds ||
            (parsedTextChatInactivitySeconds >=
                minimumTextChatInactivitySeconds &&
                parsedTextChatInactivitySeconds <=
                    maximumTextChatInactivitySeconds));
    const textChatInactivityValidationMessage = hasTextChatInactivityBounds
        ? t("workflow.embed.timeoutRange", {
            min: minimumTextChatInactivityMinutes,
            max: maximumTextChatInactivityMinutes,
        })
        : t("workflow.embed.timeoutWhole");

    const handleWidgetTextChange = useCallback((key: WidgetTextKey, value: string) => {
        setWidgetTexts((prev) => ({ ...prev, [key]: value }));
    }, []);

    const handleWidgetTypeChange = (type: WidgetType) => {
        if (type === widgetType) return;
        const from = WIDGET_TYPE_DEFAULTS[widgetType];
        const to = WIDGET_TYPE_DEFAULTS[type];
        if (buttonText === from.buttonText) setButtonText(to.buttonText);
        if (callToActionText === from.callToActionText) setCallToActionText(to.callToActionText);
        setWidgetType(type);
    };

    const loadEmbedToken = useCallback(async () => {
        setLoading(true);
        try {
            const response = await getEmbedTokenApiV1WorkflowWorkflowIdEmbedTokenGet({
                path: { workflow_id: workflowId },
            });

            if (response.data) {
                setEmbedToken(response.data as EmbedToken);
                setIsEnabled(response.data.is_active);

                // Load settings
                if (response.data.settings) {
                    const settings = response.data.settings as Record<string, string>;
                    const loadedType: WidgetType = settings.widgetType === "chat" ? "chat" : "voice";
                    setWidgetType(loadedType);
                    setEmbedMode((settings.embedMode as "floating" | "inline" | "headless") || "floating");
                    setPosition(settings.position || "bottom-right");
                    setButtonText(settings.buttonText || WIDGET_TYPE_DEFAULTS[loadedType].buttonText);
                    setButtonColor(settings.buttonColor || "#10b981");
                    setCallToActionText(settings.callToActionText || WIDGET_TYPE_DEFAULTS[loadedType].callToActionText);
                    setWidgetTexts(
                        Object.fromEntries(
                            WIDGET_TEXT_KEYS
                                .filter((key) => settings[key])
                                .map((key) => [key, settings[key]]),
                        ),
                    );
                }

                // Load domains
                if (response.data.allowed_domains) {
                    setDomains(response.data.allowed_domains);
                }
            }
        } catch (error) {
            console.error("Failed to load embed token:", error);
        } finally {
            setLoading(false);
        }
    }, [workflowId]);

    useEffect(() => {
        if (open) {
            loadEmbedToken();
            setTextChatInactivityMinutes(
                configuredTextChatInactivitySeconds === undefined
                    ? ""
                    : String(configuredTextChatInactivitySeconds / SECONDS_PER_MINUTE),
            );
        }
    }, [open, loadEmbedToken, configuredTextChatInactivitySeconds]);

    const handleSave = async () => {
        if (isEnabled && widgetType === "chat" && !textChatInactivityIsValid) {
            toast.error(textChatInactivityValidationMessage);
            return;
        }

        setSaving(true);
        try {
            if (isEnabled && widgetType === "chat") {
                await onSaveWorkflowConfigurations(
                    {
                        ...workflowConfigurations,
                        text_chat_inactivity_timeout_seconds: parsedTextChatInactivitySeconds,
                    },
                    workflowName,
                );
            }

            if (!isEnabled && embedToken) {
                // Deactivate token
                const response = await deactivateEmbedTokenApiV1WorkflowWorkflowIdEmbedTokenDelete({
                    path: { workflow_id: workflowId },
                });
                if (response.error) {
                    throw new Error(
                        detailFromError(response.error, t("workflow.embed.disableFailed")),
                    );
                }
                setEmbedToken(null);
            } else if (isEnabled) {
                // Create or update token
                const response = await createOrUpdateEmbedTokenApiV1WorkflowWorkflowIdEmbedTokenPost({
                    path: { workflow_id: workflowId },
                    body: {
                        allowed_domains: domains.length > 0 ? domains : null,
                        settings: {
                            widgetType,
                            embedMode,
                            position,
                            buttonText,
                            buttonColor,
                            callToActionText,
                            // Overrides only — a key left out resolves to the
                            // backend default, so default copy keeps improving
                            // for tokens that never customized it.
                            ...Object.fromEntries(
                                WIDGET_TEXT_KEYS
                                    .map((key) => [key, (widgetTexts[key] ?? "").trim()])
                                    .filter(([, value]) => value !== ""),
                            ),
                            size: "medium",
                            autoStart: false,
                            containerId: embedMode === "inline" ? "dograh-inline-container" : undefined,
                        },
                        usage_limit: null,
                        expires_in_days: null,
                    },
                });

                if (response.error) {
                    throw new Error(
                        detailFromError(response.error, t("workflow.embed.saveFailed")),
                    );
                }
                if (response.data) {
                    setEmbedToken(response.data as EmbedToken);
                }
            }

            toast.success(t("workflow.embed.saveSuccess"));
            // Don't close modal after saving - let user copy the embed code
        } catch (error) {
            console.error("Failed to save embed token:", error);
            toast.error(
                error instanceof Error ? error.message : t("workflow.embed.saveFailed"),
            );
        } finally {
            setSaving(false);
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await copyTextToClipboard(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error(t("workflow.embed.copyFailed"));
        }
    };

    const addDomain = () => {
        if (newDomain.trim() && !domains.includes(newDomain.trim())) {
            setDomains([...domains, newDomain.trim()]);
            setNewDomain("");
        }
    };

    const removeDomain = (domain: string) => {
        setDomains(domains.filter(d => d !== domain));
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addDomain();
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle className="flex items-center gap-2">
                            <Rocket className="h-5 w-5" />
                            {t("workflow.embed.title")}
                        </DialogTitle>
                        <a
                            href={WIDGET_MODE_DOCUMENTATION_URLS[embedMode]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors pr-6"
                        >
                            {t("workflow.embed.docs")}
                            <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                    </div>
                    <DialogDescription>
                        {t("workflow.embed.description", { name: workflowName })}
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Enable/Disable Toggle */}
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="embed-enabled">{t("workflow.embed.enableEmbedding")}</Label>
                                <p className="text-sm text-muted-foreground">
                                    {t("workflow.embed.enableEmbeddingHelp")}
                                </p>
                            </div>
                            <Switch
                                id="embed-enabled"
                                checked={isEnabled}
                                onCheckedChange={setIsEnabled}
                            />
                        </div>

                        {isEnabled && (
                            <>
                                <Separator />

                                {/* Allowed Domains */}
                                <div className="space-y-3">
                                    <Label>
                                        {t("workflow.embed.allowedDomains")}
                                        <span className="text-xs text-muted-foreground ml-2">
                                            {t("workflow.embed.allowedDomainsHint")}
                                        </span>
                                    </Label>

                                    {/* Domain Input */}
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder={t("workflow.embed.domainPlaceholder")}
                                            value={newDomain}
                                            onChange={(e) => setNewDomain(e.target.value)}
                                            onKeyPress={handleKeyPress}
                                        />
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="outline"
                                            onClick={addDomain}
                                            disabled={!newDomain.trim()}
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    {/* Domain List */}
                                    {domains.length > 0 && (
                                        <div className="space-y-2">
                                            {domains.map((domain, index) => (
                                                <div
                                                    key={index}
                                                    className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2"
                                                >
                                                    <span className="text-sm font-mono">{domain}</span>
                                                    <Button
                                                        type="button"
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-6 w-6"
                                                        onClick={() => removeDomain(domain)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Widget Type Selection */}
                                <div className="space-y-4">
                                    <Label>{t("workflow.embed.widgetType")}</Label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            type="button"
                                            onClick={() => handleWidgetTypeChange("voice")}
                                            className={`p-4 rounded-lg border-2 transition-all ${
                                                widgetType === "voice"
                                                    ? "border-primary bg-primary/5"
                                                    : "border-muted hover:border-muted-foreground/20"
                                            }`}
                                        >
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-center gap-2 font-medium">
                                                    <Mic className="h-4 w-4" />
                                                    {t("workflow.embed.voiceAgent")}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {t("workflow.embed.voiceAgentHelp")}
                                                </div>
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleWidgetTypeChange("chat")}
                                            className={`p-4 rounded-lg border-2 transition-all ${
                                                widgetType === "chat"
                                                    ? "border-primary bg-primary/5"
                                                    : "border-muted hover:border-muted-foreground/20"
                                            }`}
                                        >
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-center gap-2 font-medium">
                                                    <MessageCircle className="h-4 w-4" />
                                                    {t("workflow.embed.chatAgent")}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {t("workflow.embed.chatAgentHelp")}
                                                </div>
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                {widgetType === "chat" && (
                                    <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
                                        <Label htmlFor="text-chat-inactivity-timeout">
                                            {t("workflow.embed.chatInactivityTimeout")}
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                id="text-chat-inactivity-timeout"
                                                type="number"
                                                min={minimumTextChatInactivityMinutes}
                                                max={maximumTextChatInactivityMinutes}
                                                step="1"
                                                value={textChatInactivityMinutes}
                                                onChange={(event) =>
                                                    setTextChatInactivityMinutes(event.target.value)
                                                }
                                                aria-invalid={!textChatInactivityIsValid}
                                                className="w-32"
                                            />
                                            <span className="text-sm text-muted-foreground">
                                                {t("workflow.embed.minutes")}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {t("workflow.embed.timeoutHelp")}
                                        </p>
                                        {!textChatInactivityIsValid && (
                                            <p className="text-xs text-destructive">
                                                {textChatInactivityValidationMessage}.
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Embed Mode Selection */}
                                <div className="space-y-4">
                                    <Label>{t("workflow.embed.embedMode")}</Label>
                                    <div className="grid grid-cols-3 gap-4">
                                        <button
                                            type="button"
                                            onClick={() => setEmbedMode("floating")}
                                            className={`p-4 rounded-lg border-2 transition-all ${
                                                embedMode === "floating"
                                                    ? "border-primary bg-primary/5"
                                                    : "border-muted hover:border-muted-foreground/20"
                                            }`}
                                        >
                                            <div className="space-y-2">
                                                <div className="font-medium">{t("workflow.embed.floatingWidget")}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {t("workflow.embed.floatingWidgetHelp")}
                                                </div>
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEmbedMode("inline")}
                                            className={`p-4 rounded-lg border-2 transition-all ${
                                                embedMode === "inline"
                                                    ? "border-primary bg-primary/5"
                                                    : "border-muted hover:border-muted-foreground/20"
                                            }`}
                                        >
                                            <div className="space-y-2">
                                                <div className="font-medium">{t("workflow.embed.inlineComponent")}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {t("workflow.embed.inlineComponentHelp")}
                                                </div>
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEmbedMode("headless")}
                                            className={`p-4 rounded-lg border-2 transition-all ${
                                                embedMode === "headless"
                                                    ? "border-primary bg-primary/5"
                                                    : "border-muted hover:border-muted-foreground/20"
                                            }`}
                                        >
                                            <div className="space-y-2">
                                                <div className="font-medium">{t("workflow.embed.headless")}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {t("workflow.embed.headlessHelp")}
                                                </div>
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                {/* Configuration based on mode */}
                                <div className="space-y-4">
                                    <Label>{t("workflow.embed.configuration")}</Label>

                                    {/* Shared: Button Text + Button Color (skipped in headless — host renders its own UI) */}
                                    {embedMode !== "headless" && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="button-text" className="text-sm">{t("workflow.embed.buttonText")}</Label>
                                                <Input
                                                    id="button-text"
                                                    value={buttonText}
                                                    onChange={(e) => setButtonText(e.target.value)}
                                                    placeholder={WIDGET_TYPE_DEFAULTS[widgetType].buttonText}
                                                    maxLength={40}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="button-color" className="text-sm">{t("workflow.embed.buttonColor")}</Label>
                                                <div className="flex gap-2">
                                                    <Input
                                                        id="button-color-picker"
                                                        type="color"
                                                        value={buttonColor}
                                                        onChange={(e) => setButtonColor(e.target.value)}
                                                        className="w-14 h-10 cursor-pointer"
                                                    />
                                                    <Input
                                                        id="button-color"
                                                        value={buttonColor}
                                                        onChange={(e) => setButtonColor(e.target.value)}
                                                        placeholder="#10b981"
                                                        className="flex-1"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Floating mode: Position */}
                                    {embedMode === "floating" && (
                                        <div className="space-y-2">
                                            <Label htmlFor="position" className="text-sm">{t("workflow.embed.position")}</Label>
                                            <Select value={position} onValueChange={setPosition}>
                                                <SelectTrigger id="position">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="bottom-right">{t("workflow.embed.positionBottomRight")}</SelectItem>
                                                    <SelectItem value="bottom-left">{t("workflow.embed.positionBottomLeft")}</SelectItem>
                                                    <SelectItem value="top-right">{t("workflow.embed.positionTopRight")}</SelectItem>
                                                    <SelectItem value="top-left">{t("workflow.embed.positionTopLeft")}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    {/* Inline mode: Call to Action Text */}
                                    {embedMode === "inline" && (
                                        <div className="space-y-2">
                                            <Label htmlFor="cta-text" className="text-sm">{t("workflow.embed.callToActionText")}</Label>
                                            <Input
                                                id="cta-text"
                                                value={callToActionText}
                                                onChange={(e) => setCallToActionText(e.target.value)}
                                                placeholder={WIDGET_TYPE_DEFAULTS[widgetType].callToActionText}
                                            />
                                        </div>
                                    )}

                                    {/* Visitor-facing copy, so the widget can match the site's language.
                                        Headless renders no UI of ours, so it has nothing to translate. */}
                                    {embedMode !== "headless" && widgetType === "chat" && (
                                        <WidgetTextSection
                                            title={t("workflow.embed.chatPanelText")}
                                            description={t("workflow.embed.chatPanelTextHelp")}
                                            groups={[{ fields: CHAT_TEXT_FIELDS }]}
                                            values={widgetTexts}
                                            defaults={widgetTextDefaults}
                                            onChange={handleWidgetTextChange}
                                        />
                                    )}

                                    {embedMode !== "headless" && widgetType === "voice" && (
                                        <WidgetTextSection
                                            title={t("workflow.embed.voiceCallText")}
                                            description={
                                                embedMode === "inline"
                                                    ? t("workflow.embed.voiceCallTextHelpInline")
                                                    : t("workflow.embed.voiceCallTextHelpFloating")
                                            }
                                            groups={
                                                embedMode === "inline"
                                                    ? [
                                                        { heading: t("workflow.embed.buttonLabels"), fields: VOICE_BUTTON_TEXT_FIELDS },
                                                        { heading: t("workflow.embed.statusMessages"), fields: VOICE_STATUS_TEXT_FIELDS },
                                                    ]
                                                    : [{ fields: VOICE_BUTTON_TEXT_FIELDS }]
                                            }
                                            values={widgetTexts}
                                            defaults={widgetTextDefaults}
                                            onChange={handleWidgetTextChange}
                                        />
                                    )}

                                    {/* Preview (skipped for headless — host renders its own UI) */}
                                    {embedMode === "headless" ? null : embedMode === "floating" ? (
                                        <div className="rounded-lg border bg-muted/30 p-6 flex items-center justify-center">
                                            <button
                                                className="inline-flex items-center gap-2 rounded-full px-5 py-3 font-medium text-white shadow-lg whitespace-nowrap"
                                                style={{ backgroundColor: buttonColor }}
                                            >
                                                {widgetType === "chat" ? (
                                                    <MessageCircle className="h-4 w-4" />
                                                ) : (
                                                    <Mic className="h-4 w-4" />
                                                )}
                                                {buttonText || WIDGET_TYPE_DEFAULTS[widgetType].buttonText}
                                            </button>
                                        </div>
                                    ) : widgetType === "chat" ? (
                                        <div className="rounded-lg border bg-background p-6 flex items-center justify-center">
                                            <div className="w-full max-w-sm rounded-lg border shadow-sm overflow-hidden">
                                                <div
                                                    className="px-4 py-3 text-sm font-semibold text-white"
                                                    style={{ backgroundColor: buttonColor }}
                                                >
                                                    {buttonText || "Chat with Agent"}
                                                </div>
                                                <div className="p-4 space-y-2 bg-muted/20">
                                                    <div className="max-w-[80%] rounded-lg rounded-bl-sm bg-muted px-3 py-2 text-sm">
                                                        {t("workflow.embed.previewGreeting")}
                                                    </div>
                                                    <div
                                                        className="max-w-[80%] ml-auto rounded-lg rounded-br-sm px-3 py-2 text-sm text-white"
                                                        style={{ backgroundColor: buttonColor }}
                                                    >
                                                        {t("workflow.embed.previewQuestion")}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 border-t px-3 py-2">
                                                    <div className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm text-muted-foreground">
                                                        {widgetTexts.chatInputPlaceholder?.trim()
                                                            || widgetTextDefaults?.chatInputPlaceholder}
                                                    </div>
                                                    <span
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white"
                                                        style={{ backgroundColor: buttonColor }}
                                                    >
                                                        <Send className="h-4 w-4" />
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border bg-background p-6 flex items-center justify-center">
                                            <div className="text-center">
                                                <svg className="w-16 h-16 mx-auto mb-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                                </svg>
                                                <p className="text-lg font-medium text-foreground mb-1">
                                                    {widgetTexts.voiceReadyTitle?.trim() || widgetTextDefaults?.voiceReadyTitle}
                                                </p>
                                                <p className="text-sm text-muted-foreground mb-5">{callToActionText}</p>
                                                <button
                                                    className="px-8 py-3 rounded-lg font-semibold text-white shadow-md"
                                                    style={{ backgroundColor: buttonColor }}
                                                >
                                                    {buttonText}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Headless mode: Integration Instructions (chat) */}
                                    {embedMode === "headless" && widgetType === "chat" && (
                                        <div className="space-y-3">
                                            <div className="rounded-lg bg-muted/50 p-4">
                                                <h4 className="font-medium mb-2">{t("workflow.embed.integrationInstructions")}</h4>
                                                <ul className="text-sm space-y-2 text-muted-foreground">
                                                    <li>• {t("workflow.embed.headlessChatBullet1")}</li>
                                                    <li>• {t("workflow.embed.headlessChatBullet2")}</li>
                                                    <li>• {t("workflow.embed.headlessChatBullet3")}</li>
                                                    <li>• {t("workflow.embed.headlessChatBullet4")}</li>
                                                    <li>• {t("workflow.embed.headlessChatBullet5")}</li>
                                                    <li>• {t("workflow.embed.headlessChatBullet6")}</li>
                                                    <li>• {t("workflow.embed.headlessChatBullet7")}</li>
                                                    <li>• {t("workflow.embed.headlessChatBullet8")}</li>
                                                </ul>
                                            </div>

                                            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-4 border border-blue-200 dark:border-blue-800">
                                                <h4 className="font-medium mb-2 text-blue-900 dark:text-blue-100">{t("workflow.embed.exampleDriveChatUi")}</h4>
                                                <pre className="text-xs overflow-x-auto">
                                                    <code className="text-blue-800 dark:text-blue-200">{HEADLESS_CHAT_EXAMPLE}</code>
                                                </pre>
                                            </div>
                                        </div>
                                    )}

                                    {/* Headless mode: Integration Instructions (voice) */}
                                    {embedMode === "headless" && widgetType === "voice" && (
                                        <div className="space-y-3">
                                            <div className="rounded-lg bg-muted/50 p-4">
                                                <h4 className="font-medium mb-2">{t("workflow.embed.integrationInstructions")}</h4>
                                                <ul className="text-sm space-y-2 text-muted-foreground">
                                                    <li>• {t("workflow.embed.headlessVoiceBullet1")}</li>
                                                    <li>• {t("workflow.embed.headlessVoiceBullet2")}</li>
                                                    <li>• {t("workflow.embed.headlessVoiceBullet3")}</li>
                                                    <li>• {t("workflow.embed.headlessVoiceBullet4")}</li>
                                                    <li>• {t("workflow.embed.headlessVoiceBullet5")}</li>
                                                    <li>• {t("workflow.embed.headlessVoiceBullet6")}</li>
                                                    <li>• {t("workflow.embed.headlessVoiceBullet7")}</li>
                                                </ul>
                                            </div>

                                            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-4 border border-blue-200 dark:border-blue-800">
                                                <h4 className="font-medium mb-2 text-blue-900 dark:text-blue-100">{t("workflow.embed.exampleTrackStatus")}</h4>
                                                <p className="text-xs text-blue-900/80 dark:text-blue-100/80 mb-2">
                                                    {t("workflow.embed.headlessVoiceProse")}
                                                </p>
                                                <pre className="text-xs overflow-x-auto">
                                                    <code className="text-blue-800 dark:text-blue-200">{`// Vanilla JS - keep your own state, render however you want
let callStatus = 'idle';

window.DograhWidget?.onStatusChange((status) => {
  callStatus = status;
  // ...trigger your render here (re-paint DOM, dispatch event, etc.)
});

document.getElementById('talk-btn').addEventListener('click', () => {
  if (callStatus === 'connected' || callStatus === 'connecting') {
    window.DograhWidget.end();
  } else {
    window.DograhWidget.start();
  }
});`}</code>
                                                </pre>
                                                <p className="text-xs text-blue-900/80 dark:text-blue-100/80 mt-3 mb-2">React:</p>
                                                <pre className="text-xs overflow-x-auto">
                                                    <code className="text-blue-800 dark:text-blue-200">{`function TalkButton() {
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    window.DograhWidget?.onStatusChange(setStatus);
  }, []);

  const isLive = status === 'connected' || status === 'connecting';
  return (
    <button onClick={() => isLive ? window.DograhWidget.end() : window.DograhWidget.start()}>
      {/* render anything you want from \`status\` */}
    </button>
  );
}`}</code>
                                                </pre>
                                            </div>
                                        </div>
                                    )}

                                    {/* Inline mode: Integration Instructions */}
                                    {embedMode === "inline" && (
                                        <div className="space-y-3">
                                            <div className="rounded-lg bg-muted/50 p-4">
                                                <h4 className="font-medium mb-2">{t("workflow.embed.integrationInstructions")}</h4>
                                                <ul className="text-sm space-y-2 text-muted-foreground">
                                                    <li>• {t("workflow.embed.inlineBullet1")}</li>
                                                    <li>• {t("workflow.embed.inlineBullet2")}</li>
                                                    <li>• {t("workflow.embed.inlineBullet3")}</li>
                                                    {widgetType === "chat" ? (
                                                        <li>• {t("workflow.embed.inlineBulletChat")}</li>
                                                    ) : (
                                                        <>
                                                            <li>• {t("workflow.embed.inlineBulletVoiceStart")}</li>
                                                            <li>• {t("workflow.embed.inlineBulletVoiceEnd")}</li>
                                                        </>
                                                    )}
                                                </ul>
                                            </div>

                                            {widgetType === "chat" ? (
                                                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-4 border border-blue-200 dark:border-blue-800">
                                                    <h4 className="font-medium mb-2 text-blue-900 dark:text-blue-100">{t("workflow.embed.example")}</h4>
                                                    <pre className="text-xs overflow-x-auto">
                                                        <code className="text-blue-800 dark:text-blue-200">{`<h2>Chat with Our Agent</h2>
<div id="dograh-inline-container" style="min-height: 480px">
  <!-- Chat panel renders here; no extra JS needed -->
</div>`}</code>
                                                    </pre>
                                                </div>
                                            ) : (
                                                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-4 border border-blue-200 dark:border-blue-800">
                                                    <h4 className="font-medium mb-2 text-blue-900 dark:text-blue-100">{t("workflow.embed.exampleReactComponent")}</h4>
                                                    <pre className="text-xs overflow-x-auto">
                                                        <code className="text-blue-800 dark:text-blue-200">{`export function DograhAgent() {
  const [isCallActive, setIsCallActive] = useState(false);

  useEffect(() => {
    // Widget will auto-initialize when script loads
    window.DograhWidget?.onCallStart(() => {
      setIsCallActive(true);
    });
    window.DograhWidget?.onCallEnd(() => {
      setIsCallActive(false);
    });
  }, []);

  return (
    <div className="my-8">
      <h2>Talk to Our Agent</h2>
      <div id="dograh-inline-container" className="min-h-[400px]">
        {/* Widget renders here */}
      </div>
      <button
        onClick={() => window.DograhWidget?.start()}
        disabled={isCallActive}
      >
        Start Call
      </button>
    </div>
  );
}`}</code>
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <Separator />

                                {/* Save Button */}
                                <div className="flex justify-end">
                                    <Button
                                        onClick={handleSave}
                                        disabled={
                                            saving ||
                                            (widgetType === "chat" &&
                                                !textChatInactivityIsValid)
                                        }
                                    >
                                        {saving ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                {t("common.saving")}
                                            </>
                                        ) : (
                                            t("workflow.embed.saveConfigurations")
                                        )}
                                    </Button>
                                </div>

                                {/* Embed Script (shows after saving; placeholder before) */}
                                {embedToken && embedToken.is_active ? (
                                    <>
                                        <Separator />
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <Label>{t("workflow.embed.embedCode")}</Label>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => copyToClipboard(embedToken.embed_script)}
                                                >
                                                    {copied ? (
                                                        <>
                                                            <Check className="h-4 w-4 mr-1" />
                                                            {t("common.copied")}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy className="h-4 w-4 mr-1" />
                                                            {t("workflow.embed.copyCode")}
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                            <div className="relative">
                                                <pre className="bg-muted/50 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap break-all">
                                                    <code>{embedToken.embed_script}</code>
                                                </pre>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {t("workflow.embed.embedCodeHelp")}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                <Trans
                                                    i18nKey="workflow.embed.visitorDetails"
                                                    components={[
                                                        <code key="c1" className="text-xs" />,
                                                        <code key="c2" className="text-xs" />,
                                                        <code key="c3" className="text-xs" />,
                                                        <a
                                                            key="docs"
                                                            href={WIDGET_CONTEXT_DOC_URL}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="underline underline-offset-2 hover:text-foreground"
                                                        />,
                                                    ]}
                                                    values={{
                                                        setContextExample: "window.DograhWidget.setContext({ ... })",
                                                        pageContextExample: "{{initial_context.page_url}}",
                                                    }}
                                                />
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <Separator />
                                        <div className="space-y-3">
                                            <Label className="text-muted-foreground">{t("workflow.embed.embedCode")}</Label>
                                            <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                                                <Trans
                                                    i18nKey="workflow.embed.clickSaveToGenerate"
                                                    components={[<span key="cta" className="font-medium" />]}
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
