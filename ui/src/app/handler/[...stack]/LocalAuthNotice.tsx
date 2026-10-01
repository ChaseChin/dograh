"use client";

import { useTranslation } from "react-i18next";

export function LocalAuthNotice() {
  const { t } = useTranslation();

  return (
    <div className="space-y-2 text-center text-zinc-200">
      <h1 className="text-xl font-semibold">{t("auth.localAuthTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("auth.localAuthBody")}</p>
    </div>
  );
}
