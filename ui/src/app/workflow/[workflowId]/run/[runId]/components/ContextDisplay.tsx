"use client";

import { useTranslation } from "react-i18next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ContextDisplayProps {
    title: string;
    context: Record<string, string | number | boolean | object> | null;
}

export const ContextDisplay = ({ title, context }: ContextDisplayProps) => {
    const { t } = useTranslation();

    if (!context || Object.keys(context).length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">{t("workflow.run.context.noTitleAvailable", { title: title.toLowerCase() })}</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {Object.entries(context).map(([key, value]) => (
                    <div key={key} className="space-y-1">
                        <label className="text-sm font-medium text-muted-foreground">
                            {key}
                        </label>
                        <div className="p-3 bg-muted border rounded-md">
                            <p className="text-sm whitespace-pre-wrap">
                                {typeof value === 'object' && value !== null ? JSON.stringify(value, null, 2) : (value || t("workflow.run.context.noValue"))}
                            </p>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
};
