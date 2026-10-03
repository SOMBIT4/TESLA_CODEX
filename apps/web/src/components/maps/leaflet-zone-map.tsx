"use client";

import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DhakaArea } from "@/lib/api/types";
import { DHAKA_AREAS } from "@/lib/api/types";
import { zoneColor } from "@/lib/constants/zone-colors";
import { DHAKA_QA_BOUNDS, ZONE_COORDINATES } from "@/lib/maps/zone-coordinates";
import { useI18n } from "@/lib/i18n/locale-context";
import type {
  ZoneMapMarker,
  ZoneMapMarkerRole,
  ZoneMapProps,
} from "@/components/maps/zone-map";
import type { MessageKey } from "@/lib/i18n/messages";

const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const MARKER_RADIUS = 11;
const PICKUP_COLOR = "#168357";
const DESTINATION_COLOR = "#d94b3d";

// Panning stays inside greater Dhaka so a stray drag never loses the zones.
const PAN_BOUNDS: L.LatLngBoundsLiteral = [
  [DHAKA_QA_BOUNDS.minLatitude - 0.04, DHAKA_QA_BOUNDS.minLongitude - 0.04],
  [DHAKA_QA_BOUNDS.maxLatitude + 0.04, DHAKA_QA_BOUNDS.maxLongitude + 0.04],
];

type TooltipSide = "top" | "bottom" | "left" | "right";

/**
 * Where each zone's label sits. Banani, Gulshan 1/2 and Mohakhali are within
 * a couple of kilometres, so their labels fan out in different directions
 * instead of stacking on top of one another.
 */
const TOOLTIP_SIDE: Readonly<Record<DhakaArea, TooltipSide>> = {
  Banani: "left",
  "Gulshan 1": "right",
  "Gulshan 2": "top",
  Mohakhali: "left",
  Dhanmondi: "bottom",
  Mirpur: "left",
  Uttara: "top",
  Farmgate: "left",
  Bashundhara: "right",
};

const TOOLTIP_OFFSET: Readonly<Record<TooltipSide, L.PointTuple>> = {
  top: [0, -(MARKER_RADIUS + 4)],
  bottom: [0, MARKER_RADIUS + 4],
  left: [-(MARKER_RADIUS + 4), 0],
  right: [MARKER_RADIUS + 4, 0],
};

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
  content.dataset.role = marker.role;

  // An unselected zone is just its name; the role only matters once chosen.
  const zoneName = t(ZONE_LABEL_KEYS[marker.zone]);
  const heading = document.createElement("strong");
  heading.textContent =
    marker.role === "zone"
      ? zoneName
      : `${zoneName} · ${t(ROLE_LABEL_KEYS[marker.role])}`;
  content.append(heading);

  for (const member of marker.members ?? []) {
    const seatLabel = member.seats === 1 ? t("common.seat") : t("common.seats");
    const line = document.createElement("span");
    line.textContent = `${member.passengerName} · ${member.seats} ${seatLabel}`;
    content.append(line);
  }

  return content;
}

function markerStyle(marker: ZoneMapMarker): L.PathOptions {
  const color =
    marker.role === "pickup"
      ? PICKUP_COLOR
      : marker.role === "destination"
        ? DESTINATION_COLOR
        : zoneColor(marker.zone);

  return {
    color: "#ffffff",
    fillColor: color,
    fillOpacity: 0.94,
    opacity: 1,
    weight: 3,
  };
}

function zonePosition(zone: DhakaArea): L.LatLngTuple {
  const { latitude, longitude } = ZONE_COORDINATES[zone];
  return [latitude, longitude];
}

type FitKind = "all" | "focus";

interface FittedView {
  bounds: L.LatLngBounds;
  kind: FitKind;
}

/**
 * Padding for framing the map. A focused view leaves side room proportional
 * to the map width, because the pool labels are wide and would otherwise be
 * clipped at the edges of a phone-sized map.
 */
