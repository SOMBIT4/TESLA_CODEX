import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { estimateRide } from "@/lib/api/rides";
import RideRequestForm from "@/components/passenger/ride-request-form";
import type { Ride } from "@/lib/api/types";

vi.mock("@/lib/api/rides", () => ({
  estimateRide: vi.fn(),
}));

const mockedEstimateRide = vi.mocked(estimateRide);

function ride(status: Ride["status"] = "REQUESTED"): Ride {
  return {
    id: "ride-1",
    status,
    pickupZone: "Banani",
    destinationZone: "Mohakhali",
    seatsRequested: 1,
    estimatedFarePoysha: 8600,
    createdAt: "2026-09-28T10:00:00.000Z",
    cancelledAt: null,
  };
}

function deferred<T>() {
  let resolve: (value: T) => void;

  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve: resolve! };
}

describe("RideRequestForm", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("locks every control while the passenger has an active ride", () => {
    render(<RideRequestForm activeRide={ride()} onCreateRide={vi.fn()} />);

    expect(
      screen.getByText("You already have a ride in progress."),
    ).toBeVisible();
    expect(screen.getByLabelText("Pickup zone")).toBeDisabled();
    expect(screen.getByLabelText("Destination zone")).toBeDisabled();
    expect(screen.getByLabelText("Seats")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Request ride" })).toBeDisabled();
  });

  it("uses the current selections to estimate and request a ride", async () => {
    vi.useFakeTimers();
    mockedEstimateRide.mockResolvedValue({
      estimatedFarePoysha: 8600,
      estimatedFareDisplay: "৳86",
    });
    const onCreateRide = vi.fn().mockResolvedValue(undefined);

    render(<RideRequestForm activeRide={null} onCreateRide={onCreateRide} />);

    fireEvent.change(screen.getByLabelText("Pickup zone"), {
      target: { value: "Banani" },
    });
    fireEvent.change(screen.getByLabelText("Destination zone"), {
      target: { value: "Mohakhali" },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(mockedEstimateRide).toHaveBeenCalledWith({
      pickupZone: "Banani",
      destinationZone: "Mohakhali",
      seats: 1,
    });
    expect(screen.getByText("৳86")).toBeVisible();

    fireEvent.submit(
      screen.getByRole("button", { name: "Request ride" }).closest("form")!,
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(onCreateRide).toHaveBeenCalledWith({
      pickupZone: "Banani",
      destinationZone: "Mohakhali",
      seats: 1,
    });
  });

  it("keeps the latest route estimate when an older request resolves late", async () => {
    vi.useFakeTimers();
    const older = deferred<{
      estimatedFarePoysha: number;
      estimatedFareDisplay: string;
    }>();
    const newer = deferred<{
      estimatedFarePoysha: number;
      estimatedFareDisplay: string;
    }>();
    mockedEstimateRide
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);

    render(<RideRequestForm activeRide={null} onCreateRide={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Pickup zone"), {
      target: { value: "Banani" },
    });
    fireEvent.change(screen.getByLabelText("Destination zone"), {
      target: { value: "Gulshan 1" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    fireEvent.change(screen.getByLabelText("Destination zone"), {
      target: { value: "Mohakhali" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
      newer.resolve({ estimatedFarePoysha: 8600, estimatedFareDisplay: "৳86" });
      await newer.promise;
    });

    expect(screen.getByText("৳86")).toBeVisible();

    await act(async () => {
      older.resolve({ estimatedFarePoysha: 7400, estimatedFareDisplay: "৳74" });
      await older.promise;
    });

    expect(screen.queryByText("৳74")).not.toBeInTheDocument();
    expect(screen.getByText("৳86")).toBeVisible();
  });

  it("keeps selected route inputs after an estimate error", async () => {
    vi.useFakeTimers();
    mockedEstimateRide.mockRejectedValue(
      new ApiError("ROUTE_NOT_FOUND", "That route cannot be estimated.", 422),
    );

    render(<RideRequestForm activeRide={null} onCreateRide={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Pickup zone"), {
      target: { value: "Banani" },
    });
    fireEvent.change(screen.getByLabelText("Destination zone"), {
      target: { value: "Mohakhali" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "That route cannot be estimated.",
    );
    expect(screen.getByLabelText("Pickup zone")).toHaveValue("Banani");
    expect(screen.getByLabelText("Destination zone")).toHaveValue("Mohakhali");
  });
});
