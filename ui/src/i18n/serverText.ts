import type { TFunction } from "i18next";

// Backend-delivered English text is localized UI-side via dictionary maps keyed
// by stable identifiers (provider id, field name). Unknown keys fall back to the
// backend text so providers without a mapping still render (in English).
//
// Note: this project's i18n init sets `returnEmptyString: false`, so an empty
// `defaultValue` would resolve to the raw key instead of "". Passing the
// backend text as `defaultValue` gives the intended fallback behavior.
export function serverText(
  t: TFunction,
  key: string,
  fallback: string | undefined | null,
  params?: Record<string, unknown>,
): string | undefined {
  if (fallback == null || fallback === "") return fallback ?? undefined;
  return (t as (k: string, o?: Record<string, unknown>) => string)(key, {
    ...params,
    defaultValue: fallback,
  });
}
