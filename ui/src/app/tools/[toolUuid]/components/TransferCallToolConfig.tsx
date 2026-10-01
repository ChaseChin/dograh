"use client";

import { ArrowDown, ArrowUp, ExternalLink, Plus, Trash2 } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";

import type { RecordingResponseSchema } from "@/client/types.gen";
import { RecordingSelect, StaticTextWarning } from "@/components/flow/TextOrAudioInput";
import {
    CredentialSelector,
    KeyValueEditor,
    type KeyValueItem,
    ParameterEditor,
    PresetParameterEditor,
    type PresetToolParameter,
    type ToolParameter,
    UrlInput,
} from "@/components/http";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DOCS_BASE } from "@/constants/documentation";

import {
    type ContextDestinationRuleRow,
    createContextDestinationRouteRow,
    createContextDestinationRuleRow,
    type EndCallMessageType,
    type TransferDestinationSource,
} from "../../config";

export interface TransferCallToolConfigProps {
    name: string;
    onNameChange: (name: string) => void;
    description: string;
    onDescriptionChange: (description: string) => void;
    destinationSource: TransferDestinationSource;
    onDestinationSourceChange: (source: TransferDestinationSource) => void;
    destination: string;
    onDestinationChange: (destination: string) => void;
    messageType: EndCallMessageType;
    onMessageTypeChange: (messageType: EndCallMessageType) => void;
    customMessage: string;
    onCustomMessageChange: (message: string) => void;
    audioRecordingId: string;
    onAudioRecordingIdChange: (id: string) => void;
    recordings?: RecordingResponseSchema[];
    timeout?: number;
    onTimeoutChange: (timeout: number) => void;
    callDisposition: string;
    onCallDispositionChange: (disposition: string) => void;
    resolverUrl: string;
    onResolverUrlChange: (url: string) => void;
    resolverCredentialUuid: string;
    onResolverCredentialUuidChange: (uuid: string) => void;
    resolverHeaders: KeyValueItem[];
    onResolverHeadersChange: (headers: KeyValueItem[]) => void;
    resolverTimeoutMs: number;
    onResolverTimeoutMsChange: (timeoutMs: number) => void;
    resolverWaitMessage: string;
    onResolverWaitMessageChange: (message: string) => void;
    parameters: ToolParameter[];
    onParametersChange: (parameters: ToolParameter[]) => void;
    presetParameters: PresetToolParameter[];
    onPresetParametersChange: (parameters: PresetToolParameter[]) => void;
    contextDestinationRules: ContextDestinationRuleRow[];
    onContextDestinationRulesChange: (rules: ContextDestinationRuleRow[]) => void;
    fallbackDestination: string;
    onFallbackDestinationChange: (destination: string) => void;
}

