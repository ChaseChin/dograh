// Display names for accent codes returned by the voice catalog.
//
// The catalog derives accent from a voice's locale country (e.g. "en-US" -> "us"),
// so the stored/filter value is an ISO 3166-1 alpha-2 country code. These are the
// human-readable accent labels shown in the UI; the underlying code stays the
// filter value. Unknown codes fall back to a capitalized form at the call site.

import { getIntlTag } from "@/i18n/dateLocale";

export const ACCENT_DISPLAY_NAMES: Record<string, string> = {
    us: "American",
    gb: "British",
    au: "Australian",
    ca: "Canadian",
    ie: "Irish",
    nz: "New Zealand",
    za: "South African",
    in: "Indian",
    bd: "Bangladeshi",
    sg: "Singaporean",
    my: "Malaysian",
    ph: "Filipino",
    id: "Indonesian",
    vn: "Vietnamese",
    th: "Thai",
    cn: "Chinese",
    jp: "Japanese",
    kr: "Korean",
    fr: "French",
    de: "German",
    ch: "Swiss",
    nl: "Dutch",
    it: "Italian",
    es: "Spanish",
    mx: "Mexican",
    co: "Colombian",
    bo: "Bolivian",
    br: "Brazilian",
    pt: "Portuguese",
    ru: "Russian",
    ua: "Ukrainian",
    pl: "Polish",
    cz: "Czech",
    sk: "Slovak",
    hu: "Hungarian",
    ro: "Romanian",
    bg: "Bulgarian",
    hr: "Croatian",
    gr: "Greek",
    ge: "Georgian",
    md: "Moldovan",
    se: "Swedish",
    no: "Norwegian",
    dk: "Danish",
    fi: "Finnish",
    tr: "Turkish",
    il: "Israeli",
    sa: "Saudi",
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

let cachedRegionNames: Intl.DisplayNames | null = null;
let cachedRegionTag: string | null = null;

const getRegionDisplayNames = (): Intl.DisplayNames | null => {
    if (typeof Intl === "undefined" || typeof Intl.DisplayNames === "undefined") return null;
    const tag = getIntlTag();
    if (!cachedRegionNames || cachedRegionTag !== tag) {
        try {
            cachedRegionNames = new Intl.DisplayNames([tag], { type: "region" });
            cachedRegionTag = tag;
        } catch {
            return null;
        }
    }
    return cachedRegionNames;
};

/**
 * Localized accent label for a catalog accent code (ISO 3166-1 alpha-2).
 *
 * English keeps the curated demonyms above ("American"); other locales get the
 * region's display name via Intl.DisplayNames. Unknown codes fall back to the
 * curated map, then to a capitalized form of the code itself.
 */
export function getAccentDisplayName(code: string): string {
    const normalized = code.toLowerCase();
    if (getIntlTag() === "en-US") {
        return ACCENT_DISPLAY_NAMES[normalized] || capitalize(code);
    }
    const displayNames = getRegionDisplayNames();
    try {
        const name = displayNames?.of(normalized.toUpperCase());
        if (name && name.toLowerCase() !== normalized) return name;
    } catch {
        // Fall through to the curated map / capitalized code.
    }
    return ACCENT_DISPLAY_NAMES[normalized] || capitalize(code);
}
