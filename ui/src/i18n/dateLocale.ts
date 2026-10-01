import { enUS, zhCN } from "date-fns/locale";

import { DEFAULT_LOCALE, type Locale } from "./index";

const INTL_TAGS: Record<Locale, string> = {
  zh: "zh-CN",
  en: "en-US",
};

const DATE_FNS_LOCALES = {
  zh: zhCN,
  en: enUS,
} as const;

// Module-level current locale for non-React utilities (dateTime.ts etc.).
// LocaleProvider keeps this in sync on init and on every language switch.
let currentLocale: Locale = DEFAULT_LOCALE;

export function setDateLocale(locale: Locale) {
  currentLocale = locale;
}

/** BCP-47 tag for Intl/toLocaleString calls, e.g. 'zh-CN' | 'en-US'. */
export function getIntlTag(): string {
  return INTL_TAGS[currentLocale];
}

/** date-fns Locale object for formatDistanceToNow / react-day-picker. */
export function getDateFnsLocale() {
  return DATE_FNS_LOCALES[currentLocale];
}
