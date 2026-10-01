import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import zh from "./locales/zh.json";

declare global {
  interface Window {
    __LOCALE__?: string;
  }
}

export type Locale = "zh" | "en";
export const LOCALES: Locale[] = ["zh", "en"];
export const DEFAULT_LOCALE: Locale = "zh";
export const LOCALE_STORAGE_KEY = "locale";

/**
 * Resolve the initial locale. The inline pre-hydration script in layout.tsx
 * has already read localStorage and stashed the result on window.__LOCALE__,
 * so the FIRST client render uses the stored preference — no mounted-guard,
 * no two-pass render. On the server (SSR pass) window is undefined and we
 * fall back to zh, matching the static <html lang="zh">.
 */
function resolveInitialLocale(): Locale {
  if (typeof window !== "undefined") {
    const stored = window.__LOCALE__;
    if (stored === "zh" || stored === "en") return stored;
  }
  return DEFAULT_LOCALE;
}

i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en },
  },
  lng: resolveInitialLocale(),
  fallbackLng: DEFAULT_LOCALE,
  interpolation: { escapeValue: false },
  returnEmptyString: false,
  react: { useSuspense: false },
  // Missing-key warnings in dev only (e.g. "i18next::translator: missingKey").
  debug: process.env.NODE_ENV === "development",
});

export default i18n;
