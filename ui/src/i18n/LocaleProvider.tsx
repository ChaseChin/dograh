"use client";

import { createContext, type ReactNode,useCallback, useContext, useMemo, useState } from "react";
import { I18nextProvider } from "react-i18next";

import { setDateLocale } from "./dateLocale";
import i18n, { type Locale,LOCALE_STORAGE_KEY } from "./index";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "zh",
  setLocale: () => {},
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  // i18n.language is already correct: the instance was synchronously
  // initialized from window.__LOCALE__ (set by the inline pre-hydration
  // script) — so the first client render matches the stored preference.
  const [locale, setLocaleState] = useState<Locale>(() =>
    i18n.language === "en" ? "en" : "zh",
  );

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    // changeLanguage re-renders every useTranslation consumer in place.
    void i18n.changeLanguage(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // private mode etc. — locale just won't persist
    }
    document.documentElement.lang = next === "en" ? "en" : "zh-CN";
    setDateLocale(next);
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return (
    <LocaleContext.Provider value={value}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
