"use client";

import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Locale } from "@/i18n";
import { useLocale } from "@/i18n/LocaleProvider";

// Options render autonyms ("中文" / "English") in BOTH locales — a user stuck
// in a language they can't read can still find their own. These two strings
// are intentionally not translated.
const LOCALE_OPTIONS: Array<{ value: Locale; autonym: string }> = [
  { value: "zh", autonym: "中文" },
  { value: "en", autonym: "English" },
];

export function LanguageSection() {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();

  const handleChange = (value: string) => {
    if (value !== "zh" && value !== "en") return;
    setLocale(value);
    // t() is called AFTER setLocale queued the language change; fire the toast
    // in a microtask so it renders in the NEW language.
    queueMicrotask(() => toast.success(t("settings.language.updated")));
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="ui-language">{t("settings.language.label")}</Label>
      <Select value={locale} onValueChange={handleChange}>
        <SelectTrigger id="ui-language" className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LOCALE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.autonym}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
