"use client";

import { Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  createTelephonyTrunkApiV1OrganizationsTelephonyConfigsConfigIdTrunksPost,
  deleteTelephonyTrunkApiV1OrganizationsTelephonyConfigsConfigIdTrunksTrunkIdDelete,
  updateTelephonyTrunkApiV1OrganizationsTelephonyConfigsConfigIdTrunksTrunkIdPut,
} from "@/client";
import type {
  PhoneNumberResponse,
  TelephonyConfigurationDetail,
  TrunkResponse,
} from "@/client/types.gen";
import {
  trunkProviderUi,
  type TrunkSettings,
} from "@/components/telephony/trunkProviders";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { detailFromError } from "@/lib/apiError";

interface TrunkCardProps {
  configuration: TelephonyConfigurationDetail;
  /** Every number on the configuration; the card picks out each trunk's own. */
  phoneNumbers: PhoneNumberResponse[];
  /** Refetch the configuration and its numbers after a change. */
  onChanged: () => void | Promise<void>;
  /** Open the phone-number dialog with this trunk already chosen. */
  onAddPhoneNumber: (trunk: TrunkResponse) => void;
  onEditPhoneNumber: (phoneNumber: PhoneNumberResponse) => void;
}

/**
 * The trunks on a configuration, each with the numbers that dial out on it.
 *
 * A number reaches a carrier through a trunk, so the two belong together — the
 * numbers table further down the page stays the flat view of every number,
 * including the ones that belong to no trunk.
 */
export function TrunkCard({
  configuration,
  phoneNumbers,
  onChanged,
  onAddPhoneNumber,
  onEditPhoneNumber,
}: TrunkCardProps) {
  const { t } = useTranslation();
  const providerUi = trunkProviderUi(configuration.provider);
  const trunks = configuration.trunks ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TrunkResponse | null>(null);
  const [name, setName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [settings, setSettings] = useState<TrunkSettings>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TrunkResponse | null>(null);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setEnabled(true);
    setSettings(providerUi.initialSettings(configuration));
    setDialogOpen(true);
  };

  const openEdit = (trunk: TrunkResponse) => {
    setEditing(trunk);
    setName(trunk.name);
    setEnabled(trunk.enabled);
    // Seeded from the trunk's own stored settings — a save must never carry
    // over a value the customer picked for a different trunk.
    setSettings({ ...((trunk.settings ?? {}) as TrunkSettings) });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error(t("telephony.trunks.nameRequired"));
      return;
    }
    const invalid = providerUi.validate?.(t, trimmed, settings);
    if (invalid) {
      toast.error(invalid);
      return;
    }

    setSubmitting(true);
    try {
      const body = { name: trimmed, enabled, settings };
      const response = editing
        ? await updateTelephonyTrunkApiV1OrganizationsTelephonyConfigsConfigIdTrunksTrunkIdPut(
            {
              path: { config_id: configuration.id, trunk_id: editing.id },
              body,
            },
          )
        : await createTelephonyTrunkApiV1OrganizationsTelephonyConfigsConfigIdTrunksPost(
            { path: { config_id: configuration.id }, body },
          );
      if (response.error) {
        throw new Error(detailFromError(response.error, t("telephony.trunks.saveFailed")));
      }
      toast.success(editing ? t("telephony.trunks.updated") : t("telephony.trunks.added"));
      setDialogOpen(false);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("telephony.trunks.saveFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      const response =
        await deleteTelephonyTrunkApiV1OrganizationsTelephonyConfigsConfigIdTrunksTrunkIdDelete(
          {
            path: { config_id: configuration.id, trunk_id: deleteTarget.id },
          },
        );
      if (response.error) {
        throw new Error(detailFromError(response.error, t("telephony.trunks.deleteFailed")));
      }
      toast.success(t("telephony.trunks.deleted", { name: deleteTarget.name }));
      setDeleteTarget(null);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("telephony.trunks.deleteFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const SettingsFields = providerUi.Fields;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>{t("telephony.trunks.title")}</CardTitle>
            <CardDescription>
              {t("telephony.trunks.description")}
            </CardDescription>
          </div>
          <Button size="sm" onClick={openCreate} disabled={submitting}>
            <Plus className="h-4 w-4 mr-2" /> {t("telephony.trunks.add")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {trunks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("telephony.trunks.empty")}
            </p>
          ) : (
            trunks.map((trunk) => {
              const assigned = phoneNumbers.filter(
                (number) => number.telephony_trunk_id === trunk.id,
              );
              const summary = providerUi.summarize?.(
                (trunk.settings ?? {}) as TrunkSettings,
              );
              return (
                <section key={trunk.id} className="overflow-hidden rounded-md border">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/20 p-3">
                    <div className="min-w-0 space-y-0.5">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate font-mono">{trunk.name}</span>
                        {!trunk.enabled && (
                          <Badge variant="outline" className="font-normal">
                            {t("common.disabled")}
                          </Badge>
                        )}
                      </p>
                      {summary && (
                        <p className="truncate text-xs text-muted-foreground">
                          {summary}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={submitting}
                        onClick={() => onAddPhoneNumber(trunk)}
                      >
                        <Plus className="h-4 w-4 mr-2" /> {t("telephony.trunks.addNumber")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={submitting}
                        onClick={() => openEdit(trunk)}
                        aria-label={t("telephony.trunks.editAria", { name: trunk.name })}
                        title={t("telephony.trunks.editTitle")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={submitting}
                        onClick={() => setDeleteTarget(trunk)}
                        aria-label={t("telephony.trunks.deleteAria", { name: trunk.name })}
                        title={t("telephony.trunks.deleteButtonTitle")}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {assigned.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">
                      {t("telephony.trunks.noNumbers")}
                    </p>
                  ) : (
                    <ul className="divide-y">
                      {assigned.map((number) => (
                        <li
                          key={number.id}
                          className="flex flex-wrap items-center justify-between gap-3 p-3"
                        >
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="truncate font-mono text-sm">
                              {number.address}
                            </span>
                            {number.label && (
                              <span className="truncate text-xs text-muted-foreground">
                                {number.label}
                              </span>
                            )}
                            {!number.is_active && (
                              <Badge variant="outline">{t("telephony.badges.inactive")}</Badge>
                            )}
                            {number.is_default_caller_id && (
                              <Badge className="gap-1">
                                <Star className="h-3 w-3 fill-current" />{" "}
                                {t("telephony.numbers.defaultCaller")}
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditPhoneNumber(number)}
                            aria-label={t("telephony.trunks.editNumberAria", { address: number.address })}
                            title={t("telephony.trunks.editNumberTitle")}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("telephony.trunks.editDialogTitle") : t("telephony.trunks.addDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("telephony.trunks.dialogDescription", { provider: configuration.provider })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="trunk-name">{t("telephony.trunks.name")}</Label>
              <Input
                id="trunk-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. primary-carrier"
                disabled={submitting}
              />
            </div>

            {SettingsFields && (
              <SettingsFields
                configuration={configuration}
                settings={settings}
                onChange={(patch) =>
                  setSettings((current) => ({ ...current, ...patch }))
                }
                disabled={submitting}
              />
            )}

            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="trunk-enabled">{t("common.enabled")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("telephony.trunks.enabledHelp")}
                </p>
              </div>
              <Switch
                id="trunk-enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
                disabled={submitting}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? t("common.saving") : t("telephony.trunks.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("telephony.trunks.deleteDialogTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("telephony.trunks.deleteBody", {
                name: deleteTarget?.name,
                provider: configuration.provider,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
