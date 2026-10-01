"use client";

import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { useDispositionCodes } from "@/hooks/useDispositionCodes";

type Row = {
  /** The VoiceWorker disposition being translated. Fixed for a built-in row. */
  source: string;
  /** What this organization calls it. Seeded with `source`. */
  target: string;
  /** Built-in rows come from the platform catalog and cannot be renamed. */
  builtIn: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Overrides currently stored, keyed by VoiceWorker disposition. */
  mapping: Record<string, string>;
  /** Persist the mapping and report whether the dialog may close. */
  onSave: (mapping: Record<string, string>) => Promise<boolean>;
};

/**
 * Build the editor's rows: the platform's built-in dispositions seeded with
 * themselves, plus a row for every override on a disposition not in that list.
 *
 * Those extra rows matter because a workflow's end-call tool passes the model's
 * own free-text reason straight through as the disposition, so an override can
 * legitimately name something no enum contains. Dropping such a row here would
 * silently discard the override on save.
 */
function buildRows(systemCodes: string[], mapping: Record<string, string>): Row[] {
  const builtIn = systemCodes.map((source) => ({
    source,
    target: mapping[source] ?? source,
    builtIn: true,
  }));
  const known = new Set(systemCodes);
  const custom = Object.entries(mapping)
    .filter(([source]) => !known.has(source))
    .map(([source, target]) => ({ source, target, builtIn: false }));
  return [...builtIn, ...custom];
}

/**
 * Only the rows that changed something. An identity row carries no information:
 * a disposition mapped to itself behaves exactly as an unmapped one, and storing
 * it would freeze the mapping against today's disposition catalog.
 */
function toMapping(rows: Row[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const row of rows) {
    const source = row.source.trim();
    const target = row.target.trim();
    if (!source || !target || source === target) continue;
    mapping[source] = target;
  }
  return mapping;
}

export function DispositionMappingDialog({
  open,
  onOpenChange,
  mapping,
  onSave,
}: Props) {
  const { t } = useTranslation();
  const { systemCodes, isLoading } = useDispositionCodes();
  const [rows, setRows] = useState<Row[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Reseed each time the dialog opens so a cancelled edit is discarded and a
  // newly loaded catalog is picked up.
  useEffect(() => {
    if (!open || isLoading) return;
    setRows(buildRows(systemCodes, mapping));
    // `mapping` is only read when the dialog opens; re-seeding on every parent
    // render would throw away what the user is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isLoading, systemCodes]);

  const overrideCount = useMemo(
    () => Object.keys(toMapping(rows)).length,
    [rows],
  );

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row, position) =>
        position === index ? { ...row, ...patch } : row,
      ),
    );
  }

  function addRow() {
    setRows((current) => [
      ...current,
      { source: "", target: "", builtIn: false },
    ]);
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_row, position) => position !== index));
  }

  async function handleSave() {
    if (isSaving) return;

    setIsSaving(true);
    try {
      const saved = await onSave(toMapping(rows));
      if (saved) onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!isSaving) onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("settings.dispositionMapping.title")}</DialogTitle>
          <DialogDescription>
            {t("settings.dispositionMapping.description")}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">
            {t("settings.dispositionMapping.loading")}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-x-3 gap-y-1 px-1 text-xs font-medium text-muted-foreground">
              <span>{t("settings.dispositionMapping.sourceColumn")}</span>
              <span>{t("settings.dispositionMapping.targetColumn")}</span>
              <span className="w-8" />
            </div>

            <div className="max-h-[50vh] space-y-2 overflow-y-auto px-1 pb-1">
              {rows.map((row, index) => {
                const changed =
                  row.target.trim() !== "" &&
                  row.target.trim() !== row.source.trim();
                return (
                  <div
                    key={row.builtIn ? row.source : `custom-${index}`}
                    className="grid grid-cols-[1fr_1fr_auto] items-center gap-3"
                  >
                    {row.builtIn ? (
                      <Label
                        htmlFor={`disposition-target-${index}`}
                        className="truncate font-mono text-xs font-normal"
                        title={row.source}
                      >
                        {row.source}
                      </Label>
                    ) : (
                      <Input
                        aria-label={t("settings.dispositionMapping.sourceColumn")}
                        value={row.source}
                        disabled={isSaving}
                        onChange={(event) =>
                          updateRow(index, { source: event.target.value })
                        }
                        placeholder={t("settings.dispositionMapping.sourcePlaceholder")}
                        className="font-mono text-xs"
                      />
                    )}
                    <Input
                      id={`disposition-target-${index}`}
                      aria-label={t("settings.dispositionMapping.targetAria", {
                        source: row.source || t("settings.dispositionMapping.newDisposition"),
                      })}
                      value={row.target}
                      disabled={isSaving}
                      onChange={(event) =>
                        updateRow(index, { target: event.target.value })
                      }
                      placeholder={row.source || t("settings.dispositionMapping.targetColumn")}
                      className="font-mono text-xs"
                    />
                    {row.builtIn ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        // Disabled rather than hidden so the column does not
                        // reflow as rows are edited.
                        disabled={isSaving || !changed}
                        onClick={() => updateRow(index, { target: row.source })}
                        title={t("settings.dispositionMapping.resetTitle")}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span className="sr-only">
                          {t("settings.dispositionMapping.resetSr", { source: row.source })}
                        </span>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={isSaving}
                        onClick={() => removeRow(index)}
                        title={t("settings.dispositionMapping.removeTitle")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">
                          {t("settings.dispositionMapping.removeSr", {
                            source: row.source || t("settings.dispositionMapping.thisDisposition"),
                          })}
                        </span>
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSaving}
                onClick={addRow}
              >
                <Plus className="mr-2 h-3.5 w-3.5" />
                {t("settings.dispositionMapping.addRow")}
              </Button>
              <p className="text-xs text-muted-foreground">
                {overrideCount === 0
                  ? t("settings.dispositionMapping.noOverrides")
                  : t("settings.dispositionMapping.overrideCount", { count: overrideCount })}
              </p>
            </div>
          </>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isLoading || isSaving}
          >
            {isSaving ? t("common.saving") : t("settings.dispositionMapping.saveMapping")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
