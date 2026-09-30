import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import {
  acceptRide,
  dropOffRide,
  getActivePool,
  getDriverSnapshot,
  listWaitingRides,
  setDriverOnlineStatus,
  transitionPool,
} from "@/lib/api/driver";
import { useDriverDashboard } from "@/hooks/use-driver-dashboard";
import type {
  DriverActivePool,
  DriverSnapshot,
  WaitingRide,
} from "@/lib/api/types";

vi.mock("@/lib/api/driver", () => ({
  acceptRide: vi.fn(),
  dropOffRide: vi.fn(),
  getActivePool: vi.fn(),
  getDriverSnapshot: vi.fn(),
  listWaitingRides: vi.fn(),
  setDriverOnlineStatus: vi.fn(),
  transitionPool: vi.fn(),
}));

const mockedAcceptRide = vi.mocked(acceptRide);
const mockedDropOffRide = vi.mocked(dropOffRide);
const mockedGetActivePool = vi.mocked(getActivePool);
const mockedGetDriverSnapshot = vi.mocked(getDriverSnapshot);
const mockedListWaitingRides = vi.mocked(listWaitingRides);
const mockedSetDriverOnlineStatus = vi.mocked(setDriverOnlineStatus);
const mockedTransitionPool = vi.mocked(transitionPool);

const snapshot: DriverSnapshot = {
  isOnline: true,
  vehicle: { id: "vehicle-1", name: "Bullet", capacity: 3, isActive: true },
};

const waitingRide: WaitingRide = {
  id: "ride-1",
  pickupZone: "Banani",
  destinationZone: "Mohakhali",
  seatsRequested: 1,
  estimatedFarePoysha: 8600,
  createdAt: "2026-09-29T10:00:00.000Z",
};

const activePool: DriverActivePool = {
  id: "pool-1",
  status: "MATCHED",
  pickupZone: "Banani",
  vehicle: { name: "Bullet", capacity: 3 },
  occupiedSeats: 1,
  members: [
    {
      rideId: "ride-1",
      passengerName: "Nusrat",
      pickupZone: "Banani",
      destinationZone: "Mohakhali",
      seatsReserved: 1,
      farePoysha: 7100,
    },
  ],
};

