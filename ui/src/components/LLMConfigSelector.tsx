"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { getDefaultConfigurationsApiV1UserConfigurationsDefaultsGet } from "@/client/sdk.gen";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { serverText } from "@/i18n/serverText";

interface SchemaProperty {
    type?: string;
    default?: string | number | boolean;
    enum?: string[];
    examples?: string[];
    $ref?: string;
}

interface ProviderSchema {
    title?: string;
    properties: Record<string, SchemaProperty>;
    required?: string[];
    $defs?: Record<string, SchemaProperty>;
}

interface LLMConfigSelectorProps {
    provider: string;
    onProviderChange: (provider: string) => void;
    model: string;
    onModelChange: (model: string) => void;
    apiKey: string;
    onApiKeyChange: (apiKey: string) => void;
}

export function LLMConfigSelector({
    provider,
    onProviderChange,
    model,
    onModelChange,
    apiKey,
    onApiKeyChange,
}: LLMConfigSelectorProps) {
    const { t } = useTranslation();
    const [schemas, setSchemas] = useState<Record<string, ProviderSchema>>({});
    const [isManualModelInput, setIsManualModelInput] = useState(false);

    useEffect(() => {
        const fetchSchemas = async () => {
            const response =
                await getDefaultConfigurationsApiV1UserConfigurationsDefaultsGet();
            if (response.data?.llm) {
                setSchemas(response.data.llm as unknown as Record<string, ProviderSchema>);
            }
        };
        fetchSchemas();
    }, []);

    const availableProviders = Object.keys(schemas);
    const providerSchema = schemas[provider];

    const getModelOptions = (): string[] => {
        if (!providerSchema) return [];
        const modelSchema = providerSchema.properties.model;
        const actualSchema =
            modelSchema?.$ref && providerSchema.$defs
                ? providerSchema.$defs[modelSchema.$ref.split("/").pop() || ""]
                : modelSchema;
        return actualSchema?.examples || [];
    };

    const modelOptions = getModelOptions();

    // Check if current model is not in options (custom model)
    useEffect(() => {
        if (model && modelOptions.length > 0 && !modelOptions.includes(model)) {
            setIsManualModelInput(true);
        }
    }, [model, modelOptions]);

    const handleProviderChange = (newProvider: string) => {
        if (!newProvider) return;
        onProviderChange(newProvider);
        const newSchema = schemas[newProvider];
        if (newSchema?.properties?.model) {
            const modelSchema = newSchema.properties.model;
            const actualSchema =
                modelSchema.$ref && newSchema.$defs
                    ? newSchema.$defs[modelSchema.$ref.split("/").pop() || ""]
                    : modelSchema;
            const defaultModel =
                (actualSchema?.default as string) ||
                actualSchema?.examples?.[0] ||
                "";
            onModelChange(defaultModel);
        }
        setIsManualModelInput(false);
    };

    return (
        <div className="space-y-4 p-3 border rounded-md bg-muted/10">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>{t("modelConfigs.form.provider")}</Label>
                    <Select value={provider} onValueChange={handleProviderChange}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder={t("modelConfigs.form.selectProvider")} />
                        </SelectTrigger>
                        <SelectContent>
                            {availableProviders.map((p) => (
                                <SelectItem key={p} value={p}>
                                    {serverText(t, `modelConfigs.providerTitle.${p}`, schemas[p]?.title || p)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>{t("modelConfigs.llmSelector.model")}</Label>
                    {isManualModelInput ? (
                        <div className="space-y-2">
                            <Input
                                type="text"
                                placeholder={t("modelConfigs.llmSelector.enterModel")}
                                value={model}
                                onChange={(e) => onModelChange(e.target.value)}
                            />
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="qa-manual-model"
                                    checked={isManualModelInput}
                                    onCheckedChange={(checked) => {
                                        setIsManualModelInput(checked as boolean);
                                        if (!checked && modelOptions.length > 0) {
                                            onModelChange(modelOptions[0]);
                                        }
                                    }}
                                />
                                <Label
                                    htmlFor="qa-manual-model"
                                    className="text-sm font-normal cursor-pointer"
                                >
                                    {t("modelConfigs.llmSelector.addModelManually")}
                                </Label>
                            </div>
                        </div>
                    ) : modelOptions.length > 0 ? (
                        <div className="space-y-2">
                            <Select
                                value={model}
                                onValueChange={(v) => {
                                    if (v) onModelChange(v);
                                }}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder={t("modelConfigs.llmSelector.selectModel")} />
                                </SelectTrigger>
                                <SelectContent>
                                    {modelOptions.map((m) => (
                                        <SelectItem key={m} value={m}>
                                            {m}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="qa-manual-model-dropdown"
                                    checked={isManualModelInput}
                                    onCheckedChange={(checked) =>
                                        setIsManualModelInput(checked as boolean)
                                    }
                                />
                                <Label
                                    htmlFor="qa-manual-model-dropdown"
                                    className="text-sm font-normal cursor-pointer"
                                >
                                    {t("modelConfigs.llmSelector.addModelManually")}
                                </Label>
                            </div>
                        </div>
                    ) : (
                        <Input
                            type="text"
                            placeholder={t("modelConfigs.llmSelector.enterModel")}
                            value={model}
                            onChange={(e) => onModelChange(e.target.value)}
                        />
                    )}
                </div>
            </div>

            <div className="space-y-2">
                <Label>{t("modelConfigs.llmSelector.apiKeyLabel")}</Label>
                <Input
                    type="text"
                    placeholder={t("modelConfigs.form.enterApiKey")}
                    value={apiKey}
                    onChange={(e) => onApiKeyChange(e.target.value)}
                />
            </div>
        </div>
    );
}
