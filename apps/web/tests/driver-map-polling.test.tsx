import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ActivePoolCard from "@/components/driver/active-pool-card";
import LeafletZoneMap from "@/components/maps/leaflet-zone-map";
import { useDriverDashboard } from "@/hooks/use-driver-dashboard";
import { LocaleProvider } from "@/lib/i18n/locale-context";
import {
  getActivePool,
  getDriverHistory,
  getDriverSnapshot,
  listWaitingRides,
  transitionPool,
} from "@/lib/api/driver";
import type { DriverActivePool, DriverSnapshot } from "@/lib/api/types";

const leafletHarness = vi.hoisted(() => {
  const state = { shouldThrow: false };
  const markers: Array<{
    options: Record<string, unknown>;
    tooltip: HTMLElement | null;
    bindTooltip: ReturnType<typeof vi.fn>;
    setTooltipContent: ReturnType<typeof vi.fn>;
    setStyle: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
  }> = [];
  const mapInstance = { fitBounds: vi.fn(), remove: vi.fn() };
  const markerLayer = {
    addTo: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
  };
  markerLayer.addTo.mockReturnValue(markerLayer);
  const tileLayerInstance = {
    addTo: vi.fn(),
    on: vi.fn(() => tileLayerInstance),
    off: vi.fn(),
  };
  const L = {
    map: vi.fn(() => {
      if (state.shouldThrow) throw new Error("Leaflet failed to initialize");
      return mapInstance;
    }),
    layerGroup: vi.fn(() => markerLayer),
    polyline: vi.fn(() => ({})),
    tileLayer: vi.fn(() => tileLayerInstance),
    latLngBounds: vi.fn((coordinates: readonly (readonly number[])[]) => ({
      getSouth: () => Math.min(...coordinates.map(([latitude]) => latitude)),
      getNorth: () => Math.max(...coordinates.map(([latitude]) => latitude)),
      getWest: () => Math.min(...coordinates.map(([, longitude]) => longitude)),
      getEast: () => Math.max(...coordinates.map(([, longitude]) => longitude)),
    })),
    circleMarker: vi.fn(
      (_coordinates: readonly number[], options: Record<string, unknown>) => {
        const marker = {
          options,
          tooltip: null as HTMLElement | null,
          bindTooltip: vi.fn((content: HTMLElement) => {
            marker.tooltip = content;
          }),
          setTooltipContent: vi.fn((content: HTMLElement) => {
            marker.tooltip = content;
          }),
          setStyle: vi.fn(),
          on: vi.fn(),
          off: vi.fn(),
        };
        markers.push(marker);
        return marker;
      },
    ),
  };

  return { state, markers, mapInstance, tileLayerInstance, markerLayer, L };
});

vi.mock("leaflet", () => ({ default: leafletHarness.L }));

vi.mock("@/components/maps/zone-map", () => ({ default: () => null }));

vi.mock("@/lib/api/driver", () => ({
  acceptRide: vi.fn(),
  dropOffRide: vi.fn(),
  getActivePool: vi.fn(),
  getDriverHistory: vi.fn(),
  getDriverSnapshot: vi.fn(),
  listWaitingRides: vi.fn(),
  setDriverOnlineStatus: vi.fn(),
  transitionPool: vi.fn(),
}));

const mockedGetActivePool = vi.mocked(getActivePool);
const mockedGetDriverHistory = vi.mocked(getDriverHistory);
const mockedGetDriverSnapshot = vi.mocked(getDriverSnapshot);
const mockedListWaitingRides = vi.mocked(listWaitingRides);
const mockedTransitionPool = vi.mocked(transitionPool);

const snapshot: DriverSnapshot = {
  isOnline: true,
  vehicle: { id: "vehicle-1", name: "Bullet", capacity: 3, isActive: true },
};

const activePool: DriverActivePool = {
  id: "pool-1",
  status: "MATCHED",
  pickupZone: "Banani",
  vehicle: { name: "Bullet", capacity: 3 },
  occupiedSeats: 1,
  members: [
    {
      rideId: "ride-nusrat",
      passengerName: "Nusrat",
      pickupZone: "Banani",
      destinationZone: "Mohakhali",
      seatsReserved: 1,
      farePoysha: 8600,
    },
  ],
  routeStops: [
    {
      kind: "PICKUP",
      zone: "Banani",
      done: false,
      members: [
        {
          rideId: "ride-nusrat",
          passengerName: "Nusrat",
          seatsReserved: 1,
        },
      ],
    },
    {
      kind: "DROPOFF",
      zone: "Mohakhali",
      done: false,
      members: [
        {
          rideId: "ride-nusrat",
          passengerName: "Nusrat",
          seatsReserved: 1,
        },
      ],
    },
  ],
};

