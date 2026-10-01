"use client";

import type { TFunction } from "i18next";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";

import type { TelephonyConfigurationDetail } from "@/client/types.gen";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Per-provider pieces of the trunk editor.
 *
 * A trunk itself is provider-agnostic — a name, an on/off switch and the
 * numbers pinned to it — so `TrunkCard` renders all of that generically. What
 * differs is `settings`, which the backend validates against that provider's
 * `ProviderSpec.trunk_settings_cls`. A provider with no entry here still gets
 * a working card with name and enabled; add an entry only when its trunks
 * carry settings the customer has to fill in.
 */

export interface TrunkSettings {
  [key: string]: unknown;
}

export interface TrunkSettingsFieldsProps {
  configuration: TelephonyConfigurationDetail;
  settings: TrunkSettings;
  onChange: (patch: TrunkSettings) => void;
  disabled?: boolean;
}

export interface TrunkProviderUi {
  /** Settings a brand-new trunk starts with. */
  initialSettings: (configuration: TelephonyConfigurationDetail) => TrunkSettings;
  /** Extra form fields, rendered under the name and enabled controls. */
  Fields?: ComponentType<TrunkSettingsFieldsProps>;
  /** Mirrors the provider's server-side trunk schema; message or null. */
  validate?: (t: TFunction, name: string, settings: TrunkSettings) => string | null;
  /** One line under the trunk name in the list. */
  summarize?: (settings: TrunkSettings) => string;
}

// Mirrors the trunk-name rule the Cloudonix config schema enforces server-side.
const CLOUDONIX_TRUNK_NAME_PATTERN = /^[A-Za-z0-9-]+$/;

function regionsOf(configuration: TelephonyConfigurationDetail) {
  return configuration.sip_connectivity?.regions ?? [];
}

function CloudonixTrunkFields({
  configuration,
  settings,
  onChange,
  disabled,
}: TrunkSettingsFieldsProps) {
  const { t } = useTranslation();
  const regions = regionsOf(configuration);
  const region = typeof settings.region === "string" ? settings.region : "";
  const sipDomain = typeof settings.sip_domain === "string" ? settings.sip_domain : "";
  const originIp = regions.find((candidate) => candidate.region === region)
    ?.outbound_origin_ip;

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="trunk-sip-domain">{t("telephony.trunks.sipDomain")}</Label>
        <Input
          id="trunk-sip-domain"
          value={sipDomain}
          onChange={(event) => onChange({ sip_domain: event.target.value })}
          placeholder="sip.example.com"
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">
          {t("telephony.trunks.sipDomainHelp")}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="trunk-region">{t("telephony.trunks.region")}</Label>
        <Select
          value={region}
          onValueChange={(next) => onChange({ region: next })}
          disabled={disabled}
        >
          <SelectTrigger id="trunk-region" aria-label={t("telephony.trunks.regionAria")}>
            <SelectValue placeholder={t("telephony.trunks.regionPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {regions.map((candidate) => (
              <SelectItem key={candidate.region} value={candidate.region}>
                {candidate.region}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {originIp
            ? t("telephony.trunks.regionHelpWithIp", { ip: originIp })
            : t("telephony.trunks.regionHelp")}
        </p>
      </div>
    </>
  );
}

const CLOUDONIX: TrunkProviderUi = {
  initialSettings: (configuration) => {
    const regions = regionsOf(configuration);
    const preferred =
      regions.find((candidate) => candidate.region.toLowerCase() === "global") ??
      regions[0];
    return { region: preferred?.region ?? "", sip_domain: "" };
  },
  Fields: CloudonixTrunkFields,
  validate: (t, name, settings) => {
    if (!CLOUDONIX_TRUNK_NAME_PATTERN.test(name)) {
      return t("telephony.trunks.namePattern");
    }
    if (!settings.sip_domain) return t("telephony.trunks.sipDomainRequired");
    if (!settings.region) return t("telephony.trunks.regionRequired");
    return null;
  },
  summarize: (settings) =>
    [settings.sip_domain, settings.region].filter(Boolean).join(" · "),
};

const FALLBACK: TrunkProviderUi = {
  initialSettings: () => ({}),
};

const TRUNK_PROVIDER_UI: Record<string, TrunkProviderUi> = {
  cloudonix: CLOUDONIX,
};

export function trunkProviderUi(provider: string): TrunkProviderUi {
  return TRUNK_PROVIDER_UI[provider] ?? FALLBACK;
}
