"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { ToolParameter as ApiToolParameter } from "@/client/types.gen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export type ParameterType = ApiToolParameter["type"];

export interface ToolParameter {
    name: string;
    type: ParameterType;
    description: string;
    required: boolean;
}

export interface PresetToolParameter {
    name: string;
    type: ParameterType;
    valueTemplate: string;
    required: boolean;
}

interface ParameterEditorProps {
    parameters: ToolParameter[];
    onChange: (parameters: ToolParameter[]) => void;
    disabled?: boolean;
}

export function ParameterEditor({
    parameters,
    onChange,
    disabled = false,
}: ParameterEditorProps) {
    const { t } = useTranslation();

    const addParameter = () => {
        onChange([
            ...parameters,
            { name: "", type: "string", description: "", required: true },
        ]);
    };

    const updateParameter = (
        index: number,
        field: keyof ToolParameter,
        value: string | boolean
    ) => {
        const newParams = [...parameters];
        newParams[index] = { ...newParams[index], [field]: value };
        onChange(newParams);
    };

    const removeParameter = (index: number) => {
        onChange(parameters.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-4">
            {parameters.length === 0 && (
                <div className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-md">
                    {t("tools.parameterEditor.empty")}
                </div>
            )}

            {parameters.map((param, index) => (
                <div
                    key={index}
                    className="border rounded-lg p-4 space-y-3 bg-muted/20"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">
                            {t("tools.parameterEditor.parameterTitle", { index: index + 1 })}
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeParameter(index)}
                            disabled={disabled}
                            className="h-8 w-8"
                        >
                            <Trash2Icon className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">{t("tools.parameterEditor.nameLabel")}</Label>
                            <Label className="text-xs text-muted-foreground">
                                {t("tools.parameterEditor.nameHelp")}
                            </Label>
                            <Input
                                placeholder={t("tools.parameterEditor.namePlaceholder")}
                                value={param.name}
                                onChange={(e) =>
                                    updateParameter(index, "name", e.target.value)
                                }
                                disabled={disabled}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">{t("tools.parameterEditor.typeLabel")}</Label>
                            <Label className="text-xs text-muted-foreground">
                                {t("tools.parameterEditor.typeHelp")}
                            </Label>
                            <Select
                                value={param.type}
                                onValueChange={(value: ParameterType) =>
                                    updateParameter(index, "type", value)
                                }
                                disabled={disabled}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={t("tools.parameterEditor.selectType")} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="string">{t("tools.parameterEditor.types.string")}</SelectItem>
                                    <SelectItem value="number">{t("tools.parameterEditor.types.number")}</SelectItem>
                                    <SelectItem value="boolean">{t("tools.parameterEditor.types.boolean")}</SelectItem>
                                    <SelectItem value="object">{t("tools.parameterEditor.types.object")}</SelectItem>
                                    <SelectItem value="array">{t("tools.parameterEditor.types.array")}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs">{t("tools.parameterEditor.descriptionLabel")}</Label>
                        <Label className="text-xs text-muted-foreground">
                            {t("tools.parameterEditor.descriptionHelp")}
                        </Label>
                        <Input
                            placeholder={t("tools.parameterEditor.descriptionPlaceholder")}
                            value={param.description}
                            onChange={(e) =>
                                updateParameter(index, "description", e.target.value)
                            }
                            disabled={disabled}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Switch
                            id={`required-${index}`}
                            checked={param.required}
                            onCheckedChange={(checked) =>
                                updateParameter(index, "required", checked)
                            }
                            disabled={disabled}
                        />
                        <Label htmlFor={`required-${index}`} className="text-sm">
                            {t("tools.parameterEditor.required")}
                        </Label>
                    </div>
                </div>
            ))}

            <Button
                variant="outline"
                size="sm"
                onClick={addParameter}
                className="w-fit"
                disabled={disabled}
            >
                <PlusIcon className="h-4 w-4 mr-1" /> {t("tools.parameterEditor.addParameter")}
            </Button>
        </div>
    );
}

