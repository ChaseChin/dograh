"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface BodyTemplateEditorProps {
    value: Record<string, unknown> | null;
    onChange: (value: Record<string, unknown> | null) => void;
    onValidityChange: (valid: boolean) => void;
}

export function BodyTemplateEditor({
    value,
    onChange,
    onValidityChange,
}: BodyTemplateEditorProps) {
    const { t } = useTranslation();
    const [text, setText] = useState(value ? JSON.stringify(value, null, 2) : "");
    const [error, setError] = useState(false);

    useEffect(() => onValidityChange(true), [onValidityChange]);

    const handleChange = (next: string) => {
        setText(next);
        if (!next.trim()) {
            setError(false);
            onValidityChange(true);
            onChange(null);
            return;
        }

        try {
            const parsed: unknown = JSON.parse(next);
            if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
                throw new Error();
            }
            setError(false);
            onValidityChange(true);
            onChange(parsed as Record<string, unknown>);
        } catch {
            setError(true);
            onValidityChange(false);
        }
    };

    return (
        <div className="grid gap-2">
            <Label>{t("tools.bodyTemplate.label")}</Label>
            <Label className="text-xs text-muted-foreground">
                {t("tools.bodyTemplate.help", {
                    param: "{{defined_llm_parameter}}",
                    context: "{{initial_context.call_id}}",
                })}
            </Label>
            <Textarea
                className="min-h-48 font-mono text-xs"
                value={text}
                onChange={(event) => handleChange(event.target.value)}
                placeholder={
                    '{\n  "customer": {\n    "id": "{{defined_llm_parameter}}"\n  },\n  "metadata": {\n    "call": {\n      "id": "{{initial_context.call_id}}"\n    }\n  }\n}'
                }
                spellCheck={false}
            />
            {error && <p className="text-xs text-destructive">{t("tools.bodyTemplate.invalidJson")}</p>}
        </div>
    );
}
