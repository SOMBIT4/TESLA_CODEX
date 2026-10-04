import { describe, expect, it } from "vitest";
import {
  calculateBestPoolRoute,
  getRouteDistanceKm,
  isDetourWithinLimit,
  type PoolRouteRide,
} from "../src/modules/pools/pool-route.js";

const nusrat: PoolRouteRide = {
  rideId: "ride-nusrat",
  pickupZone: "Banani",
  destinationZone: "Mohakhali",
};

const rafiq: PoolRouteRide = {
  rideId: "ride-rafiq",
  pickupZone: "Banani",
  destinationZone: "Gulshan 1",
};

describe("pool route compatibility", () => {
  it("keeps Nusrat and Rafiq compatible at 35% and chooses Gulshan 1 first", () => {
    const result = calculateBestPoolRoute([nusrat, rafiq], "Banani", 35);

    expect(result.compatible).toBe(true);
    expect(
      result.stops.map(({ kind, zone }) => kind + ":" + zone),
    ).toEqual([
      "PICKUP:Banani",
      "DROPOFF:Gulshan 1",
      "DROPOFF:Mohakhali",
    ]);
    expect(result.riderDetours).toEqual([
      {
        rideId: "ride-nusrat",
        soloDistanceKm: 3,
        inVehicleDistanceKm: 4,
        detourKm: 1,
      },
      {
        rideId: "ride-rafiq",
        soloDistanceKm: 2,
        inVehicleDistanceKm: 2,
        detourKm: 0,
      },
    ]);
  });

  it("rejects Nusrat's 33⅓% detour when the configured limit is 30%", () => {
    const result = calculateBestPoolRoute([nusrat, rafiq], "Banani", 30);

    expect(result.compatible).toBe(false);
    expect(result.riderDetours[0]).toMatchObject({
      rideId: "ride-nusrat",
      soloDistanceKm: 3,
      inVehicleDistanceKm: 4,
      detourKm: 1,
    });
  });

  it("pools a different-pickup pair when both riders stay on their solo distance", () => {
    const secondPassenger: PoolRouteRide = {
      rideId: "ride-gulshan-to-mohakhali",
      pickupZone: "Gulshan 1",
      destinationZone: "Mohakhali",
    };

    const result = calculateBestPoolRoute(
      [rafiq, secondPassenger],
      "Banani",
      35,
    );

    expect(result.compatible).toBe(true);
    expect(
      result.stops.map(({ kind, zone }) => kind + ":" + zone),
    ).toEqual([
      "PICKUP:Banani",
      "PICKUP:Gulshan 1",
      "DROPOFF:Gulshan 1",
      "DROPOFF:Mohakhali",
    ]);
    expect(result.riderDetours).toEqual([
      {
        rideId: "ride-gulshan-to-mohakhali",
        soloDistanceKm: 2,
        inVehicleDistanceKm: 2,
        detourKm: 0,
      },
      {
        rideId: "ride-rafiq",
        soloDistanceKm: 2,
        inVehicleDistanceKm: 2,
        detourKm: 0,
      },
    ]);
  });

  it("rejects a different-pickup route that adds excessive detour to the Banani rider", () => {
    const existingRide: PoolRouteRide = {
      rideId: "ride-banani-to-gulshan",
      pickupZone: "Banani",
      destinationZone: "Gulshan 1",
    };
    const newcomer: PoolRouteRide = {
      rideId: "ride-uttara-to-dhanmondi",
      pickupZone: "Uttara",
      destinationZone: "Dhanmondi",
    };

    const result = calculateBestPoolRoute(
      [existingRide, newcomer],
      "Banani",
      35,
    );

    expect(result.compatible).toBe(false);
    expect(result.riderDetours).toContainEqual({
      rideId: "ride-banani-to-gulshan",
      soloDistanceKm: 2,
      inVehicleDistanceKm: 24,
      detourKm: 22,
    });
  });

  it("rejects a route where opposing trips force a long backtrack after all pickups", () => {
    const firstRide: PoolRouteRide = {
      rideId: "ride-banani-to-dhanmondi",
      pickupZone: "Banani",
      destinationZone: "Dhanmondi",
    };
    const opposingRide: PoolRouteRide = {
      rideId: "ride-uttara-to-banani",
      pickupZone: "Uttara",
      destinationZone: "Banani",
    };

    const result = calculateBestPoolRoute(
      [firstRide, opposingRide],
      "Banani",
      35,
    );

    expect(result.compatible).toBe(false);
    expect(result.riderDetours).toContainEqual({
      rideId: "ride-banani-to-dhanmondi",
      soloDistanceKm: 6,
      inVehicleDistanceKm: 24,
      detourKm: 18,
    });
  });

  it("rejects a join when it pushes an existing member beyond the limit", () => {
    const existingShirin: PoolRouteRide = {
      rideId: "ride-existing-shirin",
      pickupZone: "Banani",
      destinationZone: "Gulshan 2",
    };
    const newcomer: PoolRouteRide = {
      rideId: "ride-newcomer",
      pickupZone: "Uttara",
      destinationZone: "Mohakhali",
    };

    expect(
      calculateBestPoolRoute([rafiq, existingShirin], "Banani", 35).compatible,
    ).toBe(true);

    const result = calculateBestPoolRoute(
      [rafiq, existingShirin, newcomer],
      "Banani",
      35,
    );

    expect(result.compatible).toBe(false);
    expect(
      result.riderDetours.find(({ rideId }) => rideId === rafiq.rideId)
        ?.detourKm,
    ).toBeGreaterThan(0);
    expect(
      result.riderDetours.find(({ rideId }) => rideId === rafiq.rideId)
        ?.soloDistanceKm,
    ).toBe(2);
  });

  it("uses the exact integer threshold without rounding a ratio", () => {
    expect(isDetourWithinLimit(1, 2, 50)).toBe(true);
    expect(isDetourWithinLimit(1, 2, 49)).toBe(false);
  });

  it("returns a deterministic best route independent of input order", () => {
    const thirdRide: PoolRouteRide = {
      rideId: "ride-third",
      pickupZone: "Banani",
      destinationZone: "Gulshan 2",
    };
    const forward = calculateBestPoolRoute(
      [nusrat, rafiq, thirdRide],
      "Banani",
      35,
    );
    const reversed = calculateBestPoolRoute(
      [thirdRide, rafiq, nusrat],
      "Banani",
      35,
    );

    expect(reversed).toEqual(forward);
  });

  it("defines a same-zone route leg and same-zone ride as zero distance", () => {
    expect(getRouteDistanceKm("Banani", "Banani")).toBe(0);

    const sameZoneRide: PoolRouteRide = {
      rideId: "ride-same-zone",
      pickupZone: "Banani",
      destinationZone: "Banani",
    };
    const result = calculateBestPoolRoute([sameZoneRide], "Banani", 35);

    expect(result.compatible).toBe(true);
    expect(result.riderDetours).toEqual([
      {
        rideId: "ride-same-zone",
        soloDistanceKm: 0,
        inVehicleDistanceKm: 0,
        detourKm: 0,
      },
    ]);
  });

  it("rejects a detour limit outside the supported integer range", () => {
    expect(() => calculateBestPoolRoute([nusrat], "Banani", 35.5)).toThrow(
      RangeError,
    );
    expect(() => calculateBestPoolRoute([nusrat], "Banani", 101)).toThrow(
      RangeError,
    );
  });
});
