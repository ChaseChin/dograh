"use client";

import { useTranslation } from "react-i18next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface TransferAgentWorkflowOption {
    id: number;
    name: string;
}

export interface TransferAgentToolConfigProps {
    name: string;
    onNameChange: (name: string) => void;
    description: string;
    onDescriptionChange: (description: string) => void;
    /** The agent this tool transfers to. */
    workflowId: string;
    onWorkflowIdChange: (workflowId: string) => void;
    /** Agents in this organization, offered as the destination. */
    workflows: TransferAgentWorkflowOption[];
    workflowsLoading?: boolean;
    message: string;
    onMessageChange: (message: string) => void;
}

export function TransferAgentToolConfig({
    name,
    onNameChange,
    description,
    onDescriptionChange,
    workflowId,
    onWorkflowIdChange,
    workflows,
    workflowsLoading = false,
    message,
    onMessageChange,
}: TransferAgentToolConfigProps) {
    const { t } = useTranslation();

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t("tools.transferAgent.title")}</CardTitle>
                <CardDescription>
                    {t("tools.transferAgent.description")}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-2">
                    <Label htmlFor="transfer-agent-name">{t("tools.transferAgent.nameLabel")}</Label>
                    <Label className="text-xs text-muted-foreground">
                        {t("tools.transferAgent.nameHelp")}
                    </Label>
                    <Input
                        id="transfer-agent-name"
                        value={name}
                        onChange={(e) => onNameChange(e.target.value)}
                        placeholder={t("tools.transferAgent.namePlaceholder")}
                    />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="transfer-agent-description">{t("tools.transferAgent.descriptionLabel")}</Label>
                    <Label className="text-xs text-muted-foreground">
                        {t("tools.transferAgent.descriptionHelp")}
                    </Label>
                    <Textarea
                        id="transfer-agent-description"
                        value={description}
                        onChange={(e) => onDescriptionChange(e.target.value)}
                        placeholder={t("tools.transferAgent.descriptionPlaceholder")}
                        rows={3}
                    />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="transfer-agent-workflow">{t("tools.transferAgent.transferToAgent")}</Label>
                    <Select value={workflowId} onValueChange={onWorkflowIdChange}>
                        <SelectTrigger id="transfer-agent-workflow">
                            <SelectValue
                                placeholder={
                                    workflowsLoading
                                        ? t("tools.transferAgent.loadingAgents")
                                        : t("tools.transferAgent.selectAgent")
                                }
                            />
                        </SelectTrigger>
                        <SelectContent>
                            {workflows.map((workflow) => (
                                <SelectItem key={workflow.id} value={String(workflow.id)}>
                                    {workflow.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="transfer-agent-message">{t("tools.transferAgent.handoverMessage")}</Label>
                    <Label className="text-xs text-muted-foreground">
                        {t("tools.transferAgent.handoverMessageHelp")}
                    </Label>
                    <Input
                        id="transfer-agent-message"
                        value={message}
                        onChange={(e) => onMessageChange(e.target.value)}
                        placeholder={t("tools.transferAgent.handoverMessagePlaceholder")}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
