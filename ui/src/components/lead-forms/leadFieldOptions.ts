// Shared dropdown options + lead source/kind types for the lead-gen forms.
// Options carry i18n `labelKey`s (leadForms.options.*) — render with t(o.labelKey).

export type LeadSource =
  | "sidebar"
  | "billing_card"
  | "billing_custom_pricing"
  | "builder_nudge"
  | "hire_expert"
  | "onboarding"
  | "pricing_custom_volume"
  | "landing_contact"
  | "auth_page";

export type LeadKind = "hire_expert" | "enterprise";

// Provenance stamped by the in-app forms (analytics only; the marketing site and
// server use "website"). Derived from AppConfig deploymentMode: cloud → "cloud_app",
// otherwise "oss_app". OSS submits via the public no-token endpoints.
export type LeadOrigin = "cloud_app" | "oss_app";

// Monthly call-volume buckets. Values MUST match the backend qualifier enum
// (user_onboarding flows): "0-5k" | "5k-100k" | "100k+" | "not-sure".
export const VOLUME_OPTIONS = [
  { value: "0-5k", labelKey: "leadForms.options.volume.0-5k" },
  { value: "5k-100k", labelKey: "leadForms.options.volume.5k-100k" },
  { value: "100k+", labelKey: "leadForms.options.volume.100k+" },
  { value: "not-sure", labelKey: "leadForms.options.volume.not-sure" },
] as const;

// Hire-an-Expert expected monthly call volume (shared bucket set).
export const HIRE_VOLUME_OPTIONS = VOLUME_OPTIONS;

// Enterprise monthly call volume (shared bucket set).
export const ENTERPRISE_VOLUME_OPTIONS = VOLUME_OPTIONS;

// Lead sources for which the Enterprise modal surfaces the conditional
// "Need enterprise deployment (SSO, on-prem, data residency)?" question.
// Other entry points hide it and default the payload to "yes".
export const ENTERPRISE_DEPLOYMENT_SOURCES: readonly LeadSource[] = [
  "billing_custom_pricing",
  "pricing_custom_volume",
  "landing_contact",
  "auth_page",
];

// Enterprise deployment need (conditional — see ENTERPRISE_DEPLOYMENT_SOURCES).
export const ENTERPRISE_DEPLOYMENT_OPTIONS = [
  { value: "yes", labelKey: "leadForms.options.deployment.yes" },
  { value: "no", labelKey: "leadForms.options.deployment.no" },
  { value: "maybe", labelKey: "leadForms.options.deployment.maybe" },
] as const;

// ---------------------------------------------------------------------------
// Post-signup onboarding form options
// ---------------------------------------------------------------------------

// Onboarding: are you migrating from another provider? (a trimmed competitor list).
// "no" → not migrating; "other" → reveals a free-text provider field.
export const ONBOARDING_MIGRATION_OPTIONS = [
  { value: "no", labelKey: "leadForms.options.migration.no" },
  { value: "vapi", labelKey: "leadForms.options.migration.vapi" },
  { value: "retell", labelKey: "leadForms.options.migration.retell" },
  { value: "bland", labelKey: "leadForms.options.migration.bland" },
  { value: "elevenlabs", labelKey: "leadForms.options.migration.elevenlabs" },
  { value: "synthflow", labelKey: "leadForms.options.migration.synthflow" },
  { value: "other", labelKey: "leadForms.options.migration.other" },
] as const;

// Onboarding: how did you hear about us? (trimmed).
export const ONBOARDING_HEARD_OPTIONS = [
  { value: "github", labelKey: "leadForms.options.heard.github" },
  { value: "search_engine", labelKey: "leadForms.options.heard.search_engine" },
  { value: "social_media", labelKey: "leadForms.options.heard.social_media" },
  { value: "youtube", labelKey: "leadForms.options.heard.youtube" },
  { value: "ai_tool", labelKey: "leadForms.options.heard.ai_tool" },
  { value: "referral", labelKey: "leadForms.options.heard.referral" },
  { value: "other", labelKey: "leadForms.options.heard.other" },
] as const;

// Onboarding: expected monthly call volume. Its own set — value "exploring" is NOT
// the qualifier's "not-sure"; onboarding has no flow, so this is analytics-only.
export const ONBOARDING_VOLUME_OPTIONS = [
  { value: "0-5k", labelKey: "leadForms.options.onboardingVolume.0-5k" },
  { value: "5k-100k", labelKey: "leadForms.options.onboardingVolume.5k-100k" },
  { value: "100k+", labelKey: "leadForms.options.onboardingVolume.100k+" },
  { value: "exploring", labelKey: "leadForms.options.onboardingVolume.exploring" },
] as const;

// Onboarding: what best describes you.
export const ONBOARDING_PERSONA_OPTIONS = [
  { value: "enterprise_midmarket", labelKey: "leadForms.options.persona.enterprise_midmarket" },
  { value: "agency", labelKey: "leadForms.options.persona.agency" },
  { value: "local_business", labelKey: "leadForms.options.persona.local_business" },
  { value: "startup", labelKey: "leadForms.options.persona.startup" },
  { value: "solo", labelKey: "leadForms.options.persona.solo" },
] as const;

// Persona values that unlock the on-prem conditional question.
export const ONBOARDING_ONPREM_PERSONAS: readonly string[] = ["enterprise_midmarket"];

// Onboarding: on-prem deployment need (conditional on Enterprise/Mid-Market).
export const ONBOARDING_ONPREM_OPTIONS = [
  { value: "yes", labelKey: "leadForms.options.onprem.yes" },
  { value: "no", labelKey: "leadForms.options.onprem.no" },
  { value: "not_sure", labelKey: "leadForms.options.onprem.not_sure" },
] as const;