export function TransferCallToolConfig({
    name,
    onNameChange,
    description,
    onDescriptionChange,
    destinationSource,
    onDestinationSourceChange,
    destination,
    onDestinationChange,
    messageType,
    onMessageTypeChange,
    customMessage,
    onCustomMessageChange,
    audioRecordingId,
    onAudioRecordingIdChange,
    recordings = [],
    timeout,
    onTimeoutChange,
    callDisposition,
    onCallDispositionChange,
    resolverUrl,
    onResolverUrlChange,
    resolverCredentialUuid,
    onResolverCredentialUuidChange,
    resolverHeaders,
    onResolverHeadersChange,
    resolverTimeoutMs,
    onResolverTimeoutMsChange,
    resolverWaitMessage,
    onResolverWaitMessageChange,
    parameters,
    onParametersChange,
    presetParameters,
    onPresetParametersChange,
    contextDestinationRules,
    onContextDestinationRulesChange,
    fallbackDestination,
    onFallbackDestinationChange,
}: TransferCallToolConfigProps) {
    const { t } = useTranslation();

    const updateRule = (
        ruleId: string,
        update: (rule: ContextDestinationRuleRow) => ContextDestinationRuleRow,
    ) => {
        onContextDestinationRulesChange(
            contextDestinationRules.map((rule) => (rule.id === ruleId ? update(rule) : rule))
        );
    };

    const moveRule = (index: number, offset: number) => {
        const target = index + offset;
        if (target < 0 || target >= contextDestinationRules.length) return;
        const reordered = [...contextDestinationRules];
        [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
        onContextDestinationRulesChange(reordered);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t("tools.transferCall.title")}</CardTitle>
                <CardDescription>
                    {t("tools.transferCall.description")}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-2">
                    <Label>{t("tools.transferCall.nameLabel")}</Label>
                    <Label className="text-xs text-muted-foreground">
                        {t("tools.transferCall.nameHelp")}
                    </Label>
                    <Input
                        value={name}
                        onChange={(e) => onNameChange(e.target.value)}
                        placeholder={t("tools.transferCall.namePlaceholder")}
                    />
                </div>

                <div className="grid gap-2">
                    <Label>{t("tools.transferCall.descriptionLabel")}</Label>
                    <Label className="text-xs text-muted-foreground">
                        {t("tools.transferCall.descriptionHelp")}
                    </Label>
                    <Textarea
                        value={description}
                        onChange={(e) => onDescriptionChange(e.target.value)}
                        placeholder={t("tools.transferCall.descriptionPlaceholder")}
                        rows={3}
                    />
                </div>

                <div className="grid gap-4 pt-4 border-t">
                    <Label>{t("tools.transferCall.preTransferMessage")}</Label>
                    <Label className="text-xs text-muted-foreground">
                        {t("tools.transferCall.preTransferMessageHelp")}
                    </Label>
                    <RadioGroup
                        value={messageType}
                        onValueChange={(v) => onMessageTypeChange(v as EndCallMessageType)}
                        className="space-y-3"
                    >
                        <label
                            htmlFor="none"
                            className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                        >
                            <RadioGroupItem value="none" id="none" />
                            <div className="flex-1">
                                <span className="font-medium">{t("tools.transferCall.noMessage")}</span>
                                <p className="text-xs text-muted-foreground">
                                    {t("tools.transferCall.noMessageHelp")}
                                </p>
                            </div>
                        </label>
                        <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50">
                            <RadioGroupItem value="custom" id="custom" className="mt-1" />
                            <label htmlFor="custom" className="flex-1 space-y-2 cursor-pointer">
                                <span className="font-medium">{t("tools.transferCall.customMessage")}</span>
                                <p className="text-xs text-muted-foreground">
                                    {t("tools.transferCall.customMessageHelp")}
                                </p>
                            </label>
                        </div>
                        {messageType === "custom" && (
                            <div className="pl-8 space-y-2">
                                <StaticTextWarning />
                                <Textarea
                                    value={customMessage}
                                    onChange={(e) => onCustomMessageChange(e.target.value)}
                                    placeholder={t("tools.transferCall.customMessagePlaceholder")}
                                    rows={2}
                                />
                            </div>
                        )}
                        <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50">
                            <RadioGroupItem value="audio" id="audio" className="mt-1" />
                            <label htmlFor="audio" className="flex-1 space-y-2 cursor-pointer">
                                <span className="font-medium">{t("tools.transferCall.prerecordedAudio")}</span>
                                <p className="text-xs text-muted-foreground">
                                    {t("tools.transferCall.prerecordedAudioHelp")}
                                </p>
                            </label>
                        </div>
                        {messageType === "audio" && (
                            <div className="pl-8">
                                <RecordingSelect
                                    value={audioRecordingId}
                                    onChange={onAudioRecordingIdChange}
                                    recordings={recordings}
                                />
                            </div>
                        )}
                    </RadioGroup>
                </div>

                <div className="grid gap-2 pt-4 border-t">
                    <Label>{t("tools.transferCall.timeout")}</Label>
                    <Label className="text-xs text-muted-foreground">
                        {t("tools.transferCall.timeoutHelp")}
                    </Label>
                    <Input
                        type="number"
                        value={timeout ?? 30}
                        onChange={(e) => {
                            const value = parseInt(e.target.value) || 30;
                            onTimeoutChange(Math.min(Math.max(value, 5), 120));
                        }}
                        placeholder="30"
                        min="5"
                        max="120"
                        className="w-32"
                    />
                    <Label className="text-xs text-muted-foreground">
                        {t("tools.transferCall.timeoutDefault")}
                    </Label>
                </div>

                <div className="grid gap-2 pt-4 border-t">
                    <Label htmlFor="transfer-call-disposition">
                        {t("tools.transferCall.dispositionLabel")}
                    </Label>
                    <Label className="text-xs text-muted-foreground">
                        {t("tools.transferCall.dispositionHelp")}
                    </Label>
                    <Input
                        id="transfer-call-disposition"
                        value={callDisposition}
                        onChange={(e) => onCallDispositionChange(e.target.value)}
                        placeholder={t("tools.transferCall.dispositionPlaceholder")}
                        maxLength={64}
                    />
                </div>

                <div className="grid gap-4 pt-4 border-t">
                    <div>
                        <Label>{t("tools.transferCall.destinationSource")}</Label>
                        <p className="text-xs text-muted-foreground">
                            {t("tools.transferCall.destinationSourceHelp")}
                        </p>
                    </div>
                    <Tabs
                        value={destinationSource}
                        onValueChange={(v) => onDestinationSourceChange(v as TransferDestinationSource)}
                        className="w-full"
                    >
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="static">{t("tools.transferCall.tabStatic")}</TabsTrigger>
                            <TabsTrigger value="dynamic">{t("tools.transferCall.tabDynamic")}</TabsTrigger>
                            <TabsTrigger value="context_mapping">{t("tools.transferCall.tabContextMapping")}</TabsTrigger>
                        </TabsList>

                        <TabsContent value="static" className="space-y-4 mt-4">
                            <div className="grid gap-2">
                                <Label>{t("tools.transferCall.destinationLabel")}</Label>
                                <div className="text-xs text-muted-foreground space-y-1">
                                    <p>{t("tools.transferCall.destinationHelp")}</p>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li>{t("tools.transferCall.destinationSipExample")}</li>
                                        <li>{t("tools.transferCall.destinationE164Example")}</li>
                                        <li>
                                            {t("tools.transferCall.destinationTemplateExample", { example: "{{initial_context.transfer_destination}}" })}
                                        </li>
                                    </ul>
                                </div>
                                <Input
                                    value={destination}
                                    onChange={(e) => onDestinationChange(e.target.value)}
                                    placeholder="+1234567890, PJSIP/1234, or {{initial_context.transfer_destination}}"
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="dynamic" className="space-y-5 mt-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <Label>{t("tools.transferCall.resolverTitle")}</Label>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    <Trans
                                        i18nKey="tools.transferCall.resolverHelp"
                                        components={{
                                            0: (
                                                <a
                                                    href={`${DOCS_BASE}/voice-agent/tools/call-transfer#dynamic-resolver-response`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                                                />
                                            ),
                                        }}
                                    />{" "}
                                    <ExternalLink className="inline h-3 w-3" />
                                </p>
                            </div>

                            <div className="grid gap-2">
                                <Label>{t("tools.transferCall.resolverUrl")}</Label>
                                <UrlInput
                                    value={resolverUrl}
                                    onChange={onResolverUrlChange}
                                    placeholder="https://crm.example.com/resolve-transfer"
                                    showValidation
                                />
                                <Label className="text-xs text-muted-foreground">
                                    {t("tools.transferCall.resolverUrlHelp")}
                                </Label>
                            </div>

                            <div className="grid gap-2">
                                <Label>{t("tools.transferCall.resolverTimeout")}</Label>
                                <Input
                                    type="number"
                                    value={resolverTimeoutMs}
                                    onChange={(e) => {
                                        const value = parseInt(e.target.value) || 3000;
                                        onResolverTimeoutMsChange(Math.min(Math.max(value, 500), 5000));
                                    }}
                                    min="500"
                                    max="5000"
                                    className="w-36"
                                />
                                <Label className="text-xs text-muted-foreground">
                                    {t("tools.transferCall.resolverTimeoutHelp")}
                                </Label>
                            </div>

                            <CredentialSelector
                                value={resolverCredentialUuid}
                                onChange={onResolverCredentialUuidChange}
                                label={t("tools.transferCall.resolverCredentialLabel")}
                                description={t("tools.transferCall.resolverCredentialHelp")}
                            />

                            <div className="grid gap-2">
                                <Label>{t("tools.transferCall.resolverWaitMessage")}</Label>
                                <Textarea
                                    value={resolverWaitMessage}
                                    onChange={(e) => onResolverWaitMessageChange(e.target.value)}
                                    placeholder={t("tools.transferCall.resolverWaitMessagePlaceholder")}
                                    rows={2}
                                />
                                <Label className="text-xs text-muted-foreground">
                                    {t("tools.transferCall.resolverWaitMessageHelp")}
                                </Label>
                            </div>

                            <div className="grid gap-2 pt-4 border-t">
                                <Label>{t("tools.transferCall.llmParameters")}</Label>
                                <p className="text-xs text-muted-foreground">
                                    <Trans
                                        i18nKey="tools.transferCall.llmParametersHelp"
                                        components={{
                                            0: (
                                                <a
                                                    href={`${DOCS_BASE}/voice-agent/tools/call-transfer#dynamic-resolver-request`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                                                />
                                            ),
                                        }}
                                    />{" "}
                                    <ExternalLink className="inline h-3 w-3" />
                                </p>
                                <ParameterEditor
                                    parameters={parameters}
                                    onChange={onParametersChange}
                                />
                            </div>

                            <div className="grid gap-2 pt-4 border-t">
                                <Label>{t("tools.transferCall.presetParameters")}</Label>
                                <p className="text-xs text-muted-foreground">
                                    <Trans
                                        i18nKey="tools.transferCall.presetParametersHelp"
                                        values={{
                                            example1: "{{initial_context.state}}",
                                            example2: "{{gathered_context.state}}",
                                        }}
                                        components={{
                                            0: (
                                                <a
                                                    href={`${DOCS_BASE}/voice-agent/tools/call-transfer#dynamic-resolver-request`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                                                />
                                            ),
                                        }}
                                    />{" "}
                                    <ExternalLink className="inline h-3 w-3" />
                                </p>
                                <PresetParameterEditor
                                    parameters={presetParameters}
                                    onChange={onPresetParametersChange}
                                />
                            </div>

                            <div className="grid gap-2 pt-4 border-t">
                                <Label>{t("tools.transferCall.customHeaders")}</Label>
                                <Label className="text-xs text-muted-foreground">
                                    {t("tools.transferCall.customHeadersHelp")}
                                </Label>
                                <KeyValueEditor
                                    items={resolverHeaders}
                                    onChange={onResolverHeadersChange}
                                    keyPlaceholder={t("tools.transferCall.headerKeyPlaceholder")}
                                    valuePlaceholder={t("tools.transferCall.headerValuePlaceholder")}
                                    addButtonText={t("tools.transferCall.addHeader")}
                                />
                            </div>
                        </TabsContent>
                        <TabsContent value="context_mapping" className="space-y-5 mt-4">
                            <div className="space-y-2">
                                <Label>{t("tools.transferCall.contextRoutingTitle")}</Label>
                                <p className="text-xs text-muted-foreground">
                                    {t("tools.transferCall.contextRoutingHelp1")}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    <Trans
                                        i18nKey="tools.transferCall.contextRoutingHelp2"
                                        components={{
                                            0: <code />,
                                            1: <code />,
                                            2: <code />,
                                        }}
                                    />
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    <Trans
                                        i18nKey="tools.transferCall.contextRoutingHelp3"
                                        values={{ example: "{{initial_context.transfer_destination}}" }}
                                        components={{
                                            0: (
                                                <a
                                                    href={`${DOCS_BASE}/voice-agent/tools/call-transfer#context-mapping`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                                                />
                                            ),
                                        }}
                                    />{" "}
                                    <ExternalLink className="inline h-3 w-3" />
                                </p>
                            </div>
                                {contextDestinationRules.map((rule, ruleIndex) => (
                                    <div key={rule.id} className="space-y-4 rounded-lg border p-4">
                                        <div className="flex items-center justify-between">
                                            <Label>{t("tools.transferCall.ruleLabel", { index: ruleIndex + 1 })}</Label>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    aria-label={t("tools.transferCall.moveRuleUpAria", { index: ruleIndex + 1 })}
                                                    disabled={ruleIndex === 0}
                                                    onClick={() => moveRule(ruleIndex, -1)}
                                                >
                                                    <ArrowUp className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    aria-label={t("tools.transferCall.moveRuleDownAria", { index: ruleIndex + 1 })}
                                                    disabled={ruleIndex === contextDestinationRules.length - 1}
                                                    onClick={() => moveRule(ruleIndex, 1)}
                                                >
                                                    <ArrowDown className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    aria-label={t("tools.transferCall.removeRuleAria", { index: ruleIndex + 1 })}
                                                    onClick={() => onContextDestinationRulesChange(
                                                        contextDestinationRules.filter((item) => item.id !== rule.id)
                                                    )}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor={`context-path-${rule.id}`}>
                                                {t("tools.transferCall.contextField")}
                                            </Label>
                                            <Input
                                                id={`context-path-${rule.id}`}
                                                aria-label={t("tools.transferCall.contextFieldAria", { index: ruleIndex + 1 })}
                                                value={rule.context_path}
                                                onChange={(event) => updateRule(rule.id, (item) => ({
                                                    ...item,
                                                    context_path: event.target.value,
                                                }))}
                                                placeholder={t("tools.transferCall.contextFieldPlaceholder")}
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <Label>{t("tools.transferCall.mappingsLabel")}</Label>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    aria-label={t("tools.transferCall.addMappingAria", { index: ruleIndex + 1 })}
                                                    onClick={() => updateRule(rule.id, (item) => ({
                                                        ...item,
                                                        routes: [
                                                            ...item.routes,
                                                            createContextDestinationRouteRow(),
                                                        ],
                                                    }))}
                                                >
                                                    <Plus className="mr-1 h-4 w-4" /> {t("tools.transferCall.addMapping")}
                                                </Button>
                                            </div>
                                            {rule.routes.map((route, index) => (
                                                <div key={route.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                                                    <Input
                                                        aria-label={t("tools.transferCall.contextValueAria", { ruleIndex: ruleIndex + 1, index: index + 1 })}
                                                        value={route.context_value}
                                                        onChange={(event) => updateRule(rule.id, (item) => ({
                                                            ...item,
                                                            routes: item.routes.map((existing) =>
                                                                existing.id === route.id
                                                                    ? { ...existing, context_value: event.target.value }
                                                                    : existing
                                                            ),
                                                        }))}
                                                        placeholder={t("tools.transferCall.contextValuePlaceholder")}
                                                    />
                                                    <Input
                                                        aria-label={t("tools.transferCall.destinationAria", { ruleIndex: ruleIndex + 1, index: index + 1 })}
                                                        value={route.destination}
                                                        onChange={(event) => updateRule(rule.id, (item) => ({
                                                            ...item,
                                                            routes: item.routes.map((existing) =>
                                                                existing.id === route.id
                                                                    ? { ...existing, destination: event.target.value }
                                                                    : existing
                                                            ),
                                                        }))}
                                                        placeholder={t("tools.transferCall.destinationPlaceholder", { example: "{{initial_context.destination}}" })}
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={t("tools.transferCall.removeMappingAria", { ruleIndex: ruleIndex + 1, index: index + 1 })}
                                                        onClick={() => updateRule(rule.id, (item) => ({
                                                            ...item,
                                                            routes: item.routes.filter(
                                                                (existing) => existing.id !== route.id
                                                            ),
                                                        }))}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                            {rule.routes.length === 0 && (
                                                <p className="text-xs text-muted-foreground">
                                                    {t("tools.transferCall.mappingRequired")}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="w-fit"
                                    onClick={() => onContextDestinationRulesChange([
                                        ...contextDestinationRules,
                                        createContextDestinationRuleRow(),
                                    ])}
                                >
                                    <Plus className="mr-1 h-4 w-4" /> {t("tools.transferCall.addRoutingRule")}
                                </Button>
                                {contextDestinationRules.length === 0 && (
                                    <p className="text-xs text-muted-foreground">
                                        {t("tools.transferCall.routingRuleRequired")}
                                    </p>
                                )}
                                <div className="grid gap-2">
                                    <Label htmlFor="context-fallback-destination">{t("tools.transferCall.fallbackDestination")}</Label>
                                    <Input
                                        id="context-fallback-destination"
                                        value={fallbackDestination}
                                        onChange={(event) => onFallbackDestinationChange(event.target.value)}
                                        placeholder={t("tools.transferCall.fallbackDestinationPlaceholder", { example: "{{initial_context.destination}}" })}
                                    />
                                    <Label className="text-xs text-muted-foreground">
                                        {t("tools.transferCall.fallbackDestinationHelp")}
                                    </Label>
                                </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </CardContent>
        </Card>
    );
}
