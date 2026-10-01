// Shared reassurance line shown beneath every lead-form submit. A small,
// consistent trust signal — keeps the promise identical across all forms.

"use client";

import { useTranslation } from "react-i18next";

export function FormTrustLine() {
  const { t } = useTranslation();
  return (
    <p className="text-center text-xs text-muted-foreground">
      {t("leadForms.trustLine")}
    </p>
  );
}
