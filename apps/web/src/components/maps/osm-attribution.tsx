"use client";

import { useI18n } from "@/lib/i18n/locale-context";

export default function OsmAttribution() {
  const { t } = useI18n();

  // Sits above Leaflet's panes (z-index 400) so the credit is never hidden.
  return (
    <p className="pointer-events-none absolute bottom-2.5 right-2.5 z-[900] rounded-full bg-card/90 px-2.5 py-1 text-[0.625rem] leading-none text-foreground/65 shadow-card ring-1 ring-border/70 backdrop-blur">
      {t("map.attribution")}
    </p>
  );
}
