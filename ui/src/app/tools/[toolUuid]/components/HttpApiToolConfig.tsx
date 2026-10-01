"use client";

import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { RecordingResponseSchema } from "@/client/types.gen";
import { StaticTextWarning, TextOrAudioInput } from "@/components/flow/TextOrAudioInput";
import {
    CredentialSelector,
    extractUrlHostnameParameters,
    extractUrlPathParameters,
    type HttpMethod,
    HttpMethodSelector,
    KeyValueEditor,
    type KeyValueItem,
    ParameterEditor,
    PresetParameterEditor,
    type PresetToolParameter,
    type ToolParameter,
    UrlInput,
} from "@/components/http";
import { BodyTemplateEditor } from "@/components/http/body-template-editor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export interface HttpApiToolConfigProps {
    name: string;
    onNameChange: (name: string) => void;
    description: string;
    onDescriptionChange: (description: string) => void;
    httpMethod: HttpMethod;
    onHttpMethodChange: (method: HttpMethod) => void;
    url: string;
    onUrlChange: (url: string) => void;
    credentialUuid: string;
    onCredentialUuidChange: (uuid: string) => void;
    headers: KeyValueItem[];
    onHeadersChange: (headers: KeyValueItem[]) => void;
    parameters: ToolParameter[];
    onParametersChange: (parameters: ToolParameter[]) => void;
    presetParameters: PresetToolParameter[];
    onPresetParametersChange: (parameters: PresetToolParameter[]) => void;
    bodyTemplateEnabled: boolean;
    onBodyTemplateEnabledChange: (enabled: boolean) => void;
    bodyTemplate: Record<string, unknown> | null;
    onBodyTemplateChange: (template: Record<string, unknown> | null) => void;
    onBodyTemplateValidityChange: (valid: boolean) => void;
    timeoutMs: number;
    onTimeoutMsChange: (timeout: number) => void;
    customMessage: string;
    onCustomMessageChange: (message: string) => void;
    customMessageType: 'text' | 'audio';
    onCustomMessageTypeChange: (type: 'text' | 'audio') => void;
    customMessageRecordingId: string;
    onCustomMessageRecordingIdChange: (id: string) => void;
    recordings?: RecordingResponseSchema[];
}