function ActivePoolMapHarness() {
  const dashboard = useDriverDashboard();
  const pool = dashboard.activePool;

  if (!pool) return null;

  const markers = pool.routeStops.map((stop) => ({
    id: `${stop.kind.toLowerCase()}:${stop.zone}`,
    zone: stop.zone,
    role: stop.kind === "PICKUP" ? ("pickup" as const) : ("destination" as const),
    done: stop.done,
    members: stop.members.map((member) => ({
      passengerName: member.passengerName,
      seats: member.seatsReserved,
    })),
  }));

  return (
    <>
      <LeafletZoneMap mode="pool" markers={markers} />
      <ActivePoolCard
        onArrive={dashboard.arrive}
        onDropOff={dashboard.dropOffRide}
        onStart={dashboard.start}
        pendingAction={dashboard.pendingAction}
        pendingRideId={dashboard.pendingRideId}
        pendingPickupZone={dashboard.pendingPickupZone}
        pool={pool}
      />
    </>
  );
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("driver active-pool map polling", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    vi.clearAllMocks();
    leafletHarness.markers.length = 0;
    leafletHarness.state.shouldThrow = false;
    mockedGetDriverSnapshot.mockResolvedValue(snapshot);
    mockedListWaitingRides.mockResolvedValue([]);
    mockedGetActivePool.mockImplementation(async () => ({
      ...activePool,
      members: activePool.members.map((member) => ({ ...member })),
    }));
    mockedGetDriverHistory.mockResolvedValue([]);
    mockedTransitionPool.mockResolvedValue({
      pool: {
        id: "pool-1",
        status: "DRIVER_ARRIVED",
        pickupZone: "Banani",
        capacity: 3,
        occupiedSeats: 1,
        availableSeats: 2,
        startedAt: null,
        completedAt: null,
      },
      transitionedRideIds: ["ride-nusrat"],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reuses the map and markers and preserves its view across an identical five-second poll", async () => {
    render(
      <LocaleProvider>
        <ActivePoolMapHarness />
      </LocaleProvider>,
    );
    await flush();

    expect(leafletHarness.L.map).toHaveBeenCalledTimes(1);

    const initialMarkers = [...leafletHarness.markers];
    expect(initialMarkers).toHaveLength(2);
    expect(leafletHarness.mapInstance.fitBounds).toHaveBeenCalledTimes(1);
    const destinationTooltip = initialMarkers.find(
      (marker) => marker.options.fillColor === "#d94b3d",
    )?.tooltip?.textContent;
    expect(destinationTooltip).toContain("Nusrat · 1 seat");
    expect(destinationTooltip).not.toContain("ride-nusrat");
    expect(destinationTooltip).not.toContain("@example.com");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    await flush();

    expect(mockedGetActivePool).toHaveBeenCalledTimes(2);
    expect(leafletHarness.L.map).toHaveBeenCalledTimes(1);
    expect(leafletHarness.L.circleMarker).toHaveBeenCalledTimes(2);
    expect(leafletHarness.markers).toEqual(initialMarkers);
    expect(leafletHarness.mapInstance.fitBounds).toHaveBeenCalledTimes(1);
  });

  it("keeps pool actions usable when Leaflet startup fails", async () => {
    leafletHarness.state.shouldThrow = true;
    render(
      <LocaleProvider>
        <ActivePoolMapHarness />
      </LocaleProvider>,
    );
    await flush();

    expect(
      await screen.findByText(
        "Map is unavailable. Choose a zone from the list instead.",
      ),
    ).toBeVisible();
    const arriveButton = screen.getByRole("button", {
      name: "Mark arrived · Banani",
    });
    expect(arriveButton).toBeEnabled();

    fireEvent.click(arriveButton);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockedTransitionPool).toHaveBeenCalledWith(
      "pool-1",
      "arrive",
      "Banani",
    );
  });
});
