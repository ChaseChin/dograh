"use client";

import { ExternalLink } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";

import { LanguageSection } from "@/components/LanguageSection";
import { MCPSection } from "@/components/MCPSection";
import { OrganizationPreferencesSection } from "@/components/OrganizationPreferencesSection";
import { TelemetrySection } from "@/components/TelemetrySection";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SettingsPage() {
  const { t } = useTranslation();

  return (
    <div className="flex justify-center py-12 px-4">
      <div className="w-full max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
          <p className="text-muted-foreground">{t("settings.subtitle")}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("settings.language.title")}</CardTitle>
            <CardDescription>
              {t("settings.language.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LanguageSection />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("settings.preferences.title")}</CardTitle>
            <CardDescription>
              {t("settings.preferences.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OrganizationPreferencesSection />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("settings.mcp.title")}</CardTitle>
            <CardDescription>
              <Trans
                i18nKey="settings.mcp.description"
                components={[
                  <a
                    key="mcp-docs"
                    href="https://docs.dograh.com/integrations/mcp"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 underline"
                  />,
                ]}
              />{" "}
              <ExternalLink className="inline h-3 w-3" />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MCPSection />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("settings.telemetry.title")}</CardTitle>
            <CardDescription>
              <Trans
                i18nKey="settings.telemetry.description"
                components={[
                  <a
                    key="tracing-docs"
                    href="https://docs.dograh.com/configurations/tracing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 underline"
                  />,
                ]}
              />{" "}
              <ExternalLink className="inline h-3 w-3" />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TelemetrySection />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
