import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DriverHistory from "@/components/driver/driver-history";
import type { DriverHistoryPool } from "@/lib/api/types";

const completedPool: DriverHistoryPool = {
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
    {
      passengerName: "Rafiq",
      pickupZone: "Banani",
      destinationZone: "Gulshan 1",
      seatsReserved: 1,
      farePoysha: 5900,
      completedAt: "2026-09-29T14:30:00.000Z",
    },
  ],
};

describe("DriverHistory", () => {
  it("shows a useful empty state", () => {
    render(<DriverHistory history={[]} />);

    expect(
      screen.getByRole("heading", { name: "Completed pool history" }),
    ).toBeVisible();
    expect(screen.getByText("No completed pools yet.")).toBeVisible();
  });

  it("shows completed pool and member details without passenger identity data", () => {
    const { container } = render(<DriverHistory history={[completedPool]} />);

    expect(screen.getByText("Bullet")).toBeVisible();
    expect(screen.getByText("Banani pool")).toBeVisible();
    expect(screen.getByText("Completed")).toBeVisible();
    expect(
      screen.getByRole("time", { name: /completed/i }),
    ).toHaveAttribute("dateTime", completedPool.completedAt);
    expect(screen.getByText("Nusrat")).toBeVisible();
    expect(screen.getByText("Rafiq")).toBeVisible();
    expect(screen.getByText("Banani → Mohakhali")).toBeVisible();
    expect(screen.getByText("Banani → Gulshan 1")).toBeVisible();
    expect(screen.getByText("71.00 Tk")).toBeVisible();
    expect(screen.getByText("59.00 Tk")).toBeVisible();
    expect(screen.getAllByText("1 seat")).toHaveLength(2);
    expect(container).not.toHaveTextContent("nusrat@example.com");
    expect(container).not.toHaveTextContent("passenger-1");
    expect(container).not.toHaveTextContent("ride-history-1");
  });
});
