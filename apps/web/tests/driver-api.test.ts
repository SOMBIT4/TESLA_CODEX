import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acceptRide,
  dropOffRide,
  getActivePool,
  getDriverSnapshot,
  listWaitingRides,
  setDriverOnlineStatus,
  transitionPool,
} from "@/lib/api/driver";

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("driver API wrappers", () => {
  it("loads the driver's first-load vehicle snapshot", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        isOnline: true,
        vehicle: {
          id: "vehicle-1",
          name: "Bullet",
          capacity: 3,
          isActive: true,
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getDriverSnapshot()).resolves.toEqual({
      isOnline: true,
      vehicle: { id: "vehicle-1", name: "Bullet", capacity: 3, isActive: true },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/driver/me",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("updates driver availability with the requested online state", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        isOnline: false,
        vehicle: {
          id: "vehicle-1",
          name: "Bullet",
          capacity: 3,
          isActive: true,
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(setDriverOnlineStatus(false)).resolves.toMatchObject({
      isOnline: false,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/driver/status",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ isOnline: false }),
      }),
    );
  });

  it("unwraps the identity-free waiting request queue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          rides: [
            {
              id: "ride-1",
              pickupZone: "Banani",
              destinationZone: "Mohakhali",
              seatsRequested: 1,
              estimatedFarePoysha: 8600,
              createdAt: "2026-09-29T10:00:00.000Z",
            },
          ],
        }),
      ),
    );

    await expect(listWaitingRides()).resolves.toEqual([
      {
        id: "ride-1",
        pickupZone: "Banani",
        destinationZone: "Mohakhali",
        seatsRequested: 1,
        estimatedFarePoysha: 8600,
        createdAt: "2026-09-29T10:00:00.000Z",
      },
    ]);
  });

  it("allows the active-pool endpoint to return no pool", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(null)));

    await expect(getActivePool()).resolves.toBeNull();
  });

  it("posts acceptance and lifecycle actions to the owned driver routes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
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
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
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
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await acceptRide("ride-1");
    await transitionPool("pool-1", "arrive");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/driver/requests/ride-1/accept",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/driver/pools/pool-1/arrive",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("posts a per-rider drop-off to the owned pool route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        pool: {
          id: "pool-1",
          status: "STARTED",
          pickupZone: "Banani",
          capacity: 3,
          occupiedSeats: 1,
          availableSeats: 2,
          startedAt: "2026-09-29T14:00:00.000Z",
          completedAt: null,
        },
        droppedOffRideId: "ride-1",
        completedAt: "2026-09-29T14:30:00.000Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await dropOffRide("pool-1", "ride-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/driver/pools/pool-1/rides/ride-1/drop-off",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
  });
});