function fitOptions(kind: FitKind, width: number): L.FitBoundsOptions {
  if (kind === "all") {
    // Uttara's label sits above its marker and Dhanmondi's below, so the
    // vertical edges need more room than the sides.
    return {
      paddingTopLeft: [40, 52],
      paddingBottomRight: [40, 60],
      maxZoom: 12.5,
    };
  }

  const side = Math.min(150, Math.round(width * 0.4));
  return {
    paddingTopLeft: [side, 48],
    paddingBottomRight: [side, 52],
    maxZoom: 13,
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
  const markerRolesRef = useRef(new Map<string, ZoneMapMarkerRole>());
  const markerHandlersRef = useRef(new Map<string, L.LeafletEventHandlerFn>());
  const routeLinesRef = useRef<L.Polyline[]>([]);
  const fittedViewRef = useRef<FittedView | null>(null);
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
    let resizeObserver: ResizeObserver | undefined;
    let hasInteracted = false;
    const markInteracted = () => {
      hasInteracted = true;
    };
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
        maxBounds: PAN_BOUNDS,
        maxBoundsViscosity: 0.85,
        minZoom: 10,
        scrollWheelZoom: !decorative,
        touchZoom: !decorative,
        zoomControl: !decorative,
        zoomSnap: 0.25,
      });

      markerLayer = L.layerGroup().addTo(map);
      tileLayer = L.tileLayer(
        process.env.NEXT_PUBLIC_MAP_TILE_URL || DEFAULT_TILE_URL,
        { attribution: "" },
      );
      tileLayer.on("tileerror", tileErrorHandler);
      tileLayer.addTo(map);

      // A selectable map frames every zone; a pool map opens on the zones it
      // actually shows.
      const initialMarkers = currentPropsRef.current.markers;
      const initialZones =
        currentPropsRef.current.mode === "selectable" ||
        initialMarkers.length === 0
          ? DHAKA_AREAS
          : [...new Set(initialMarkers.map(({ zone }) => zone))];
      const bounds = L.latLngBounds(initialZones.map(zonePosition));

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

      const initialKind: FitKind =
        initialZones === DHAKA_AREAS ? "all" : "focus";
      map.fitBounds(bounds, fitOptions(initialKind, container.clientWidth));
      fittedViewRef.current = { bounds, kind: initialKind };
      mapRef.current = map;
      markerLayerRef.current = markerLayer;
      lastFittedZoneSetRef.current = zoneSetSignature(
        currentPropsRef.current.markers,
      );

      // Leaflet measures its container once at creation. The map mounts
      // before layout settles (dynamic import, responsive grid), so without
      // this it fits the zones into a 0-sized box and opens zoomed out to the
      // whole country. Re-measure on every resize and, until the person has
      // touched the map, keep the zones framed.
      if (typeof ResizeObserver !== "undefined") {
        const activeMap = map;
        container.addEventListener("pointerdown", markInteracted, {
          once: true,
        });
        container.addEventListener("wheel", markInteracted, { once: true });
        resizeObserver = new ResizeObserver(() => {
          activeMap.invalidateSize({ animate: false });
          const view = fittedViewRef.current;
          if (!hasInteracted && view) {
            activeMap.fitBounds(view.bounds, {
              ...fitOptions(view.kind, container.clientWidth),
              animate: false,
            });
          }
        });
        resizeObserver.observe(container);
      }
    } catch {
      resizeObserver?.disconnect();
      tileLayer?.off("tileerror", tileErrorHandler);
      map?.remove();
      setUnavailable(true);
      return;
    }

    return () => {
      resizeObserver?.disconnect();
      container.removeEventListener("pointerdown", markInteracted);
      container.removeEventListener("wheel", markInteracted);
      tileLayer?.off("tileerror", tileErrorHandler);
      map?.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      circleMarkersRef.current.clear();
      markerRolesRef.current.clear();
      markerHandlersRef.current.clear();
      routeLinesRef.current = [];
      fittedViewRef.current = null;
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

    const removeMarker = (id: string) => {
      const circleMarker = circleMarkersRef.current.get(id);
      if (!circleMarker) return;

      const handler = markerHandlersRef.current.get(id);
      if (handler) circleMarker.off("click", handler);
      markerHandlersRef.current.delete(id);
      markerRolesRef.current.delete(id);
      layer.removeLayer(circleMarker);
      circleMarkersRef.current.delete(id);
    };

    for (const id of circleMarkersRef.current.keys()) {
      if (!nextMarkers.has(id)) removeMarker(id);
    }

    for (const marker of current.markers) {
      const position = zonePosition(marker.zone);
      // Keep selectable markers registered for hit testing even when the
      // control is temporarily disabled; Leaflet's `interactive` option is
      // fixed when a path is created. The handler itself is attached only
      // while selection is enabled.
      const interactive = current.mode === "selectable";
      const canSelect = current.mode === "selectable" && !current.disabled;

      // Leaflet applies `className` and the tooltip class only when a layer
      // is created, so a marker whose role changed is rebuilt.
      if (markerRolesRef.current.get(marker.id) !== marker.role) {
        removeMarker(marker.id);
      }

      let circleMarker = circleMarkersRef.current.get(marker.id);

      if (!circleMarker) {
        const side = TOOLTIP_SIDE[marker.zone];

        circleMarker = L.circleMarker(position, {
          ...markerStyle(marker),
          className: `zone-marker zone-marker--${marker.role}`,
          interactive,
          // Above the route lines, below tooltips.
          pane: "markerPane",
          radius: MARKER_RADIUS,
        });
        circleMarker.bindTooltip(markerTooltip(marker, t), {
          className: `zone-map-tooltip zone-map-tooltip--${marker.role}`,
          direction: side,
          offset: TOOLTIP_OFFSET[side],
          opacity: 1,
          permanent: true,
        });
        layer.addLayer(circleMarker);
        circleMarkersRef.current.set(marker.id, circleMarker);
        markerRolesRef.current.set(marker.id, marker.role);
      } else {
        circleMarker.setStyle(markerStyle(marker));
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

    // A pool is drawn as the pickup fanning out to each drop-off.
    for (const line of routeLinesRef.current) layer.removeLayer(line);
    routeLinesRef.current = [];

    if (current.mode === "pool") {
      const pickup = current.markers.find(({ role }) => role === "pickup");

      if (pickup) {
        for (const destination of current.markers) {
          if (destination.role !== "destination") continue;

          const line = L.polyline(
            [zonePosition(pickup.zone), zonePosition(destination.zone)],
            {
              className: "zone-route",
              color: PICKUP_COLOR,
              dashArray: "2 10",
              interactive: false,
              lineCap: "round",
              opacity: 0.9,
              weight: 4,
            },
          );
          layer.addLayer(line);
          routeLinesRef.current.push(line);
        }
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
      ].map(zonePosition);
      const bounds = L.latLngBounds(changedZonePoints);

      map.fitBounds(
        bounds,
        fitOptions("focus", containerRef.current?.clientWidth ?? 0),
      );
      fittedViewRef.current = { bounds, kind: "focus" };
    }
    lastFittedZoneSetRef.current = nextZoneSignature;
  }, [dataSignature, disabled, locale, mode, unavailable]);

  return (
    <div className="absolute inset-0 h-full w-full">
      <div
        ref={containerRef}
        className="zone-map-canvas h-full w-full"
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
