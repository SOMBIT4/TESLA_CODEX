"use client";

import dynamic from "next/dynamic";
import { MapPinOff } from "lucide-react";
import MapErrorBoundary from "@/components/maps/map-error-boundary";
import OsmAttribution from "@/components/maps/osm-attribution";
import { useI18n } from "@/lib/i18n/locale-context";
import type { DhakaArea } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export type ZoneMapMode = "selectable" | "pool" | "decorative";
export type ZoneMapMarkerRole = "zone" | "pickup" | "destination";

export interface ZoneMapMarker {
  id: string;
  zone: DhakaArea;
  role: ZoneMapMarkerRole;
  done?: boolean;
  members?: readonly { passengerName: string; seats: number }[];
}

export interface ZoneMapProps {
  mode: ZoneMapMode;
  markers: readonly ZoneMapMarker[];
  disabled?: boolean;
  onZoneSelect?: (zone: DhakaArea) => void;
  className?: string;
}

function MapUnavailable() {
  const { t } = useI18n();

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-muted/95 p-6 text-center"
      role="status"
    >
      <span className="flex size-11 items-center justify-center rounded-2xl bg-card text-muted-foreground shadow-card">
        <MapPinOff aria-hidden="true" className="size-5" />
      </span>
      <p className="max-w-[16rem] text-sm text-muted-foreground">
        {t("map.unavailable")}
      </p>
    </div>
  );
}

function MapLoading() {
  const { t } = useI18n();

  return (
    <div className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,hsl(var(--muted))_0%,hsl(var(--accent))_50%,hsl(var(--muted))_100%)] bg-[length:200%_100%]">
      <p className="absolute bottom-3 left-3 rounded-full bg-card/90 px-3 py-1 text-xs font-medium text-muted-foreground shadow-card">
        {t("map.loading")}
      </p>
    </div>
  );
}

const LeafletZoneMap = dynamic<ZoneMapProps>(
  () => import("@/components/maps/leaflet-zone-map"),
  { ssr: false, loading: MapLoading },
);

export default function ZoneMap({
  mode,
  markers,
  disabled = false,
  onZoneSelect,
  className,
}: ZoneMapProps) {
  const { t } = useI18n();
  const decorative = mode === "decorative";

  return (
    <section
      className={cn(
        "zone-map relative isolate min-h-[20rem] w-full overflow-hidden rounded-2xl border border-border/80 bg-muted shadow-[inset_0_1px_3px_hsl(var(--ink)/0.08)]",
        disabled && "zone-map--disabled",
        className,
      )}
      data-map-mode={mode}
    >
      <div
        aria-hidden={decorative ? true : undefined}
        aria-label={decorative ? undefined : t("map.accessibleName")}
        className={
          decorative
            ? "pointer-events-none absolute inset-0"
            : "absolute inset-0"
        }
        data-map-canvas
        role={decorative ? undefined : "region"}
      >
        <MapErrorBoundary fallback={<MapUnavailable />}>
          <LeafletZoneMap
            mode={mode}
            markers={markers}
            disabled={disabled}
            onZoneSelect={onZoneSelect}
          />
        </MapErrorBoundary>
      </div>
      {decorative ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-background/35 via-background/55 to-background/85"
          data-map-readability-overlay
        />
      ) : null}
      <OsmAttribution />
    </section>
  );
}
