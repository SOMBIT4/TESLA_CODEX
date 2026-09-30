import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DriverDashboard from "@/components/driver/driver-dashboard";
import { useDriverDashboard } from "@/hooks/use-driver-dashboard";
import type {
  DriverActivePool,
  DriverHistoryPool,
  DriverSnapshot,
  WaitingRide,
} from "@/lib/api/types";

vi.mock("@/hooks/use-driver-dashboard", () => ({
  useDriverDashboard: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

const mockedUseDriverDashboard = vi.mocked(useDriverDashboard);

const vehicle = {
  id: "vehicle-1",
  name: "Bullet",
  capacity: 3,
  isActive: true,
};

const onlineSnapshot: DriverSnapshot = {
  isOnline: true,
  vehicle,
};

const waitingRide: WaitingRide = {
  id: "ride-1",
  pickupZone: "Banani",
  destinationZone: "Mohakhali",
  seatsRequested: 1,
  estimatedFarePoysha: 8600,
  createdAt: "2026-09-29T10:00:00.000Z",
};

function pool(
  status: DriverActivePool["status"] = "MATCHED",
): DriverActivePool {
  return {
    id: "pool-1",
    status,
    pickupZone: "Banani",
    vehicle: { name: "Bullet", capacity: 3 },
    occupiedSeats: 2,
    members: [
      {
        rideId: "ride-nusrat",
        passengerName: "Nusrat",
        pickupZone: "Banani",
        destinationZone: "Mohakhali",
        seatsReserved: 1,
        farePoysha: 7100,
      },
      {
        rideId: "ride-rafiq",
        passengerName: "Rafiq",
        pickupZone: "Banani",
        destinationZone: "Gulshan 1",
        seatsReserved: 1,
        farePoysha: 5900,
      },
    ],
  };
}

const historyPool: DriverHistoryPool = {
  id: "pool-history-1",
  pickupZone: "Banani",
  vehicle: { name: "Bullet", capacity: 3 },
  startedAt: "2026-09-29T14:00:00.000Z",
  completedAt: "2026-09-29T14:30:00.000Z",
  members: [
    {
      passengerName: "Nusrat",
      pickupZone: "Banani",
      destinationZone: "Mohakhali",
      seatsReserved: 1,
      farePoysha: 7100,
      completedAt: "2026-09-29T14:25:00.000Z",
    },
  ],
};

function state(overrides: Partial<ReturnType<typeof useDriverDashboard>> = {}) {
  return {
    snapshot: onlineSnapshot,
    waitingRides: [],
    activePool: null,
    history: [],
    isLoading: false,
    error: null,
    isUnauthenticated: false,
    pendingAction: null,
    refreshOperations: vi.fn().mockResolvedValue(undefined),
    refreshHistory: vi.fn().mockResolvedValue(undefined),
    toggleStatus: vi.fn().mockResolvedValue(undefined),
    acceptRide: vi.fn().mockResolvedValue(undefined),
    arrive: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    dropOffRide: vi.fn().mockResolvedValue(undefined),
    pendingRideId: null,
    ...overrides,
  };
}

describe("DriverDashboard", () => {
  it("shows loading, error, and empty operational states", () => {
    mockedUseDriverDashboard.mockReturnValue(state({ isLoading: true }));
    const { rerender } = render(<DriverDashboard />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading driver workspace",
    );

    mockedUseDriverDashboard.mockReturnValue(
      state({ error: "Could not refresh live driver data." }),
    );
    rerender(<DriverDashboard />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not refresh live driver data.",
    );
    expect(screen.getByText("No waiting requests")).toBeVisible();
    expect(screen.getByText("No active pool")).toBeVisible();
  });

  it("requires an active vehicle before a driver can go online", () => {
    mockedUseDriverDashboard.mockReturnValue(
      state({ snapshot: { isOnline: false, vehicle: null } }),
    );

    render(<DriverDashboard />);

    expect(screen.getByText("No active vehicle")).toBeVisible();
    expect(screen.getByRole("button", { name: "Go online" })).toBeDisabled();
  });

  it("shows the online control and sends its action through the dashboard hook", async () => {
    const toggleStatus = vi.fn().mockResolvedValue(undefined);
    mockedUseDriverDashboard.mockReturnValue(
      state({ snapshot: { ...onlineSnapshot, isOnline: false }, toggleStatus }),
    );

    render(<DriverDashboard />);
    fireEvent.click(screen.getByRole("button", { name: "Go online" }));

    await waitFor(() => expect(toggleStatus).toHaveBeenCalledTimes(1));
  });

  it("shows identity-free requests and disables acceptance while offline", () => {
    mockedUseDriverDashboard.mockReturnValue(
      state({
        snapshot: { ...onlineSnapshot, isOnline: false },
        waitingRides: [waitingRide],
      }),
    );

    const { container } = render(<DriverDashboard />);

    expect(screen.getByText("Banani → Mohakhali")).toBeVisible();
    expect(screen.getByText("1 seat")).toBeVisible();
    expect(screen.getByRole("button", { name: "Accept ride" })).toBeDisabled();
    expect(container).not.toHaveTextContent("Nusrat");
    expect(container).not.toHaveTextContent("nusrat@example.com");
  });

  it("shows only approved active-pool member fields and exact pooled fares", () => {
    mockedUseDriverDashboard.mockReturnValue(state({ activePool: pool() }));

    const { container } = render(<DriverDashboard />);

    expect(screen.getByText("Nusrat")).toBeVisible();
    expect(screen.getByText("Rafiq")).toBeVisible();
    expect(screen.getByText("71.00 Tk")).toBeVisible();
    expect(screen.getByText("59.00 Tk")).toBeVisible();
    expect(screen.getAllByText("1 seat")).toHaveLength(2);
    expect(container).not.toHaveTextContent("nusrat@example.com");
    expect(container).not.toHaveTextContent("ride-nusrat");
  });

  it("shows completed pool history from the dashboard hook", () => {
    mockedUseDriverDashboard.mockReturnValue(state({ history: [historyPool] }));

    render(<DriverDashboard />);

    expect(
      screen.getByRole("heading", { name: "Completed pool history" }),
    ).toBeVisible();
    expect(screen.getByText("Nusrat")).toBeVisible();
    expect(screen.getByText("71.00 Tk")).toBeVisible();
  });

  it("selects valid lifecycle controls and blocks acceptance after arrival", async () => {
    const arrive = vi.fn().mockResolvedValue(undefined);
    mockedUseDriverDashboard.mockReturnValue(
      state({ activePool: pool("MATCHED"), arrive }),
    );
    const { rerender } = render(<DriverDashboard />);

    fireEvent.click(screen.getByRole("button", { name: "Mark arrived" }));
    await waitFor(() => expect(arrive).toHaveBeenCalledTimes(1));

    mockedUseDriverDashboard.mockReturnValue(
      state({
        activePool: pool("DRIVER_ARRIVED"),
        waitingRides: [waitingRide],
      }),
    );
    rerender(<DriverDashboard />);

    expect(screen.getByRole("button", { name: "Start trip" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Accept ride" })).toBeDisabled();
  });

  it("shows per-rider drop-off controls only after the trip starts", async () => {
    const dropOffRide = vi.fn().mockResolvedValue(undefined);
    mockedUseDriverDashboard.mockReturnValue(
      state({ activePool: pool("MATCHED"), dropOffRide }),
    );

    const { rerender } = render(<DriverDashboard />);

    expect(screen.queryByRole("button", { name: "Drop off" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Complete trip" })).toBeNull();

    mockedUseDriverDashboard.mockReturnValue(
      state({ activePool: pool("STARTED"), dropOffRide }),
    );
    rerender(<DriverDashboard />);

    expect(screen.getAllByRole("button", { name: "Drop off" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Complete trip" })).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: "Drop off" })[0]);
    await waitFor(() => expect(dropOffRide).toHaveBeenCalledWith("ride-nusrat"));
  });

  it("marks only the selected drop-off button pending and disables all actions", () => {
    mockedUseDriverDashboard.mockReturnValue(
      state({
        activePool: pool("STARTED"),
        pendingAction: "drop-off",
        pendingRideId: "ride-rafiq",
      }),
    );

    render(<DriverDashboard />);

    expect(
      screen.getByRole("button", { name: "Dropping off…" }),
    ).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Drop off" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Drop off" })[0]).toBeDisabled();
  });

  it("disables every mutation control while an action is pending", () => {
    mockedUseDriverDashboard.mockReturnValue(
      state({
        activePool: pool("MATCHED"),
        waitingRides: [waitingRide],
        pendingAction: "accept",
      }),
    );

    render(<DriverDashboard />);

    expect(screen.getByRole("button", { name: "Go offline" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Accepting…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mark arrived" })).toBeDisabled();
  });
});
