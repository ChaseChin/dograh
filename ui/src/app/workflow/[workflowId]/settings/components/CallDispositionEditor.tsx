"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createUuid } from "@/lib/uuid";
import type { CallDispositionOption } from "@/types/workflow-configurations";

export const MAX_CALL_DISPOSITIONS = 50;
export const MAX_CALL_DISPOSITION_CODE_LENGTH = 64;
export const MAX_CALL_DISPOSITION_DESCRIPTION_LENGTH = 1000;
export const MAX_CALL_DISPOSITION_DESCRIPTIONS_TOTAL_LENGTH = 4000;

const CALL_DISPOSITION_CODE_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;

export interface CallDispositionRow extends CallDispositionOption {
    id: string;
}

interface RowErrors {
    code?: string;
    description?: string;
}

export interface CallDispositionValidation {
    isValid: boolean;
    rowErrors: Record<string, RowErrors>;
    totalDescriptionLength: number;
    totalError?: string;
}

export function createCallDispositionRows(
    dispositions: CallDispositionOption[],
): CallDispositionRow[] {
    return dispositions.map((disposition) => ({
        id: createUuid(),
        ...disposition,
    }));
}

export function normalizeCallDispositions(
    rows: CallDispositionRow[],
): CallDispositionOption[] {
    return rows.map(({ code, description }) => ({
        code: code.trim(),
        description: description.trim(),
    }));
}

// Minimal translate-function shape, compatible with react-i18next's TFunction,
// so this pure validator stays decoupled from React.
type DispositionTranslate = (key: string, options?: Record<string, unknown>) => string;

export function validateCallDispositionRows(
    rows: CallDispositionRow[],
    t: DispositionTranslate,
): CallDispositionValidation {
    const rowErrors: Record<string, RowErrors> = {};
    const codeCounts = new Map<string, number>();

    for (const row of rows) {
        const code = row.code.trim();
        if (code) {
            const normalizedCode = code.toLowerCase();
            codeCounts.set(normalizedCode, (codeCounts.get(normalizedCode) ?? 0) + 1);
        }
    }

    for (const row of rows) {
        const code = row.code.trim();
        const description = row.description.trim();
        const errors: RowErrors = {};

        if (!code) {
            errors.code = t("workflow.dispositions.errors.codeRequired");
        } else if (code.length > MAX_CALL_DISPOSITION_CODE_LENGTH) {
            errors.code = t("workflow.dispositions.errors.codeTooLong", { max: MAX_CALL_DISPOSITION_CODE_LENGTH });
        } else if (!CALL_DISPOSITION_CODE_PATTERN.test(code)) {
            errors.code = t("workflow.dispositions.errors.codePattern");
        } else if ((codeCounts.get(code.toLowerCase()) ?? 0) > 1) {
            errors.code = t("workflow.dispositions.errors.codeDuplicate");
        }

        if (!description) {
            errors.description = t("workflow.dispositions.errors.descriptionRequired");
        } else if (description.length > MAX_CALL_DISPOSITION_DESCRIPTION_LENGTH) {
            errors.description = t("workflow.dispositions.errors.descriptionTooLong", { max: MAX_CALL_DISPOSITION_DESCRIPTION_LENGTH.toLocaleString() });
        }

        if (errors.code || errors.description) {
            rowErrors[row.id] = errors;
        }
    }

    const totalDescriptionLength = rows.reduce(
        (total, row) => total + row.description.trim().length,
        0,
    );
    const totalError = totalDescriptionLength > MAX_CALL_DISPOSITION_DESCRIPTIONS_TOTAL_LENGTH
        ? t("workflow.dispositions.errors.totalTooLong", { max: MAX_CALL_DISPOSITION_DESCRIPTIONS_TOTAL_LENGTH.toLocaleString() })
        : undefined;

    return {
        isValid:
            rows.length <= MAX_CALL_DISPOSITIONS
            && Object.keys(rowErrors).length === 0
            && !totalError,
        rowErrors,
        totalDescriptionLength,
        totalError,
    };
}

