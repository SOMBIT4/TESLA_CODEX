"use client";

import DhakaRouteMap from "@/components/brand/dhaka-route-map";
import { ZONE_COLORS } from "@/lib/constants/zone-colors";
import { useI18n } from "@/lib/i18n/locale-context";

export default function AuthIllustration() {
  const { t } = useI18n();

  return (
    <div className="grid-texture sticky top-3 flex h-[calc(100vh-1.5rem)] min-h-[36rem] flex-col justify-between overflow-hidden rounded-[2rem] bg-ink p-8 text-paper xl:p-12">
      <div className="animate-fade">
        <p className="text-[0.8125rem] font-medium text-paper/55">
          {t("auth.routePreview")}
        </p>
        <p className="mt-2 max-w-sm text-[1.75rem] font-extrabold leading-tight tracking-[-0.03em]">
          {t("auth.illustrationTitle")}
        </p>
      </div>

      <DhakaRouteMap
        ariaLabel={t("auth.routeAria")}
        className="mx-auto max-h-[58vh] max-w-xl"
      />

      <div className="flex items-center gap-3 border-t border-white/10 pt-5 text-sm text-paper/70">
        <span aria-hidden="true" className="flex -space-x-1">
          {[
            ZONE_COLORS.Banani,
            ZONE_COLORS["Gulshan 1"],
            ZONE_COLORS.Mohakhali,
          ].map((color) => (
            <span
              className="size-3 rounded-full ring-2 ring-ink"
              key={color}
              style={{ backgroundColor: color }}
            />
          ))}
        </span>
        <span>{t("auth.illustrationHint")}</span>
      </div>
    </div>
  );
}
