import i18n from "@/i18n";
import { getIntlTag } from "@/i18n/dateLocale";

// English display names for language codes (Deepgram + Sarvam). Kept as the
// ultimate fallback when Intl.DisplayNames cannot resolve a code; UI code
// should prefer getLanguageDisplayName / getLanguageDisplayNames below, which
// localize via Intl.DisplayNames using the active locale.
export const LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
    "multi": "Multilingual (Auto-detect)",
    // Arabic
    "ar": "Arabic",
    "ar-AE": "Arabic (UAE)",
    "ar-SA": "Arabic (Saudi Arabia)",
    "ar-QA": "Arabic (Qatar)",
    "ar-KW": "Arabic (Kuwait)",
    "ar-SY": "Arabic (Syria)",
    "ar-LB": "Arabic (Lebanon)",
    "ar-PS": "Arabic (Palestine)",
    "ar-JO": "Arabic (Jordan)",
    "ar-EG": "Arabic (Egypt)",
    "ar-SD": "Arabic (Sudan)",
    "ar-TD": "Arabic (Chad)",
    "ar-MA": "Arabic (Morocco)",
    "ar-DZ": "Arabic (Algeria)",
    "ar-TN": "Arabic (Tunisia)",
    "ar-IQ": "Arabic (Iraq)",
    "ar-IR": "Arabic (Iran)",
    // Other languages
    "be": "Belarusian",
    "bn": "Bengali",
    "bs": "Bosnian",
    "bg": "Bulgarian",
    "ca": "Catalan",
    "cs": "Czech",
    "da": "Danish",
    "da-DK": "Danish (Denmark)",
    "de": "German",
    "de-CH": "German (Switzerland)",
    "el": "Greek",
    "en": "English",
    "en-US": "English (US)",
    "en-AU": "English (Australia)",
    "en-GB": "English (UK)",
    "en-IN": "English (India)",
    "en-NZ": "English (New Zealand)",
    "es": "Spanish",
    "es-419": "Spanish (Latin America)",
    "et": "Estonian",
    "fa": "Persian",
    "fi": "Finnish",
    "fr": "French",
    "fr-CA": "French (Canada)",
    "he": "Hebrew",
    "hi": "Hindi",
    "hr": "Croatian",
    "hu": "Hungarian",
    "id": "Indonesian",
    "it": "Italian",
    "ja": "Japanese",
    "kn": "Kannada",
    "ko": "Korean",
    "ko-KR": "Korean (South Korea)",
    "lt": "Lithuanian",
    "lv": "Latvian",
    "mk": "Macedonian",
    "mr": "Marathi",
    "ms": "Malay",
    "nl": "Dutch",
    "nl-BE": "Flemish",
    "no": "Norwegian",
    "pl": "Polish",
    "pt": "Portuguese",
    "pt-BR": "Portuguese (Brazil)",
    "pt-PT": "Portuguese (Portugal)",
    "ro": "Romanian",
    "ru": "Russian",
    "sk": "Slovak",
    "sl": "Slovenian",
    "sr": "Serbian",
    "sv": "Swedish",
    "sv-SE": "Swedish (Sweden)",
    "ta": "Tamil",
    "te": "Telugu",
    "th": "Thai",
    "tl": "Tagalog",
    "tr": "Turkish",
    "uk": "Ukrainian",
    "ur": "Urdu",
    "vi": "Vietnamese",
    "zh-CN": "Chinese (Simplified)",
    "zh-TW": "Chinese (Traditional)",
    // Sarvam Indian languages
    "unknown": "Auto-detect",
    "bn-IN": "Bengali",
    "gu-IN": "Gujarati",
    "hi-IN": "Hindi",
    "kn-IN": "Kannada",
    "ml-IN": "Malayalam",
    "mr-IN": "Marathi",
    "od-IN": "Odia",
    "pa-IN": "Punjabi",
    "ta-IN": "Tamil",
    "te-IN": "Telugu",
    "as-IN": "Assamese",
    "ur-IN": "Urdu",
    "ne-IN": "Nepali",
    "kok-IN": "Konkani",
    "ks-IN": "Kashmiri",
    "sd-IN": "Sindhi",
    "sa-IN": "Sanskrit",
    "sat-IN": "Santali",
    "mni-IN": "Manipuri",
    "brx-IN": "Bodo",
    "mai-IN": "Maithili",
    "doi-IN": "Dogri",
};

const displayNamesCache: Partial<Record<string, Intl.DisplayNames | null>> = {};

function getIntlDisplayNames(): Intl.DisplayNames | null {
    const tag = getIntlTag();
    if (!(tag in displayNamesCache)) {
        try {
            displayNamesCache[tag] = new Intl.DisplayNames([tag], { type: "language" });
        } catch {
            displayNamesCache[tag] = null;
        }
    }
    return displayNamesCache[tag] ?? null;
}

/**
 * Localized display name for a language code. The pseudo-codes `multi` and
 * `unknown` come from the i18n dictionary; everything else goes through
 * Intl.DisplayNames in the active locale, falling back to the English map
 * and finally the uppercased code.
 */
export function getLanguageDisplayName(code: string): string {
    if (code === "multi") return i18n.t("common.languages.multi");
    if (code === "unknown") return i18n.t("common.languages.autoDetect");

    const displayNames = getIntlDisplayNames();
    if (displayNames) {
        try {
            const name = displayNames.of(code);
            // Intl.DisplayNames echoes the code back when it can't resolve it.
            if (name && name !== code) return name;
        } catch {
            // fall through to the static map
        }
    }
    return LANGUAGE_DISPLAY_NAMES[code] ?? code.toUpperCase();
}

/** Localized { code: displayName } map for all supported language codes. */
export function getLanguageDisplayNames(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const code of Object.keys(LANGUAGE_DISPLAY_NAMES)) {
        result[code] = getLanguageDisplayName(code);
    }
    return result;
}
