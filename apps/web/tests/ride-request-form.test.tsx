import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { estimateRide } from "@/lib/api/rides";
import RideRequestForm from "@/components/passenger/ride-request-form";
import type { Ride } from "@/lib/api/types";
import type { ZoneMapProps } from "@/components/maps/zone-map";

const mapHarness = vi.hoisted(() => ({
  shouldCrash: false,
  tileFailed: false,
}));

vi.mock("next/dynamic", () => ({
  default: () =>
    function TestLeafletZoneMap({
      markers,
      disabled,
      onZoneSelect,
    }: ZoneMapProps) {
      if (mapHarness.shouldCrash) {
        throw new Error("Map startup failed");
      }

      if (mapHarness.tileFailed) {
        return (
          <div role="status">
            Map is unavailable. Choose a zone from the list instead.
          </div>
        );
      }

      return (
        <div data-testid="ride-zone-map" data-map-disabled={String(disabled)}>
          {markers.map((marker) => (
            <button
              aria-label={`Select ${marker.zone} on map`}
              data-marker-id={marker.id}
              disabled={disabled}
              key={marker.id}
              onClick={() => onZoneSelect?.(marker.zone)}
              type="button"
            />
          ))}
        </div>
      );
    },
}));

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
    membershipFarePoysha: null,
    createdAt: "2026-09-28T10:00:00.000Z",
    cancelledAt: null,
    completedAt: null,
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
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mapHarness.shouldCrash = false;
    mapHarness.tileFailed = false;
  });

  it("locks every control while the passenger has an active ride", () => {
    render(<RideRequestForm activeRide={ride()} onCreateRide={vi.fn()} />);

    expect(
      screen.getByText("You already have a ride in progress."),
    ).toBeVisible();
    expect(screen.getByLabelText("Pickup zone")).toBeDisabled();
    expect(screen.getByLabelText("Destination zone")).toBeDisabled();
    expect(screen.getByLabelText("Seats")).toBeDisabled();
    expect(screen.getByTestId("ride-zone-map")).toHaveAttribute(
      "data-map-disabled",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Select Banani on map" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Request ride" })).toBeDisabled();
  });

  it("selects pickup and destination on the map and keeps the API fare and request payload", async () => {
    vi.useFakeTimers();
    mockedEstimateRide.mockResolvedValue({
      estimatedFarePoysha: 8600,
      estimatedFareDisplay: "৳86",
    });
    const onCreateRide = vi.fn().mockResolvedValue(undefined);

    render(<RideRequestForm activeRide={null} onCreateRide={onCreateRide} />);

    expect(screen.getByRole("radio", { name: "Pickup" })).toBeChecked();
    expect(screen.getByText("Tap a zone to set pickup")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Select Banani on map" }),
    );
    expect(screen.getByLabelText("Pickup zone")).toHaveValue("Banani");

    fireEvent.click(screen.getByRole("radio", { name: "Destination" }));
    expect(screen.getByText("Tap a zone to set destination")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Select Mohakhali on map" }),
    );
    expect(screen.getByLabelText("Destination zone")).toHaveValue("Mohakhali");

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

  it("keeps each zone marker identity stable when its selected role changes", () => {
    render(<RideRequestForm activeRide={null} onCreateRide={vi.fn()} />);
    const bananiMarker = screen.getByRole("button", {
      name: "Select Banani on map",
    });

    expect(bananiMarker).toHaveAttribute("data-marker-id", "zone:Banani");
    fireEvent.click(bananiMarker);

    expect(
      screen.getByRole("button", { name: "Select Banani on map" }),
    ).toHaveAttribute("data-marker-id", "zone:Banani");
  });

  it("keeps identical pickup and destination invalid when selected on the map", () => {
    render(<RideRequestForm activeRide={null} onCreateRide={vi.fn()} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Select Banani on map" }),
    );
    fireEvent.click(screen.getByRole("radio", { name: "Destination" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Select Banani on map" }),
    );

    expect(screen.getByLabelText("Pickup zone")).toHaveValue("Banani");
    expect(screen.getByLabelText("Destination zone")).toHaveValue("Banani");
    expect(screen.getByRole("button", { name: "Request ride" })).toBeDisabled();
  });

  it("keeps map selection disabled while a ride request is pending", async () => {
    vi.useFakeTimers();
    mockedEstimateRide.mockResolvedValue({
      estimatedFarePoysha: 8600,
      estimatedFareDisplay: "৳86",
    });
    const pendingRequest = deferred<unknown>();
    const onCreateRide = vi.fn(() => pendingRequest.promise);

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
    mockedEstimateRide.mockClear();

    fireEvent.submit(
      screen.getByRole("button", { name: "Request ride" }).closest("form")!,
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("ride-zone-map")).toHaveAttribute(
      "data-map-disabled",
      "true",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Select Gulshan 1 on map" }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(screen.getByLabelText("Pickup zone")).toHaveValue("Banani");
    expect(screen.getByLabelText("Destination zone")).toHaveValue("Mohakhali");
    expect(mockedEstimateRide).not.toHaveBeenCalled();

    await act(async () => {
      pendingRequest.resolve(undefined);
      await pendingRequest.promise;
    });
  });

  it.each([
    ["tile failure", "tileFailed"],
    ["startup crash", "shouldCrash"],
  ] as const)(
    "keeps ride requests usable after a map %s",
    async (_failure, failureFlag) => {
      mapHarness[failureFlag] = true;
      if (mapHarness.shouldCrash) {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
      }
      const onCreateRide = vi.fn().mockResolvedValue(undefined);

      render(<RideRequestForm activeRide={null} onCreateRide={onCreateRide} />);

      expect(
        await screen.findByText(
          "Map is unavailable. Choose a zone from the list instead.",
        ),
      ).toBeVisible();
      fireEvent.change(screen.getByLabelText("Pickup zone"), {
        target: { value: "Banani" },
      });
      fireEvent.change(screen.getByLabelText("Destination zone"), {
        target: { value: "Mohakhali" },
      });
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
    },
  );

  it("lets a passenger request up to four seats", async () => {
    vi.useFakeTimers();
    mockedEstimateRide.mockResolvedValue({
      estimatedFarePoysha: 34400,
      estimatedFareDisplay: "৳344",
    });
    const onCreateRide = vi.fn().mockResolvedValue(undefined);

    render(<RideRequestForm activeRide={null} onCreateRide={onCreateRide} />);

    expect(
      within(screen.getByRole("group", { name: "Seats" })).getAllByRole(
        "radio",
      ),
    ).toHaveLength(4);

    fireEvent.change(screen.getByLabelText("Pickup zone"), {
      target: { value: "Banani" },
    });
    fireEvent.change(screen.getByLabelText("Destination zone"), {
      target: { value: "Mohakhali" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "4 seats" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(mockedEstimateRide).toHaveBeenLastCalledWith({
      pickupZone: "Banani",
      destinationZone: "Mohakhali",
      seats: 4,
    });

    fireEvent.submit(
      screen.getByRole("button", { name: "Request ride" }).closest("form")!,
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(onCreateRide).toHaveBeenCalledWith({
      pickupZone: "Banani",
      destinationZone: "Mohakhali",
      seats: 4,
    });
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