interface PresetParameterEditorProps {
    parameters: PresetToolParameter[];
    onChange: (parameters: PresetToolParameter[]) => void;
    disabled?: boolean;
}

export function PresetParameterEditor({
    parameters,
    onChange,
    disabled = false,
}: PresetParameterEditorProps) {
    const { t } = useTranslation();

    const addParameter = () => {
        onChange([
            ...parameters,
            { name: "", type: "string", valueTemplate: "", required: true },
        ]);
    };

    const updateParameter = (
        index: number,
        field: keyof PresetToolParameter,
        value: string | boolean
    ) => {
        const newParams = [...parameters];
        newParams[index] = { ...newParams[index], [field]: value };
        onChange(newParams);
    };

    const removeParameter = (index: number) => {
        onChange(parameters.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-4">
            {parameters.length === 0 && (
                <div className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-md">
                    {t("tools.parameterEditor.presetEmpty")}
                </div>
            )}

            {parameters.map((param, index) => (
                <div
                    key={index}
                    className="border rounded-lg p-4 space-y-3 bg-muted/20"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">
                            {t("tools.parameterEditor.presetTitle", { index: index + 1 })}
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeParameter(index)}
                            disabled={disabled}
                            className="h-8 w-8"
                        >
                            <Trash2Icon className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">{t("tools.parameterEditor.nameLabel")}</Label>
                            <Label className="text-xs text-muted-foreground">
                                {t("tools.parameterEditor.presetNameHelp")}
                            </Label>
                            <Input
                                placeholder={t("tools.parameterEditor.presetNamePlaceholder")}
                                value={param.name}
                                onChange={(e) =>
                                    updateParameter(index, "name", e.target.value)
                                }
                                disabled={disabled}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">{t("tools.parameterEditor.typeLabel")}</Label>
                            <Label className="text-xs text-muted-foreground">
                                {t("tools.parameterEditor.presetTypeHelp")}
                            </Label>
                            <Select
                                value={param.type}
                                onValueChange={(value: ParameterType) =>
                                    updateParameter(index, "type", value)
                                }
                                disabled={disabled}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={t("tools.parameterEditor.selectType")} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="string">{t("tools.parameterEditor.types.string")}</SelectItem>
                                    <SelectItem value="number">{t("tools.parameterEditor.types.number")}</SelectItem>
                                    <SelectItem value="boolean">{t("tools.parameterEditor.types.boolean")}</SelectItem>
                                    <SelectItem value="object">{t("tools.parameterEditor.types.object")}</SelectItem>
                                    <SelectItem value="array">{t("tools.parameterEditor.types.array")}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs">{t("tools.parameterEditor.valueTemplateLabel")}</Label>
                        <Label className="text-xs text-muted-foreground">
                            {t("tools.parameterEditor.valueTemplateHelp", {
                                example1: "{{initial_context.phone_number}}",
                                example2: "{{gathered_context.customer_id}}",
                            })}
                        </Label>
                        <Input
                            placeholder={t("tools.parameterEditor.valueTemplatePlaceholder", { example: "{{initial_context.phone_number}}" })}
                            value={param.valueTemplate}
                            onChange={(e) =>
                                updateParameter(index, "valueTemplate", e.target.value)
                            }
                            disabled={disabled}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Switch
                            id={`preset-required-${index}`}
                            checked={param.required}
                            onCheckedChange={(checked) =>
                                updateParameter(index, "required", checked)
                            }
                            disabled={disabled}
                        />
                        <Label htmlFor={`preset-required-${index}`} className="text-sm">
                            {t("tools.parameterEditor.required")}
                        </Label>
                    </div>
                </div>
            ))}

            <Button
                variant="outline"
                size="sm"
                onClick={addParameter}
                className="w-fit"
                disabled={disabled}
            >
                <PlusIcon className="h-4 w-4 mr-1" /> {t("tools.parameterEditor.addPresetParameter")}
            </Button>
        </div>
    );
}
