import { describe, expect, it } from "vitest";
import { countsTowardOccupiedSeats } from "../src/modules/pools/pool.types.js";

describe("pool occupancy", () => {
  it.each(["MATCHED", "DRIVER_ARRIVED", "STARTED"] as const)(
    "counts an active %s ride",
    (rideStatus) => {
      expect(countsTowardOccupiedSeats("ACTIVE", rideStatus)).toBe(true);
    },
  );

  it("does not count an active completed ride", () => {
    expect(countsTowardOccupiedSeats("ACTIVE", "COMPLETED")).toBe(false);
  });

  it("does not count a cancelled membership", () => {
    expect(countsTowardOccupiedSeats("CANCELLED", "STARTED")).toBe(false);
  });
});
