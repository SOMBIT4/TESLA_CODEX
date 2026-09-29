import { describe, expect, it } from "vitest";
import {
  driverDashboardReducer,
  initialDriverDashboardState,
} from "@/hooks/use-driver-dashboard";
import type {
  DriverActivePool,
  DriverSnapshot,
  WaitingRide,
} from "@/lib/api/types";

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

describe("driverDashboardReducer", () => {
  it("stores the initial driver snapshot and live operational data", () => {
    const withSnapshot = driverDashboardReducer(initialDriverDashboardState, {
      type: "SNAPSHOT_LOADED",
      snapshot,
    });
    const loaded = driverDashboardReducer(withSnapshot, {
      type: "OPERATIONS_LOADED",
      waitingRides: [waitingRide],
      activePool,
    });

    expect(loaded).toMatchObject({
      snapshot,
      waitingRides: [waitingRide],
      activePool,
      isLoading: false,
      error: null,
    });
  });

  it("keeps the last known operational data when a refresh fails", () => {
    const loaded = driverDashboardReducer(initialDriverDashboardState, {
      type: "OPERATIONS_LOADED",
      waitingRides: [waitingRide],
      activePool,
    });
    const failed = driverDashboardReducer(loaded, {
      type: "REQUEST_FAILED",
      message: "Could not refresh live driver data.",
    });

    expect(failed).toMatchObject({
      waitingRides: [waitingRide],
      activePool,
      error: "Could not refresh live driver data.",
      isLoading: false,
    });
  });

  it("keeps an action error visible when its follow-up refresh succeeds", () => {
    const failedAction = driverDashboardReducer(initialDriverDashboardState, {
      type: "REQUEST_FAILED",
      message: "Not enough seats left in Bullet",
    });
    const refreshed = driverDashboardReducer(failedAction, {
      type: "OPERATIONS_LOADED",
      waitingRides: [waitingRide],
      activePool,
      preserveError: true,
    });

    expect(refreshed.error).toBe("Not enough seats left in Bullet");
  });

  it("records a pending action until its immediate refresh has settled", () => {
    const pending = driverDashboardReducer(initialDriverDashboardState, {
      type: "ACTION_STARTED",
      action: "accept",
    });
    const settled = driverDashboardReducer(pending, {
      type: "ACTION_FINISHED",
    });

    expect(pending.pendingAction).toBe("accept");
    expect(settled.pendingAction).toBeNull();
  });

  it("uses the status mutation response without another status load", () => {
    const updated = driverDashboardReducer(initialDriverDashboardState, {
      type: "STATUS_UPDATED",
      snapshot: { ...snapshot, isOnline: false },
    });

    expect(updated.snapshot?.isOnline).toBe(false);
  });

  it("records an expired session for the dashboard to redirect", () => {
    const expired = driverDashboardReducer(initialDriverDashboardState, {
      type: "UNAUTHENTICATED",
    });

    expect(expired).toMatchObject({
      isUnauthenticated: true,
      isLoading: false,
    });
  });
});
