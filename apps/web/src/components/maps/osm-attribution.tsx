"use client";

import { useI18n } from "@/lib/i18n/locale-context";

export default function OsmAttribution() {
  const { t } = useI18n();

  return (
    <p className="pointer-events-none absolute bottom-2 right-2 z-20 rounded bg-white/90 px-2 py-1 text-[10px] leading-none text-slate-700 shadow-sm">
      {t("map.attribution")}
    </p>
  );
}
