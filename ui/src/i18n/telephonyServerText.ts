import type { TFunction } from "i18next";

import { serverText } from "./serverText";

// Backend-delivered telephony text (provider display names, form field
// labels/descriptions/sections, setup-checklist steps, blocked reasons) is
// localized UI-side via dictionary maps keyed by stable identifiers (provider
// name, field name, step key). Unknown text falls back to the backend string
// so providers/steps without a mapping still render (in English).
//
// Some backend strings have several variants under one stable key (e.g. the
// cloudonix `sip_domain` step differs between Dograh-managed and
// customer-owned domains). Variants are disambiguated by comparing the
// English source text: the candidate key whose `en` rendering equals the
// backend string wins, and its current-locale rendering is returned.

// Distinct from any real translation so a missing key is detectable; the
// project i18n init sets `returnEmptyString: false`, so "" would not work.
const MISSING = "__telephony_server_text_missing__";

function lookup(
  t: TFunction,
  key: string,
  params?: Record<string, unknown>,
): string | undefined {
  const value = (t as (k: string, o?: Record<string, unknown>) => string)(key, {
    ...params,
    defaultValue: MISSING,
  });
  return value === MISSING ? undefined : value;
}

/**
 * `key` translated in the current locale, but only when its English source
 * rendering equals `backendText` — so a stale or drifted backend string falls
 * back to the raw text instead of a mismatched translation.
 */
function matchSource(
  t: TFunction,
  key: string,
  backendText: string,
  params?: Record<string, unknown>,
): string | undefined {
  const en = lookup(t, key, { ...params, lng: "en" });
  if (en === undefined || en !== backendText) return undefined;
  return lookup(t, key, params) ?? backendText;
}

// Brand names are stable and never translated; they are needed here as
// interpolation params for backend strings that embed the provider's display
// name (the shared caller-ID checklist step).
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  ari: "Asterisk ARI",
  cloudonix: "Cloudonix",
  exotel: "Exotel",
  plivo: "Plivo",
  telnyx: "Telnyx",
  twilio: "Twilio",
  vobiz: "Vobiz",
  vonage: "Vonage",
};

export function telephonyProviderName(provider: string | undefined): string {
  return (provider && PROVIDER_DISPLAY_NAMES[provider]) || provider || "";
}

/** Provider display name. Brand names have no dictionary keys and pass
 * through unchanged; the key exists so a future non-brand name can map. */
export function telephonyDisplayName(
  t: TFunction,
  provider: string,
  backendName: string,
): string {
  return (
    serverText(t, `telephony.providers.${provider}.displayName`, backendName) ??
    backendName
  );
}

/** Field label/description: provider-specific key wins, then the key shared
 * by providers that use identical text for the same field name. */
export function telephonyFieldText(
  t: TFunction,
  provider: string,
  fieldName: string,
  kind: "label" | "description",
  backendText: string | null | undefined,
): string | undefined {
  if (backendText == null || backendText === "") return backendText ?? undefined;
  return (
    lookup(t, `telephony.providers.${provider}.field.${fieldName}.${kind}`) ??
    lookup(t, `telephony.fields.${fieldName}.${kind}`) ??
    backendText
  );
}

/** Section heading grouping a provider's fields (e.g. ARI's "External PBX"). */
export function telephonySectionText(
  t: TFunction,
  provider: string,
  section: string,
): string {
  return (
    lookup(t, `telephony.providers.${provider}.sections.${section}`) ?? section
  );
}

/** Select-option label (e.g. "VICIdial"). Brand names pass through. */
export function telephonyOptionText(
  t: TFunction,
  provider: string,
  fieldName: string,
  value: string,
  label: string,
): string {
  return (
    lookup(
      t,
      `telephony.providers.${provider}.field.${fieldName}.options.${value}`,
    ) ?? label
  );
}

export interface ChecklistStepLike {
  key: string;
  title: string;
  description: string;
}

// Variant candidate keys for steps whose backend text differs by
// configuration shape under the same step key. Ordered most-specific first.
const STEP_VARIANT_KEYS: Record<
  string,
  Partial<Record<"title" | "description", string[]>>
> = {
  caller_id: {
    description: ["telephony.checklist.caller_id.cloudonix.description"],
  },
  sip_domain: {
    title: [
      "telephony.checklist.sip_domain.managed.title",
      "telephony.checklist.sip_domain.self_serve.title",
    ],
    description: [
      "telephony.checklist.sip_domain.managed.description",
      "telephony.checklist.sip_domain.self_serve.description",
    ],
  },
  outbound_trunk: {
    description: [
      "telephony.checklist.outbound_trunk.managed.description",
      "telephony.checklist.outbound_trunk.self_serve.description",
    ],
  },
};

/** Setup-checklist step title/description, keyed by the step's stable `key`. */
export function checklistStepText(
  t: TFunction,
  step: ChecklistStepLike,
  kind: "title" | "description",
  provider?: string,
): string {
  const backendText = step[kind];
  const params = { name: telephonyProviderName(provider) };
  for (const key of STEP_VARIANT_KEYS[step.key]?.[kind] ?? []) {
    const matched = matchSource(t, key, backendText, params);
    if (matched !== undefined) return matched;
  }
  return (
    matchSource(
      t,
      `telephony.checklist.${step.key}.${kind}`,
      backendText,
      params,
    ) ?? backendText
  );
}

// Descriptions of every step that can block outbound (blocks_outbound=true),
// i.e. the possible values of `outbound_blocked_reason`. The backend reports
// the reason as a bare string (the first blocking step's description), so it
// can only be mapped by matching the English source. Ordered most-specific
// first; the shared caller-ID description interpolates the provider name.
const BLOCKED_REASON_KEYS = [
  "telephony.checklist.sip_domain.managed.description",
  "telephony.checklist.sip_domain.self_serve.description",
  "telephony.checklist.outbound_trunk.managed.description",
  "telephony.checklist.caller_id.cloudonix.description",
  "telephony.checklist.caller_id.description",
];

/** `outbound_blocked_reason` from a configuration or list item. */
export function telephonyBlockedReason(
  t: TFunction,
  reason: string | null | undefined,
  provider?: string,
): string | null | undefined {
  if (!reason) return reason;
  const params = { name: telephonyProviderName(provider) };
  for (const key of BLOCKED_REASON_KEYS) {
    const matched = matchSource(t, key, reason, params);
    if (matched !== undefined) return matched;
  }
  return reason;
}
