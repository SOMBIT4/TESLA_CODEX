import { describe, expect, it } from "vitest";

import {
  calculateFare,
  DHAKA_AREAS,
  getDistanceKm,
} from "../src/modules/fares/fare-rules.js";

describe("fare rules", () => {
  it("calculates Nusrat solo and pooled fares", () => {
    expect(calculateFare("Banani", "Mohakhali", 1, false)).toBe(8600);
    expect(calculateFare("Banani", "Mohakhali", 1, true)).toBe(7100);
  });

  it("calculates Rafiq solo and pooled fares", () => {
    expect(calculateFare("Banani", "Gulshan 1", 1, false)).toBe(7400);
    expect(calculateFare("Banani", "Gulshan 1", 1, true)).toBe(5900);
  });

  it("charges the calculated fare per seat", () => {
    expect(calculateFare("Banani", "Mohakhali", 2, false)).toBe(17200);
    expect(calculateFare("Banani", "Mohakhali", 3, true)).toBe(21300);
  });

  it("provides a distance for every pair of supported areas", () => {
    for (const pickup of DHAKA_AREAS) {
      for (const destination of DHAKA_AREAS) {
        if (pickup === destination) {
          continue;
        }

        expect(getDistanceKm(pickup, destination)).toBeGreaterThan(0);
        expect(getDistanceKm(pickup, destination)).toBe(
          getDistanceKm(destination, pickup),
        );
      }
    }
  });

  it("keeps the required demo distances", () => {
    expect(getDistanceKm("Banani", "Mohakhali")).toBe(3);
    expect(getDistanceKm("Banani", "Gulshan 1")).toBe(2);
  });

  it("rejects invalid seat counts and same-area trips", () => {
    expect(() => calculateFare("Banani", "Mohakhali", 0, false)).toThrow(
      "Seats must be an integer between 1 and 4.",
    );
    expect(() => calculateFare("Banani", "Mohakhali", 5, false)).toThrow(
      "Seats must be an integer between 1 and 4.",
    );
    expect(() => calculateFare("Banani", "Mohakhali", 1.5, false)).toThrow(
      "Seats must be an integer between 1 and 4.",
    );
    expect(() => calculateFare("Banani", "Banani", 1, false)).toThrow(
      "Pickup and destination must be different areas.",
    );
  });
});
