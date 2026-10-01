import "react-i18next";

import type zh from "./locales/zh.json";

// Type-safe keys: t('nav.overview') autocompletes, t('nav.bogus') is a
// compile error. zh.json is the source of truth; en.json is guarded by the
// key-parity test (locales/parity.test.ts) since TS only validates against zh.
declare module "react-i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: typeof zh };
  }
}