function deferred<T>() {
  let resolve: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve: resolve! };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useDriverDashboard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockedGetDriverSnapshot.mockResolvedValue(snapshot);
    mockedListWaitingRides.mockResolvedValue([waitingRide]);
    mockedGetActivePool.mockResolvedValue(activePool);
    mockedAcceptRide.mockResolvedValue({
      pool: {
        id: "pool-1",
        status: "MATCHED",
        pickupZone: "Banani",
        capacity: 3,
        occupiedSeats: 1,
        availableSeats: 2,
      },
      membership: {
        id: "membership-1",
        rideRequestId: "ride-1",
        seatsReserved: 1,
        farePoysha: 7100,
        status: "ACTIVE",
      },
    });
    mockedDropOffRide.mockResolvedValue({
      pool: {
        id: "pool-1",
        status: "STARTED",
        pickupZone: "Banani",
        capacity: 3,
        occupiedSeats: 0,
        availableSeats: 3,
        startedAt: "2026-09-29T14:00:00.000Z",
        completedAt: "2026-09-29T14:30:00.000Z",
      },
      droppedOffRideId: "ride-1",
      completedAt: "2026-09-29T14:30:00.000Z",
    });
    mockedSetDriverOnlineStatus.mockResolvedValue(snapshot);
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
      transitionedRideIds: ["ride-1"],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
  });

  it("polls only requests and active pool every five seconds", async () => {
    const { result } = renderHook(() => useDriverDashboard());
    await flush();

    expect(mockedGetDriverSnapshot).toHaveBeenCalledTimes(1);
    expect(mockedListWaitingRides).toHaveBeenCalledTimes(1);
    expect(mockedGetActivePool).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(mockedGetDriverSnapshot).toHaveBeenCalledTimes(1);
    expect(mockedListWaitingRides).toHaveBeenCalledTimes(2);
    expect(mockedGetActivePool).toHaveBeenCalledTimes(2);
    expect(result.current.waitingRides).toEqual([waitingRide]);
  });

  it("does not overlap scheduled operational refreshes", async () => {
    const nextRides = deferred<WaitingRide[]>();
    const nextPool = deferred<DriverActivePool | null>();
    mockedListWaitingRides
      .mockResolvedValueOnce([waitingRide])
      .mockReturnValueOnce(nextRides.promise);
    mockedGetActivePool
      .mockResolvedValueOnce(activePool)
      .mockReturnValueOnce(nextPool.promise);

    renderHook(() => useDriverDashboard());
    await flush();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(mockedListWaitingRides).toHaveBeenCalledTimes(2);
    expect(mockedGetActivePool).toHaveBeenCalledTimes(2);

    await act(async () => {
      nextRides.resolve([waitingRide]);
      nextPool.resolve(activePool);
      await Promise.resolve();
    });
  });

  it("pauses polling during an accept action and refreshes after it settles", async () => {
    const acceptance = deferred<Awaited<ReturnType<typeof acceptRide>>>();
    mockedAcceptRide.mockReturnValueOnce(acceptance.promise);

    const { result } = renderHook(() => useDriverDashboard());
    await flush();

    let actionPromise: Promise<void> | undefined;
    await act(async () => {
      actionPromise = result.current.acceptRide("ride-1");
      await Promise.resolve();
    });

    expect(result.current.pendingAction).toBe("accept");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(mockedListWaitingRides).toHaveBeenCalledTimes(1);
    expect(mockedGetActivePool).toHaveBeenCalledTimes(1);

    await act(async () => {
      acceptance.resolve({
        pool: {
          id: "pool-1",
          status: "MATCHED",
          pickupZone: "Banani",
          capacity: 3,
          occupiedSeats: 1,
          availableSeats: 2,
        },
        membership: {
          id: "membership-1",
          rideRequestId: "ride-1",
          seatsReserved: 1,
          farePoysha: 7100,
          status: "ACTIVE",
        },
      });
      await actionPromise;
    });

    expect(result.current.pendingAction).toBeNull();
    expect(mockedListWaitingRides).toHaveBeenCalledTimes(2);
    expect(mockedGetActivePool).toHaveBeenCalledTimes(2);
  });

  it("serializes an accept action behind a current refresh", async () => {
    const nextRides = deferred<WaitingRide[]>();
    const nextPool = deferred<DriverActivePool | null>();
    mockedListWaitingRides
      .mockResolvedValueOnce([waitingRide])
      .mockReturnValueOnce(nextRides.promise);
    mockedGetActivePool
      .mockResolvedValueOnce(activePool)
      .mockReturnValueOnce(nextPool.promise);

    const { result } = renderHook(() => useDriverDashboard());
    await flush();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    let actionPromise: Promise<void> | undefined;
    await act(async () => {
      actionPromise = result.current.acceptRide("ride-1");
      await Promise.resolve();
    });
    expect(result.current.pendingAction).toBe("accept");
    expect(mockedAcceptRide).not.toHaveBeenCalled();

    await act(async () => {
      nextRides.resolve([waitingRide]);
      nextPool.resolve(activePool);
      await actionPromise;
    });

    expect(mockedAcceptRide).toHaveBeenCalledWith("ride-1");
  });

  it("maps a full-pool conflict and refreshes live data", async () => {
    mockedAcceptRide.mockRejectedValueOnce(
      new ApiError("POOL_FULL", "The pool has no available seats.", 409),
    );

    const { result } = renderHook(() => useDriverDashboard());
    await flush();

    await act(async () => {
      await result.current.acceptRide("ride-1");
    });

    expect(result.current.error).toBe("Not enough seats left in Bullet");
    expect(mockedListWaitingRides).toHaveBeenCalledTimes(2);
    expect(mockedGetActivePool).toHaveBeenCalledTimes(2);
  });

  it("keeps an unknown accept-conflict server message and refreshes", async () => {
    mockedAcceptRide.mockRejectedValueOnce(
      new ApiError(
        "UNEXPECTED_CONFLICT",
        "A newer request changed the pool.",
        409,
      ),
    );

    const { result } = renderHook(() => useDriverDashboard());
    await flush();

    await act(async () => {
      await result.current.acceptRide("ride-1");
    });

    expect(result.current.error).toBe("A newer request changed the pool.");
    expect(mockedListWaitingRides).toHaveBeenCalledTimes(2);
    expect(mockedGetActivePool).toHaveBeenCalledTimes(2);
  });

  it("serializes a drop-off and refreshes live data after it settles", async () => {
    const dropOff = deferred<Awaited<ReturnType<typeof dropOffRide>>>();
    mockedDropOffRide.mockReturnValueOnce(dropOff.promise);

    const { result } = renderHook(() => useDriverDashboard());
    await flush();

    let firstAction: Promise<void> | undefined;
    await act(async () => {
      firstAction = result.current.dropOffRide("ride-1");
      await Promise.resolve();
    });

    expect(result.current.pendingAction).toBe("drop-off");
    expect(result.current.pendingRideId).toBe("ride-1");

    await act(async () => {
      void result.current.dropOffRide("ride-2");
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(mockedDropOffRide).toHaveBeenCalledTimes(1);
    expect(mockedListWaitingRides).toHaveBeenCalledTimes(1);
    expect(mockedGetActivePool).toHaveBeenCalledTimes(1);

    await act(async () => {
      dropOff.resolve({
        pool: {
          id: "pool-1",
          status: "STARTED",
          pickupZone: "Banani",
          capacity: 3,
          occupiedSeats: 0,
          availableSeats: 3,
          startedAt: "2026-09-29T14:00:00.000Z",
          completedAt: "2026-09-29T14:30:00.000Z",
        },
        droppedOffRideId: "ride-1",
        completedAt: "2026-09-29T14:30:00.000Z",
      });
      await firstAction;
    });

    expect(result.current.pendingAction).toBeNull();
    expect(result.current.pendingRideId).toBeNull();
    expect(mockedListWaitingRides).toHaveBeenCalledTimes(2);
    expect(mockedGetActivePool).toHaveBeenCalledTimes(2);
  });

  it("pauses hidden-tab polling, refreshes on visibility return, and cleans up", async () => {
    const { unmount } = renderHook(() => useDriverDashboard());
    await flush();

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(mockedListWaitingRides).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await flush();
    expect(mockedListWaitingRides).toHaveBeenCalledTimes(2);

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(mockedListWaitingRides).toHaveBeenCalledTimes(2);
  });
});