export function CallDispositionEditor({
    rows,
    onChange,
    defaultDispositions = [],
}: {
    rows: CallDispositionRow[];
    onChange: (rows: CallDispositionRow[]) => void;
    defaultDispositions?: CallDispositionOption[];
}) {
    const { t } = useTranslation();
    const enabled = rows.length > 0;
    const rememberedRows = useRef<CallDispositionRow[]>(rows);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [draftRows, setDraftRows] = useState<CallDispositionRow[]>([]);

    useEffect(() => {
        if (rows.length > 0) {
            rememberedRows.current = rows;
        }
    }, [rows]);

    const openEditor = (editorRows: CallDispositionRow[]) => {
        setDraftRows(editorRows.map((row) => ({ ...row })));
        setDialogOpen(true);
    };

    const handleEnabledChange = (checked: boolean) => {
        if (!checked) {
            rememberedRows.current = rows;
            onChange([]);
            return;
        }

        const options = rememberedRows.current.length > 0
            ? rememberedRows.current
            : createCallDispositionRows(defaultDispositions);
        openEditor(options);
    };

    const handleApply = () => {
        const validation = validateCallDispositionRows(draftRows, t);
        if (draftRows.length === 0 || !validation.isValid) return;

        rememberedRows.current = draftRows;
        onChange(draftRows);
        setDialogOpen(false);
    };

    const draftValidation = validateCallDispositionRows(draftRows, t);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-6">
                <div className="space-y-1">
                    <Label htmlFor="call-disposition-extraction-enabled" className="text-sm font-medium">
                        {t("workflow.dispositions.toggleLabel")}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                        {enabled
                            ? t("workflow.dispositions.enabledSummary", { count: rows.length })
                            : t("workflow.dispositions.disabledSummary")}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                    {enabled && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEditor(rows)}
                        >
                            {t("workflow.dispositions.configureOptions")}
                        </Button>
                    )}
                    <Switch
                        id="call-disposition-extraction-enabled"
                        checked={enabled}
                        onCheckedChange={handleEnabledChange}
                    />
                </div>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-h-[90vh] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{t("workflow.dispositions.dialogTitle")}</DialogTitle>
                        <DialogDescription>
                            {t("workflow.dispositions.dialogDescription")}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="min-h-0 overflow-y-auto pr-1">
                        <CallDispositionRowsEditor
                            rows={draftRows}
                            onChange={setDraftRows}
                            validation={draftValidation}
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDialogOpen(false)}
                        >
                            {t("common.cancel")}
                        </Button>
                        <Button
                            type="button"
                            disabled={draftRows.length === 0 || !draftValidation.isValid}
                            onClick={handleApply}
                        >
                            {enabled ? t("workflow.dispositions.saveOptions") : t("workflow.dispositions.enableExtraction")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function CallDispositionRowsEditor({
    rows,
    onChange,
    validation,
}: {
    rows: CallDispositionRow[];
    onChange: (rows: CallDispositionRow[]) => void;
    validation: CallDispositionValidation;
}) {
    const { t } = useTranslation();

    const updateRow = (
        rowId: string,
        update: Partial<Pick<CallDispositionRow, "code" | "description">>,
    ) => {
        onChange(rows.map((row) => (row.id === rowId ? { ...row, ...update } : row)));
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
                <Label className="text-sm">{t("workflow.dispositions.optionsLabel")}</Label>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={rows.length >= MAX_CALL_DISPOSITIONS}
                    onClick={() => onChange([
                        ...rows,
                        { id: createUuid(), code: "", description: "" },
                    ])}
                >
                    <Plus className="mr-1 h-4 w-4" /> {t("workflow.dispositions.addCustom")}
                </Button>
            </div>

            <div className="space-y-2">
                {rows.map((row, index) => {
                    const errors = validation.rowErrors[row.id];
                    const codeId = `call-disposition-code-${row.id}`;
                    const descriptionId = `call-disposition-description-${row.id}`;
                    return (
                        <div
                            key={row.id}
                            className="rounded-md border bg-background p-3"
                        >
                            <div className="flex items-start gap-3">
                                <div className="min-w-0 flex-1 space-y-3">
                                    <p className="text-xs font-medium text-muted-foreground">
                                        {t("workflow.dispositions.dispositionNumber", { index: index + 1 })}
                                    </p>
                                    <div className="space-y-1.5">
                                        <Label htmlFor={codeId} className="text-xs">
                                            {t("workflow.dispositions.codeLabel")}
                                        </Label>
                                        <Input
                                            id={codeId}
                                            value={row.code}
                                            maxLength={MAX_CALL_DISPOSITION_CODE_LENGTH}
                                            aria-invalid={Boolean(errors?.code)}
                                            aria-describedby={errors?.code ? `${codeId}-error` : undefined}
                                            onChange={(event) => updateRow(row.id, { code: event.target.value })}
                                            placeholder={t("workflow.dispositions.codePlaceholder")}
                                        />
                                        {errors?.code && (
                                            <p id={`${codeId}-error`} className="text-xs text-destructive">
                                                {errors.code}
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor={descriptionId} className="text-xs">
                                            {t("workflow.dispositions.descriptionLabel")}
                                        </Label>
                                        <Textarea
                                            id={descriptionId}
                                            value={row.description}
                                            rows={3}
                                            maxLength={MAX_CALL_DISPOSITION_DESCRIPTION_LENGTH}
                                            aria-invalid={Boolean(errors?.description)}
                                            aria-describedby={errors?.description ? `${descriptionId}-error` : undefined}
                                            onChange={(event) => updateRow(row.id, { description: event.target.value })}
                                            placeholder={t("workflow.dispositions.descriptionPlaceholder")}
                                        />
                                        {errors?.description && (
                                            <p id={`${descriptionId}-error`} className="text-xs text-destructive">
                                                {errors.description}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t("workflow.dispositions.removeAria", { index: index + 1 })}
                                    onClick={() => onChange(rows.filter((item) => item.id !== row.id))}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    );
                })}

                {rows.length === 0 && (
                    <div className="rounded-md border border-dashed p-4 text-center">
                        <p className="text-sm font-medium">{t("workflow.dispositions.emptyTitle")}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {t("workflow.dispositions.emptyBody")}
                        </p>
                    </div>
                )}

                <div className="flex justify-end text-xs text-muted-foreground">
                    <p className={validation.totalError ? "text-destructive" : undefined}>
                        {t("workflow.dispositions.charCounter", {
                            used: validation.totalDescriptionLength.toLocaleString(),
                            max: MAX_CALL_DISPOSITION_DESCRIPTIONS_TOTAL_LENGTH.toLocaleString(),
                        })}
                    </p>
                </div>
                {validation.totalError && (
                    <p className="text-xs text-destructive">{validation.totalError}</p>
                )}
            </div>
        </div>
    );
}
