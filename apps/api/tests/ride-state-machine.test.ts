import { describe, expect, it } from "vitest";
import {
  VALID_RIDE_TRANSITIONS,
  canTransitionRide,
} from "../src/modules/rides/ride-state-machine.js";

describe("ride state machine", () => {
  it.each([
    ["REQUESTED", "MATCHED"],
    ["REQUESTED", "CANCELLED"],
    ["MATCHED", "DRIVER_ARRIVED"],
    ["DRIVER_ARRIVED", "STARTED"],
    ["STARTED", "COMPLETED"],
  ] as const)("allows %s to %s", (from, to) => {
    expect(canTransitionRide(from, to)).toBe(true);
  });

  it.each([
    ["REQUESTED", "STARTED"],
    ["MATCHED", "REQUESTED"],
    ["DRIVER_ARRIVED", "CANCELLED"],
    ["STARTED", "CANCELLED"],
    ["COMPLETED", "STARTED"],
    ["CANCELLED", "REQUESTED"],
  ] as const)("rejects %s to %s", (from, to) => {
    expect(canTransitionRide(from, to)).toBe(false);
  });

  it("defines every status, including terminal states", () => {
    expect(VALID_RIDE_TRANSITIONS).toEqual({
      REQUESTED: ["MATCHED", "CANCELLED"],
      MATCHED: ["DRIVER_ARRIVED"],
      DRIVER_ARRIVED: ["STARTED"],
      STARTED: ["COMPLETED"],
      COMPLETED: [],
      CANCELLED: [],
    });
  });
});
