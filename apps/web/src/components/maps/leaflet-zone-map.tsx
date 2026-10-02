"use client";

import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DhakaArea } from "@/lib/api/types";
import { DHAKA_AREAS } from "@/lib/api/types";
import { DHAKA_QA_BOUNDS, ZONE_COORDINATES } from "@/lib/maps/zone-coordinates";
import { useI18n } from "@/lib/i18n/locale-context";
import type {
  ZoneMapMarker,
  ZoneMapMarkerRole,
  ZoneMapProps,
} from "@/components/maps/zone-map";
import type { MessageKey } from "@/lib/i18n/messages";

const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const ZONE_LABEL_KEYS: Readonly<Record<DhakaArea, MessageKey>> = {
  Banani: "map.zone.banani",
  "Gulshan 1": "map.zone.gulshan1",
  "Gulshan 2": "map.zone.gulshan2",
  Mohakhali: "map.zone.mohakhali",
  Dhanmondi: "map.zone.dhanmondi",
  Mirpur: "map.zone.mirpur",
  Uttara: "map.zone.uttara",
  Farmgate: "map.zone.farmgate",
  Bashundhara: "map.zone.bashundhara",
};

const ROLE_LABEL_KEYS: Readonly<Record<ZoneMapMarkerRole, MessageKey>> = {
  zone: "map.zone",
  pickup: "map.pickup",
  destination: "map.destination",
};

const zoneSetSignature = (markers: readonly ZoneMapMarker[]) =>
  [...new Set(markers.map(({ zone }) => zone))].sort().join("|");

function markerDataSignature(markers: readonly ZoneMapMarker[]) {
  return JSON.stringify(
    [...markers]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(({ id, zone, role, members }) => [
        id,
        zone,
        role,
        members?.map(({ passengerName, seats }) => [passengerName, seats]) ??
          [],
      ]),
  );
}

function markerTooltip(marker: ZoneMapMarker, t: (key: MessageKey) => string) {
  const content = document.createElement("div");
  content.className = "zone-map-tooltip-content";

  const heading = document.createElement("strong");
  heading.textContent = `${t(ZONE_LABEL_KEYS[marker.zone])} · ${t(ROLE_LABEL_KEYS[marker.role])}`;
  content.append(heading);

  for (const member of marker.members ?? []) {
    const seatLabel = member.seats === 1 ? t("common.seat") : t("common.seats");
    const line = document.createElement("span");
    line.textContent = `${member.passengerName} · ${member.seats} ${seatLabel}`;
    content.append(line);
  }

  return content;
}

function markerStyle(role: ZoneMapMarkerRole): L.PathOptions {
  const color =
    role === "pickup"
      ? "#168357"
      : role === "destination"
        ? "#d94b3d"
        : "#176b70";

  return {
    color: "#ffffff",
    fillColor: color,
    fillOpacity: 0.94,
    opacity: 1,
    weight: 3,
  };
}

