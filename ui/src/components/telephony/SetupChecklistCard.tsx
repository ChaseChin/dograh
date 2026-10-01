"use client";

import { AlertTriangle, Check, Circle, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  ProviderSetupChecklist,
  TelephonyConfigurationDetail,
} from "@/client/types.gen";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  checklistStepText,
  telephonyBlockedReason,
} from "@/i18n/telephonyServerText";

interface SetupChecklistCardProps {
  checklist: ProviderSetupChecklist;
  /** "sip" connections need the customer's own carrier; "api" ones don't. */
  connectivity?: TelephonyConfigurationDetail["connectivity"];
  /** Provider name (e.g. "twilio"); localizes backend step text and
   * interpolates the provider's display name where the backend embeds it. */
  provider?: string;
}

/**
 * What this configuration still needs before it can carry calls.
 *
 * The provider decides the steps, so this renders generically rather than
 * knowing anything about Cloudonix. Blocking-and-incomplete steps are the ones
 * that make outbound calls fail, so they are the only ones tinted — otherwise
 * an inbound-only step reads as an error to someone who only wants to dial out.
 */
export function SetupChecklistCard({
  checklist,
  connectivity,
  provider,
}: SetupChecklistCardProps) {
  const { t } = useTranslation();
  const remaining = checklist.steps.filter((step) => !step.complete).length;

  // Nothing left to do: a wall of green checks on every working configuration
  // is noise, and the page already shows the phone numbers and endpoints.
  if (remaining === 0) return null;

  // The backend reports the blocked reason as the first blocking step's
  // description — derive it from the steps so it localizes the same way, and
  // fall back to source-text matching when the steps don't carry it.
  const blockingStep = checklist.steps.find(
    (step) => step.blocks_outbound && !step.complete,
  );
  const blockedReason = blockingStep
    ? checklistStepText(t, blockingStep, "description", provider)
    : telephonyBlockedReason(t, checklist.outbound_blocked_reason, provider);

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{t("telephony.checklist.title")}</CardTitle>
          {checklist.docs_url && (
            <a
              href={checklist.docs_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm underline"
            >
              {t("telephony.checklist.setupGuide")} <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <CardDescription>
          {connectivity === "sip"
            ? t("telephony.checklist.descriptionSip")
            : t("telephony.checklist.descriptionApi")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!checklist.ready_for_outbound && (
          <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm">
              <p className="font-medium">{t("telephony.checklist.blockedTitle")}</p>
              <p>{blockedReason}</p>
            </div>
          </div>
        )}

        <ol className="space-y-3">
          {checklist.steps.map((step) => {
            const blocking = step.blocks_outbound && !step.complete;
            return (
              <li key={step.key} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    step.complete
                      ? "border-green-600 bg-green-600 text-white"
                      : blocking
                        ? "border-amber-500 text-amber-600"
                        : "border-muted-foreground/40 text-muted-foreground"
                  }`}
                >
                  {step.complete ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Circle className="h-2 w-2 fill-current" />
                  )}
                </span>
                <div className="space-y-0.5">
                  <p
                    className={`text-sm font-medium ${
                      step.complete ? "text-muted-foreground" : ""
                    }`}
                  >
                    {checklistStepText(t, step, "title", provider)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {checklistStepText(t, step, "description", provider)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
