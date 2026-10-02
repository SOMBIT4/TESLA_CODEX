import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DHAKA_AREAS } from "@/lib/api/types";
import { LocaleProvider } from "@/lib/i18n/locale-context";
import { ZONE_COORDINATES } from "@/lib/maps/zone-coordinates";
import type { ZoneMapMarker } from "@/components/maps/zone-map";
import LeafletZoneMap from "@/components/maps/leaflet-zone-map";

const leafletMock = vi.hoisted(() => {
  const state: {
    mapShouldThrow: boolean;
    tileErrorHandler?: (error: unknown) => void;
  } = { mapShouldThrow: false };
  const markers: Array<{
    coordinates: readonly number[];
    options: Record<string, unknown>;
    bindTooltip: ReturnType<typeof vi.fn>;
    setTooltipContent: ReturnType<typeof vi.fn>;
    setStyle: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    fire: (eventType: string) => void;
  }> = [];

  const mapInstance = {
    fitBounds: vi.fn(),
    remove: vi.fn(),
  };
  const tileLayerInstance = {
    addTo: vi.fn(),
    on: vi.fn((event: string, handler: (error: unknown) => void) => {
      if (event === "tileerror") state.tileErrorHandler = handler;
      return tileLayerInstance;
    }),
    off: vi.fn(),
  };
  const markerLayer = {
    addTo: vi.fn(() => markerLayer),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
  };
  const L = {
    map: vi.fn((_container: unknown, _options: Record<string, unknown>) => {
      if (state.mapShouldThrow) throw new Error("Leaflet startup failed");
      return mapInstance;
    }),
    tileLayer: vi.fn(() => tileLayerInstance),
    layerGroup: vi.fn(() => markerLayer),
    latLngBounds: vi.fn((coordinates: readonly (readonly number[])[]) => ({
      coordinates,
      getSouth: () => Math.min(...coordinates.map(([latitude]) => latitude)),
      getNorth: () => Math.max(...coordinates.map(([latitude]) => latitude)),
      getWest: () => Math.min(...coordinates.map(([, longitude]) => longitude)),
      getEast: () => Math.max(...coordinates.map(([, longitude]) => longitude)),
    })),
    circleMarker: vi.fn(
      (coordinates: readonly number[], options: Record<string, unknown>) => {
        const handlers = new Map<string, (event: unknown) => void>();
        const marker = {
          coordinates,
          options,
          bindTooltip: vi.fn(),
          setTooltipContent: vi.fn(),
          setStyle: vi.fn(),
          on: vi.fn((eventType: string, handler: (event: unknown) => void) => {
            handlers.set(eventType, handler);
          }),
          off: vi.fn((eventType: string) => {
            handlers.delete(eventType);
          }),
          fire: (eventType: string) => handlers.get(eventType)?.({}),
        };
        markers.push(marker);
        return marker;
      },
    ),
  };

  return { state, markers, mapInstance, tileLayerInstance, markerLayer, L };
});

vi.mock("leaflet", () => ({ default: leafletMock.L }));

const allZoneMarkers: ZoneMapMarker[] = DHAKA_AREAS.map((zone) => ({
  id: `zone:${zone}`,
  zone,
  role: "zone",
}));

function renderMap(
  markers: readonly ZoneMapMarker[] = allZoneMarkers,
  mode: "selectable" | "pool" | "decorative" = "selectable",
) {
  return render(
    <LocaleProvider>
      <LeafletZoneMap mode={mode} markers={markers} />
    </LocaleProvider>,
  );
}

