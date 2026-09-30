"use client";

import { useI18n } from "@/lib/i18n/locale-context";

export default function LocaleSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className="inline-flex items-center" htmlFor="locale-switcher">
      <span className="sr-only">{t("locale.label")}</span>
      <select
        aria-label={t("locale.label")}
        className="h-9 rounded-md border border-input bg-background px-2 text-xs font-semibold text-foreground shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
        id="locale-switcher"
        onChange={(event) => setLocale(event.target.value as "en" | "bn")}
        value={locale}
      >
        <option value="en">{t("locale.english")}</option>
        <option value="bn">{t("locale.bangla")}</option>
      </select>
    </label>
  );
}