export default function LeafletZoneMap({
  mode,
  markers,
  disabled = false,
  onZoneSelect,
}: ZoneMapProps) {
  const { locale, t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const circleMarkersRef = useRef(new Map<string, L.CircleMarker>());
  const markerHandlersRef = useRef(new Map<string, L.LeafletEventHandlerFn>());
  const currentPropsRef = useRef({ mode, markers, disabled, onZoneSelect });
  const lastFittedZoneSetRef = useRef<string | undefined>(undefined);
  const [unavailable, setUnavailable] = useState(false);

  currentPropsRef.current = { mode, markers, disabled, onZoneSelect };

  const dataSignature = useMemo(() => markerDataSignature(markers), [markers]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let map: L.Map | null = null;
    let tileLayer: L.TileLayer | null = null;
    let markerLayer: L.LayerGroup | null = null;
    const tileErrorHandler: L.LeafletEventHandlerFn = () => {
      setUnavailable(true);
    };
    const decorative = currentPropsRef.current.mode === "decorative";

    try {
      map = L.map(container, {
        attributionControl: false,
        boxZoom: !decorative,
        doubleClickZoom: !decorative,
        dragging: !decorative,
        keyboard: !decorative,
        scrollWheelZoom: !decorative,
        touchZoom: !decorative,
        zoomControl: !decorative,
      });

      markerLayer = L.layerGroup().addTo(map);
      tileLayer = L.tileLayer(
        process.env.NEXT_PUBLIC_MAP_TILE_URL || DEFAULT_TILE_URL,
        { attribution: "" },
      );
      tileLayer.on("tileerror", tileErrorHandler);
      tileLayer.addTo(map);

      const allZonePoints = DHAKA_AREAS.map((zone) => {
        const { latitude, longitude } = ZONE_COORDINATES[zone];
        return [latitude, longitude] as L.LatLngTuple;
      });
      const bounds = L.latLngBounds(allZonePoints);

      if (
        bounds.getSouth() < DHAKA_QA_BOUNDS.minLatitude ||
        bounds.getNorth() > DHAKA_QA_BOUNDS.maxLatitude ||
        bounds.getWest() < DHAKA_QA_BOUNDS.minLongitude ||
        bounds.getEast() > DHAKA_QA_BOUNDS.maxLongitude
      ) {
        throw new Error(
          "Zone map coordinates exceed the approved Dhaka bounds.",
        );
      }

      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 12 });
      mapRef.current = map;
      markerLayerRef.current = markerLayer;
      lastFittedZoneSetRef.current = zoneSetSignature(
        currentPropsRef.current.markers,
      );
    } catch {
      tileLayer?.off("tileerror", tileErrorHandler);
      map?.remove();
      setUnavailable(true);
      return;
    }

    return () => {
      tileLayer?.off("tileerror", tileErrorHandler);
      map?.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      circleMarkersRef.current.clear();
      markerHandlersRef.current.clear();
      lastFittedZoneSetRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markerLayerRef.current;
    if (!map || !layer || unavailable) return;

    const current = currentPropsRef.current;
    const nextMarkers = new Map(
      current.markers.map((marker) => [marker.id, marker]),
    );

    for (const [id, circleMarker] of circleMarkersRef.current) {
      if (nextMarkers.has(id)) continue;

      const handler = markerHandlersRef.current.get(id);
      if (handler) circleMarker.off("click", handler);
      markerHandlersRef.current.delete(id);
      layer.removeLayer(circleMarker);
      circleMarkersRef.current.delete(id);
    }

    for (const marker of current.markers) {
      const coordinate = ZONE_COORDINATES[marker.zone];
      const position: L.LatLngTuple = [
        coordinate.latitude,
        coordinate.longitude,
      ];
      // Keep selectable markers registered for hit testing even when the
      // control is temporarily disabled; Leaflet's `interactive` option is
      // fixed when a path is created. The handler itself is attached only
      // while selection is enabled.
      const interactive = current.mode === "selectable";
      const canSelect = current.mode === "selectable" && !current.disabled;
      let circleMarker = circleMarkersRef.current.get(marker.id);

      if (!circleMarker) {
        circleMarker = L.circleMarker(position, {
          ...markerStyle(marker.role),
          interactive,
          radius: 11,
        });
        circleMarker.bindTooltip(markerTooltip(marker, t), {
          className: "zone-map-tooltip",
          direction: "top",
          permanent: true,
        });
        layer.addLayer(circleMarker);
        circleMarkersRef.current.set(marker.id, circleMarker);
      } else {
        circleMarker.setStyle(markerStyle(marker.role));
        circleMarker.setTooltipContent(markerTooltip(marker, t));
      }

      const priorHandler = markerHandlersRef.current.get(marker.id);
      if (priorHandler) circleMarker.off("click", priorHandler);
      markerHandlersRef.current.delete(marker.id);

      if (canSelect) {
        const handler: L.LeafletEventHandlerFn = () => {
          const latest = currentPropsRef.current;
          if (latest.mode === "selectable" && !latest.disabled) {
            latest.onZoneSelect?.(marker.zone);
          }
        };
        circleMarker.on("click", handler);
        markerHandlersRef.current.set(marker.id, handler);
      }
    }

    const nextZoneSignature = zoneSetSignature(current.markers);
    const previousZoneSignature = lastFittedZoneSetRef.current;
    if (
      previousZoneSignature !== undefined &&
      nextZoneSignature !== previousZoneSignature &&
      current.markers.length > 0
    ) {
      const changedZonePoints = [
        ...new Set(current.markers.map(({ zone }) => zone)),
      ].map((zone) => {
        const { latitude, longitude } = ZONE_COORDINATES[zone];
        return [latitude, longitude] as L.LatLngTuple;
      });
      map.fitBounds(L.latLngBounds(changedZonePoints), {
        padding: [24, 24],
        maxZoom: 13,
      });
    }
    lastFittedZoneSetRef.current = nextZoneSignature;
  }, [dataSignature, disabled, locale, mode, unavailable]);

  return (
    <div className="absolute inset-0 h-full min-h-[18rem] w-full">
      <div
        ref={containerRef}
        className="h-full min-h-[18rem] w-full bg-muted"
        data-leaflet-container
      />
      {unavailable && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-muted/95 p-5 text-center text-sm text-muted-foreground">
          <p role="status">{t("map.unavailable")}</p>
        </div>
      )}
    </div>
  );
}