describe("Leaflet zone map lifecycle", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    leafletMock.markers.length = 0;
    leafletMock.state.mapShouldThrow = false;
    leafletMock.state.tileErrorHandler = undefined;
  });

  it("creates one map, fits all nine zones initially, and uses large circle markers", async () => {
    renderMap();

    await waitFor(() => expect(leafletMock.L.map).toHaveBeenCalledTimes(1));

    expect(leafletMock.L.latLngBounds).toHaveBeenCalledTimes(1);
    expect(leafletMock.L.latLngBounds.mock.calls[0][0]).toEqual(
      DHAKA_AREAS.map((zone) => [
        ZONE_COORDINATES[zone].latitude,
        ZONE_COORDINATES[zone].longitude,
      ]),
    );
    expect(leafletMock.mapInstance.fitBounds).toHaveBeenCalledTimes(1);
    expect(leafletMock.L.circleMarker).toHaveBeenCalledTimes(9);
    expect(
      leafletMock.L.circleMarker.mock.calls.map(
        ([, options]) => options.radius,
      ),
    ).toEqual(Array.from({ length: 9 }, () => 11));
  });

  it("uses the public map tile URL when configured", async () => {
    const tileUrl = "https://tiles.example.test/{z}/{x}/{y}.png";
    vi.stubEnv("NEXT_PUBLIC_MAP_TILE_URL", tileUrl);

    renderMap();
    await waitFor(() => expect(leafletMock.L.map).toHaveBeenCalledTimes(1));

    expect(leafletMock.L.tileLayer).toHaveBeenCalledWith(tileUrl, {
      attribution: "",
    });
  });

  it("disables map navigation and marker interaction in decorative mode", async () => {
    renderMap(allZoneMarkers, "decorative");
    await waitFor(() => expect(leafletMock.L.map).toHaveBeenCalledTimes(1));

    expect(leafletMock.L.map.mock.calls[0][1]).toMatchObject({
      zoomControl: false,
      keyboard: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      attributionControl: false,
    });
    expect(
      leafletMock.L.circleMarker.mock.calls.every(
        ([, options]) => options.interactive === false,
      ),
    ).toBe(true);
  });

  it("restores zone selection when a disabled map becomes enabled", async () => {
    const onZoneSelect = vi.fn();
    const markers: ZoneMapMarker[] = [
      { id: "zone:Banani", zone: "Banani", role: "zone" },
    ];
    const { rerender } = render(
      <LocaleProvider>
        <LeafletZoneMap
          mode="selectable"
          markers={markers}
          disabled
          onZoneSelect={onZoneSelect}
        />
      </LocaleProvider>,
    );
    await waitFor(() => expect(leafletMock.L.map).toHaveBeenCalledTimes(1));

    expect(leafletMock.markers[0].options.interactive).toBe(true);
    leafletMock.markers[0].fire("click");
    expect(onZoneSelect).not.toHaveBeenCalled();

    rerender(
      <LocaleProvider>
        <LeafletZoneMap
          mode="selectable"
          markers={markers}
          disabled={false}
          onZoneSelect={onZoneSelect}
        />
      </LocaleProvider>,
    );

    leafletMock.markers[0].fire("click");
    expect(onZoneSelect).toHaveBeenCalledExactlyOnceWith("Banani");
    expect(leafletMock.L.map).toHaveBeenCalledTimes(1);
    expect(leafletMock.L.circleMarker).toHaveBeenCalledTimes(1);
  });

  it("distinguishes pickup and destination markers with role labels", async () => {
    renderMap([
      { id: "pickup:Banani", zone: "Banani", role: "pickup" },
      {
        id: "destination:Mohakhali",
        zone: "Mohakhali",
        role: "destination",
      },
    ]);
    await waitFor(() => expect(leafletMock.L.map).toHaveBeenCalledTimes(1));

    expect(leafletMock.L.circleMarker.mock.calls[0][1].fillColor).toBe(
      "#168357",
    );
    expect(leafletMock.L.circleMarker.mock.calls[1][1].fillColor).toBe(
      "#d94b3d",
    );
    expect(
      leafletMock.markers[0].bindTooltip.mock.calls[0][0].textContent,
    ).toBe("Banani · Pickup");
    expect(
      leafletMock.markers[1].bindTooltip.mock.calls[0][0].textContent,
    ).toBe("Mohakhali · Destination");
  });

  it("reuses markers and preserves the view when a poll returns identical data", async () => {
    const { rerender } = renderMap();
    await waitFor(() => expect(leafletMock.L.map).toHaveBeenCalledTimes(1));

    const markerInstances = [...leafletMock.markers];
    rerender(
      <LocaleProvider>
        <LeafletZoneMap
          mode="selectable"
          markers={allZoneMarkers.map((marker) => ({ ...marker }))}
        />
      </LocaleProvider>,
    );

    expect(leafletMock.L.map).toHaveBeenCalledTimes(1);
    expect(leafletMock.L.circleMarker).toHaveBeenCalledTimes(9);
    expect(leafletMock.markers).toEqual(markerInstances);
    expect(leafletMock.mapInstance.fitBounds).toHaveBeenCalledTimes(1);
  });

  it("refits only when the displayed zone set changes and updates changed labels in place", async () => {
    const firstMarkers: ZoneMapMarker[] = [
      {
        id: "destination:Mohakhali",
        zone: "Mohakhali",
        role: "destination",
        members: [{ passengerName: "Nusrat", seats: 1 }],
      },
    ];
    const { rerender } = renderMap(firstMarkers, "pool");
    await waitFor(() => expect(leafletMock.L.map).toHaveBeenCalledTimes(1));

    rerender(
      <LocaleProvider>
        <LeafletZoneMap
          mode="pool"
          markers={[
            {
              ...firstMarkers[0],
              members: [
                { passengerName: "Nusrat", seats: 1 },
                { passengerName: "Rafiq", seats: 1 },
              ],
            },
          ]}
        />
      </LocaleProvider>,
    );

    expect(leafletMock.L.circleMarker).toHaveBeenCalledTimes(1);
    expect(leafletMock.mapInstance.fitBounds).toHaveBeenCalledTimes(1);
    expect(leafletMock.markers[0].setTooltipContent).toHaveBeenCalledTimes(1);

    rerender(
      <LocaleProvider>
        <LeafletZoneMap
          mode="pool"
          markers={[
            ...firstMarkers,
            { id: "pickup:Banani", zone: "Banani", role: "pickup" },
          ]}
        />
      </LocaleProvider>,
    );

    expect(leafletMock.L.circleMarker).toHaveBeenCalledTimes(2);
    expect(leafletMock.mapInstance.fitBounds).toHaveBeenCalledTimes(2);
  });

  it("shows a local fallback when a tile fails", async () => {
    renderMap();
    await waitFor(() =>
      expect(leafletMock.state.tileErrorHandler).toBeTypeOf("function"),
    );

    act(() => leafletMock.state.tileErrorHandler?.(new Error("tile failed")));

    expect(
      await screen.findByText(
        "Map is unavailable. Choose a zone from the list instead.",
      ),
    ).toBeVisible();
  });

  it("contains a Leaflet initialization failure inside the map", async () => {
    leafletMock.state.mapShouldThrow = true;
    renderMap();

    expect(
      await screen.findByText(
        "Map is unavailable. Choose a zone from the list instead.",
      ),
    ).toBeVisible();
  });
});
