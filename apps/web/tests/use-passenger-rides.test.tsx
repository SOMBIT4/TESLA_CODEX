import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getRide, listMyRides } from "@/lib/api/rides";
import { usePassengerRides } from "@/hooks/use-passenger-rides";
import type { Ride } from "@/lib/api/types";

vi.mock("@/lib/api/rides", () => ({
  listMyRides: vi.fn(),
  getRide: vi.fn(),
  createRide: vi.fn(),
  cancelRide: vi.fn(),
}));

const mockedListMyRides = vi.mocked(listMyRides);
const mockedGetRide = vi.mocked(getRide);

function ride(status: Ride["status"]): Ride & { completedAt: string | null } {
  return {
    id: "ride-1",
    status,
    pickupZone: "Banani",
    destinationZone: "Mohakhali",
    seatsRequested: 1,
    estimatedFarePoysha: 8600,
    membershipFarePoysha: null,
    poolStatus: null,
    createdAt: "2026-09-28T10:00:00.000Z",
    cancelledAt: status === "CANCELLED" ? "2026-09-28T10:01:00.000Z" : null,
    completedAt:
      status === "COMPLETED" ? "2026-09-29T14:30:00.000Z" : null,
  };
}

describe("usePassengerRides", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("polls the current ride every five seconds and stops after completion", async () => {
    vi.useFakeTimers();
    mockedListMyRides
      .mockResolvedValueOnce([ride("REQUESTED")])
      .mockResolvedValueOnce([ride("COMPLETED")]);
    mockedGetRide
      .mockResolvedValueOnce(ride("STARTED"))
      .mockResolvedValueOnce(ride("COMPLETED"));

    const { result } = renderHook(() => usePassengerRides());

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.currentRide?.status).toBe("REQUESTED");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(result.current.currentRide?.status).toBe("STARTED");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(result.current.currentRide).toBeNull();
    expect(result.current.rides[0]?.completedAt).toBe(
      "2026-09-29T14:30:00.000Z",
    );
    expect(mockedGetRide).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(mockedGetRide).toHaveBeenCalledTimes(2);
  });

  it("cleans up active polling when unmounted", async () => {
    vi.useFakeTimers();
    mockedListMyRides.mockResolvedValue([ride("REQUESTED")]);
    mockedGetRide.mockResolvedValue(ride("STARTED"));

    const { result, unmount } = renderHook(() => usePassengerRides());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.currentRide?.status).toBe("REQUESTED");
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(mockedGetRide).not.toHaveBeenCalled();
  });
});
