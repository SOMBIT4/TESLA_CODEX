"use client";

import dynamic from "next/dynamic";
import MapErrorBoundary from "@/components/maps/map-error-boundary";
import OsmAttribution from "@/components/maps/osm-attribution";
import { useI18n } from "@/lib/i18n/locale-context";
import type { DhakaArea } from "@/lib/api/types";

export type ZoneMapMode = "selectable" | "pool" | "decorative";
export type ZoneMapMarkerRole = "zone" | "pickup" | "destination";

export interface ZoneMapMarker {
  id: string;
  zone: DhakaArea;
  role: ZoneMapMarkerRole;
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
      className="absolute inset-0 z-10 grid place-items-center bg-muted/90 p-5 text-center text-sm text-muted-foreground"
      role="status"
    >
      {t("map.unavailable")}
    </div>
  );
}

function MapLoading() {
  const { t } = useI18n();

  return (
    <div className="absolute inset-0 grid place-items-center bg-muted text-sm text-muted-foreground">
      {t("map.loading")}
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
  className = "",
}: ZoneMapProps) {
  const { t } = useI18n();
  const decorative = mode === "decorative";

  return (
    <section
      className={`relative isolate min-h-[18rem] w-full overflow-hidden rounded-2xl bg-muted ${className}`}
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
      {decorative && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-background/35 via-background/55 to-background/85"
          data-map-readability-overlay
        />
      )}
      <OsmAttribution />
    </section>
  );
}
