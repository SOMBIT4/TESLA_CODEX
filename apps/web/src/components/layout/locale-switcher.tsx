"use client";

import { Languages } from "lucide-react";
import { useI18n } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";

interface LocaleSwitcherProps {
  tone?: "light" | "dark";
}

export default function LocaleSwitcher({
  tone = "light",
}: LocaleSwitcherProps) {
  const { locale, setLocale, t } = useI18n();

  return (
    <label
      className={cn(
        "relative inline-flex h-9 items-center rounded-full border transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        tone === "dark"
          ? "border-white/15 bg-white/5 text-paper hover:bg-white/10"
          : "border-border bg-card text-foreground hover:border-foreground/30",
      )}
      htmlFor="locale-switcher"
    >
      <span className="sr-only">{t("locale.label")}</span>
      <Languages
        aria-hidden="true"
        className="pointer-events-none absolute left-3 size-3.5 opacity-70"
      />
      <select
        aria-label={t("locale.label")}
        className="h-full cursor-pointer appearance-none rounded-full bg-transparent pl-8 pr-3 text-xs font-semibold outline-none [&>option]:text-foreground"
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
