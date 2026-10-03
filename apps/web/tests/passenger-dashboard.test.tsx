import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PassengerDashboard from "@/components/passenger/passenger-dashboard";
import { usePassengerRides } from "@/hooks/use-passenger-rides";
import type { Ride } from "@/lib/api/types";

vi.mock("@/hooks/use-passenger-rides", () => ({
  usePassengerRides: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

const mockedUsePassengerRides = vi.mocked(usePassengerRides);

function ride(
  status: Ride["status"],
  membershipFarePoysha: number | null = null,
): Ride & { completedAt: string | null } {
  return {
    id: `ride-${status}`,
    status,
    pickupZone: "Banani",
    destinationZone: "Mohakhali",
    seatsRequested: 1,
    estimatedFarePoysha: 8600,
    membershipFarePoysha,
    createdAt: "2026-09-28T10:00:00.000Z",
    cancelledAt: null,
    completedAt:
      status === "COMPLETED" ? "2026-09-29T14:30:00.000Z" : null,
  };
}

function state(overrides: Partial<ReturnType<typeof usePassengerRides>> = {}) {
  return {
    rides: [],
    currentRide: null,
    isLoading: false,
    error: null,
    isUnauthenticated: false,
    createRide: vi.fn(),
    cancelRide: vi.fn(),
    refresh: vi.fn(),
    ...overrides,
  };
}

describe("PassengerDashboard", () => {
  it("shows accessible loading and error states", () => {
    mockedUsePassengerRides.mockReturnValue(state({ isLoading: true }));
    const { rerender } = render(<PassengerDashboard />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading your rides");

    mockedUsePassengerRides.mockReturnValue(
      state({ error: "Unable to load your rides." }),
    );
    rerender(<PassengerDashboard />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to load your rides.",
    );
  });

  it("keeps ride request available when there is no active ride", () => {
    mockedUsePassengerRides.mockReturnValue(state());

    render(<PassengerDashboard />);

    expect(screen.getByLabelText("Pickup zone")).toBeEnabled();
    expect(screen.getByLabelText("Destination zone")).toBeEnabled();
    expect(screen.getByLabelText("Seats")).toBeEnabled();
    expect(screen.getByText("No rides yet")).toBeVisible();
  });

  it.each(["MATCHED", "STARTED"] as const)(
    "does not offer cancellation after a ride is %s",
    (status) => {
      mockedUsePassengerRides.mockReturnValue(
        state({ rides: [ride(status)], currentRide: ride(status) }),
      );

      render(<PassengerDashboard />);

      expect(
        screen.queryByRole("button", { name: "Cancel ride" }),
      ).not.toBeInTheDocument();
    },
  );

  it("offers cancellation for an active requested ride", () => {
    const currentRide = ride("REQUESTED");
    mockedUsePassengerRides.mockReturnValue(
      state({ rides: [currentRide], currentRide }),
    );

    render(<PassengerDashboard />);

    expect(screen.getByRole("button", { name: "Cancel ride" })).toBeVisible();
  });

  it("shows the solo fare estimate before a ride is matched", () => {
    const currentRide = ride("REQUESTED");
    mockedUsePassengerRides.mockReturnValue(
      state({ rides: [currentRide], currentRide }),
    );

    render(<PassengerDashboard />);

    expect(screen.getByText("Estimated solo fare")).toBeVisible();
    expect(screen.getByText("৳86")).toBeVisible();
  });

  it.each(["MATCHED", "DRIVER_ARRIVED"] as const)(
    "shows the stored membership fare as current while the trip is %s",
    (status) => {
      const currentRide = ride(status, 7100);
      mockedUsePassengerRides.mockReturnValue(
        state({ rides: [currentRide], currentRide }),
      );

      render(<PassengerDashboard />);

      expect(screen.getByText("Current fare")).toBeVisible();
      expect(screen.getByText("71.00 Tk")).toBeVisible();
      expect(screen.queryByText("86.00 Tk")).not.toBeInTheDocument();
    },
  );

  it("labels the membership fare final after the trip starts", () => {
    const currentRide = ride("STARTED", 7100);
    mockedUsePassengerRides.mockReturnValue(
      state({ rides: [currentRide], currentRide }),
    );

    render(<PassengerDashboard />);

    expect(screen.getByText("Final fare")).toBeVisible();
    expect(screen.getByText("71.00 Tk")).toBeVisible();
  });

  it("sends cancellation through the ride state action", async () => {
    const currentRide = ride("REQUESTED");
    const cancelRide = vi.fn().mockResolvedValue(undefined);
    mockedUsePassengerRides.mockReturnValue(
      state({ rides: [currentRide], currentRide, cancelRide }),
    );

    render(<PassengerDashboard />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel ride" }));

    await waitFor(() =>
      expect(cancelRide).toHaveBeenCalledWith(currentRide.id),
    );
  });

  it("shows the completion time beside completed rides", () => {
    const completedRide = ride("COMPLETED", 7100);
    mockedUsePassengerRides.mockReturnValue(
      state({ rides: [completedRide] }),
    );

    render(<PassengerDashboard />);

    expect(screen.getByText(/Completed ·/)).toHaveTextContent(
      "Completed · Sep 29, 8:30 PM",
    );
    const completedRow = screen.getByText(/Completed ·/).closest("li");
    expect(completedRow).toHaveTextContent("Final fare");
    expect(completedRow).toHaveTextContent("71.00 Tk");
  });
});