export function HttpApiToolConfig({
    name,
    onNameChange,
    description,
    onDescriptionChange,
    httpMethod,
    onHttpMethodChange,
    url,
    onUrlChange,
    credentialUuid,
    onCredentialUuidChange,
    headers,
    onHeadersChange,
    parameters,
    onParametersChange,
    presetParameters,
    onPresetParametersChange,
    bodyTemplateEnabled,
    onBodyTemplateEnabledChange,
    bodyTemplate,
    onBodyTemplateChange,
    onBodyTemplateValidityChange,
    timeoutMs,
    onTimeoutMsChange,
    customMessage,
    onCustomMessageChange,
    customMessageType,
    onCustomMessageTypeChange,
    customMessageRecordingId,
    onCustomMessageRecordingIdChange,
    recordings = [],
}: HttpApiToolConfigProps) {
    const { t } = useTranslation();
    const urlHostnameParameters = extractUrlHostnameParameters(url);
    const urlPathParameters = extractUrlPathParameters(url);

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t("tools.httpApi.title")}</CardTitle>
                <CardDescription>
                    {t("tools.httpApi.description")}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="settings" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="settings">{t("tools.httpApi.tabSettings")}</TabsTrigger>
                        <TabsTrigger value="auth">{t("tools.httpApi.tabAuth")}</TabsTrigger>
                        <TabsTrigger value="parameters">{t("tools.httpApi.tabParameters")}</TabsTrigger>
                    </TabsList>

                    <TabsContent value="settings" className="space-y-4 mt-4">
                        <div className="grid gap-2">
                            <Label>{t("tools.httpApi.nameLabel")}</Label>
                            <Label className="text-xs text-muted-foreground">
                                {t("tools.httpApi.nameHelp")}
                            </Label>
                            <Input
                                value={name}
                                onChange={(e) => onNameChange(e.target.value)}
                                placeholder={t("tools.httpApi.namePlaceholder")}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>{t("tools.httpApi.descriptionLabel")}</Label>
                            <Label className="text-xs text-muted-foreground">
                                {t("tools.httpApi.descriptionHelp")}
                            </Label>
                            <Textarea
                                value={description}
                                onChange={(e) => onDescriptionChange(e.target.value)}
                                placeholder={t("tools.httpApi.descriptionPlaceholder")}
                                rows={3}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>{t("tools.httpApi.httpMethod")}</Label>
                                <HttpMethodSelector
                                    value={httpMethod}
                                    onChange={onHttpMethodChange}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>{t("tools.httpApi.timeoutMs")}</Label>
                                <Input
                                    type="number"
                                    value={timeoutMs}
                                    onChange={(e) =>
                                        onTimeoutMsChange(parseInt(e.target.value) || 5000)
                                    }
                                    min={1000}
                                    max={30000}
                                />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label>{t("tools.httpApi.endpointUrl")}</Label>
                            <UrlInput
                                value={url}
                                onChange={onUrlChange}
                                placeholder="https://api.example.com/appointments"
                                showValidation
                            />
                            {urlHostnameParameters.length > 0 && (
                                <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-600 flex gap-2 items-start mt-2">
                                    <Info className="h-4 w-4 mt-0.5 shrink-0" />
                                    <span>
                                        {t("tools.httpApi.hostnameParamsDetected", { params: urlHostnameParameters.join(", ") })}
                                    </span>
                                </div>
                            )}
                            {urlPathParameters.length > 0 && (
                                <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-600 flex gap-2 items-start mt-2">
                                    <Info className="h-4 w-4 mt-0.5 shrink-0" />
                                    <span>
                                        {t("tools.httpApi.pathParamsDetected", { params: urlPathParameters.join(", ") })}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="grid gap-2 pt-4 border-t">
                            <Label>{t("tools.httpApi.customMessage")}</Label>
                            <Label className="text-xs text-muted-foreground">
                                {t("tools.httpApi.customMessageHelp")}
                            </Label>
                            <TextOrAudioInput
                                type={customMessageType}
                                onTypeChange={onCustomMessageTypeChange}
                                recordingId={customMessageRecordingId}
                                onRecordingIdChange={onCustomMessageRecordingIdChange}
                                recordings={recordings}
                            >
                                <>
                                    <StaticTextWarning />
                                    <Textarea
                                        value={customMessage}
                                        onChange={(e) => onCustomMessageChange(e.target.value)}
                                        placeholder={t("tools.httpApi.customMessagePlaceholder")}
                                        rows={2}
                                    />
                                </>
                            </TextOrAudioInput>
                        </div>
                    </TabsContent>

                    <TabsContent value="auth" className="space-y-4 mt-4">
                        <CredentialSelector
                            value={credentialUuid}
                            onChange={onCredentialUuidChange}
                        />
                    </TabsContent>

                    <TabsContent value="parameters" className="space-y-4 mt-4">
                        <div className="grid gap-2">
                            <Label>{t("tools.httpApi.llmParameters")}</Label>
                            <Label className="text-xs text-muted-foreground">
                                {t("tools.httpApi.llmParametersHelp")}
                            </Label>
                            <ParameterEditor
                                parameters={parameters}
                                onChange={onParametersChange}
                            />
                        </div>

                        <div className="grid gap-2 pt-4 border-t">
                            <Label>{t("tools.httpApi.presetParameters")}</Label>
                            <Label className="text-xs text-muted-foreground">
                                {t("tools.httpApi.presetParametersHelp", { example: "{{initial_context.phone_number}}" })}
                            </Label>
                            <PresetParameterEditor
                                parameters={presetParameters}
                                onChange={onPresetParametersChange}
                            />
                        </div>

                        {["POST", "PUT", "PATCH"].includes(httpMethod) && (
                            <div className="grid gap-4 pt-4 border-t">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="grid gap-1">
                                        <Label htmlFor="body-template-enabled">
                                            {t("tools.httpApi.bodyTemplate")}
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            {t("tools.httpApi.bodyTemplateHelp")}
                                        </p>
                                    </div>
                                    <Switch
                                        id="body-template-enabled"
                                        checked={bodyTemplateEnabled}
                                        onCheckedChange={onBodyTemplateEnabledChange}
                                    />
                                </div>
                                {bodyTemplateEnabled && (
                                    <BodyTemplateEditor
                                        value={bodyTemplate}
                                        onChange={onBodyTemplateChange}
                                        onValidityChange={onBodyTemplateValidityChange}
                                    />
                                )}
                            </div>
                        )}

                        <div className="grid gap-2 pt-4 border-t">
                            <Label>{t("tools.httpApi.customHeaders")}</Label>
                            <Label className="text-xs text-muted-foreground">
                                {t("tools.httpApi.customHeadersHelp")}
                            </Label>
                            <KeyValueEditor
                                items={headers}
                                onChange={onHeadersChange}
                                keyPlaceholder={t("tools.httpApi.headerKeyPlaceholder")}
                                valuePlaceholder={t("tools.httpApi.headerValuePlaceholder")}
                                addButtonText={t("tools.httpApi.addHeader")}
                            />
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
