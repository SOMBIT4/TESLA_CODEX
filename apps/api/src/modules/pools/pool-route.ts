import {
  DHAKA_AREAS,
  getDistanceKm,
  type DhakaArea,
} from "../fares/fare-rules.js";

export interface PoolRouteRide {
  rideId: string;
  pickupZone: DhakaArea;
  destinationZone: DhakaArea;
}

export type PoolRouteStopKind = "PICKUP" | "DROPOFF";

export interface PlannedPoolRouteStop {
  kind: PoolRouteStopKind;
  zone: DhakaArea;
  rideIds: string[];
}

export interface PoolRiderDetour {
  rideId: string;
  soloDistanceKm: number;
  inVehicleDistanceKm: number;
  detourKm: number;
}

export interface PoolRouteEvaluation {
  compatible: boolean;
  stops: PlannedPoolRouteStop[];
  riderDetours: PoolRiderDetour[];
  totalRouteDistanceKm: number;
}

interface DetourRatio {
  numerator: number;
  denominator: number;
}

interface RouteCandidate {
  stops: PlannedPoolRouteStop[];
  riderDetours: PoolRiderDetour[];
  totalRouteDistanceKm: number;
  worstDetourRatio: DetourRatio;
}

const AREA_ORDER = new Map(
  DHAKA_AREAS.map((area, index) => [area, index] as const),
);

export function getRouteDistanceKm(
  from: DhakaArea,
  to: DhakaArea,
): number {
  return from === to ? 0 : getDistanceKm(from, to);
}

export function isDetourWithinLimit(
  detourKm: number,
  soloDistanceKm: number,
  maxDetourPercent: number,
): boolean {
  validateDetourLimit(maxDetourPercent);

  if (
    !Number.isInteger(detourKm) ||
    detourKm < 0 ||
    !Number.isInteger(soloDistanceKm) ||
    soloDistanceKm < 0
  ) {
    throw new RangeError("Route distances must be non-negative integers.");
  }

  return detourKm * 100 <= soloDistanceKm * maxDetourPercent;
}

export function calculateBestPoolRoute(
  rides: readonly PoolRouteRide[],
  startZone: DhakaArea,
  maxDetourPercent: number,
): PoolRouteEvaluation {
  validateDetourLimit(maxDetourPercent);

  if (rides.length === 0) {
    throw new RangeError("A pool route requires at least one ride.");
  }

  const pickupZones = uniqueZones(rides.map((ride) => ride.pickupZone));
  if (!pickupZones.includes(startZone)) {
    pickupZones.push(startZone);
  }
  pickupZones.sort(compareAreas);

  const dropoffZones = uniqueZones(
    rides.map((ride) => ride.destinationZone),
  ).sort(compareAreas);
  const remainingPickupZones = pickupZones.filter(
    (zone) => zone !== startZone,
  );

  const pickupOrders = permutations(remainingPickupZones).map((order) => [
    startZone,
    ...order,
  ]);
  const dropoffOrders = permutations(dropoffZones);

  let best: RouteCandidate | null = null;

  for (const pickupOrder of pickupOrders) {
    for (const dropoffOrder of dropoffOrders) {
      const stops = [
        ...pickupOrder.map((zone) => ({
          kind: "PICKUP" as const,
          zone,
          rideIds: rides
            .filter((ride) => ride.pickupZone === zone)
            .map((ride) => ride.rideId)
            .sort(),
        })),
        ...dropoffOrder.map((zone) => ({
          kind: "DROPOFF" as const,
          zone,
          rideIds: rides
            .filter((ride) => ride.destinationZone === zone)
            .map((ride) => ride.rideId)
            .sort(),
        })),
      ];
      const candidate = evaluateRoute(rides, startZone, stops);

      if (!best || compareCandidates(candidate, best) < 0) {
        best = candidate;
      }
    }
  }

  if (!best) {
    throw new Error("No pool route could be evaluated.");
  }

  return {
    compatible: best.riderDetours.every((rider) =>
      isDetourWithinLimit(
        rider.detourKm,
        rider.soloDistanceKm,
        maxDetourPercent,
      ),
    ),
    stops: best.stops,
    riderDetours: best.riderDetours,
    totalRouteDistanceKm: best.totalRouteDistanceKm,
  };
}

function evaluateRoute(
  rides: readonly PoolRouteRide[],
  startZone: DhakaArea,
  stops: PlannedPoolRouteStop[],
): RouteCandidate {
  const inVehicleDistance = new Map<string, number>();
  for (const ride of rides) {
    inVehicleDistance.set(ride.rideId, 0);
  }
  const riding = new Set<string>();
  let currentZone = startZone;
  let totalRouteDistanceKm = 0;

  for (const stop of stops) {
    const legDistanceKm = getRouteDistanceKm(currentZone, stop.zone);
    totalRouteDistanceKm += legDistanceKm;

    for (const rideId of riding) {
      inVehicleDistance.set(
        rideId,
        (inVehicleDistance.get(rideId) ?? 0) + legDistanceKm,
      );
    }

    if (stop.kind === "PICKUP") {
      for (const rideId of stop.rideIds) {
        riding.add(rideId);
      }
    } else {
      for (const rideId of stop.rideIds) {
        riding.delete(rideId);
      }
    }

    currentZone = stop.zone;
  }

  const riderDetours = rides
    .map((ride) => {
      const soloDistanceKm = getRouteDistanceKm(
        ride.pickupZone,
        ride.destinationZone,
      );
      const routeDistanceKm = inVehicleDistance.get(ride.rideId) ?? 0;
      const detourKm = Math.max(0, routeDistanceKm - soloDistanceKm);

      return {
        rideId: ride.rideId,
        soloDistanceKm,
        inVehicleDistanceKm: routeDistanceKm,
        detourKm,
      };
    })
    .sort((first, second) => first.rideId.localeCompare(second.rideId));

  return {
    stops,
    riderDetours,
    totalRouteDistanceKm,
    worstDetourRatio: riderDetours.reduce<DetourRatio>(
      (worst, rider) =>
        compareRatios(
          { numerator: rider.detourKm, denominator: rider.soloDistanceKm },
          worst,
        ) > 0
          ? { numerator: rider.detourKm, denominator: rider.soloDistanceKm }
          : worst,
      { numerator: 0, denominator: 1 },
    ),
  };
}

function compareCandidates(
  first: RouteCandidate,
  second: RouteCandidate,
): number {
  const ratioComparison = compareRatios(
    first.worstDetourRatio,
    second.worstDetourRatio,
  );
  if (ratioComparison !== 0) {
    return ratioComparison;
  }

  if (first.totalRouteDistanceKm !== second.totalRouteDistanceKm) {
    return first.totalRouteDistanceKm - second.totalRouteDistanceKm;
  }

  const pickupComparison = compareStopSequences(
    first.stops.filter((stop) => stop.kind === "PICKUP"),
    second.stops.filter((stop) => stop.kind === "PICKUP"),
  );
  return pickupComparison !== 0
    ? pickupComparison
    : compareStopSequences(
        first.stops.filter((stop) => stop.kind === "DROPOFF"),
        second.stops.filter((stop) => stop.kind === "DROPOFF"),
      );
}

function compareRatios(first: DetourRatio, second: DetourRatio): number {
  const firstInfinite = first.denominator === 0 && first.numerator > 0;
  const secondInfinite = second.denominator === 0 && second.numerator > 0;
  const firstZero = first.numerator === 0;
  const secondZero = second.numerator === 0;

  if (firstInfinite !== secondInfinite) {
    return firstInfinite ? 1 : -1;
  }
  if (firstInfinite && secondInfinite) {
    return 0;
  }
  if (firstZero !== secondZero) {
    return firstZero ? -1 : 1;
  }

  return (
    first.numerator * second.denominator -
    second.numerator * first.denominator
  );
}

function compareStopSequences(
  first: readonly PlannedPoolRouteStop[],
  second: readonly PlannedPoolRouteStop[],
): number {
  for (let index = 0; index < first.length; index += 1) {
    const firstOrder = AREA_ORDER.get(first[index]!.zone) ?? 0;
    const secondOrder = AREA_ORDER.get(second[index]!.zone) ?? 0;
    if (firstOrder !== secondOrder) {
      return firstOrder - secondOrder;
    }
  }
  return 0;
}

function uniqueZones(zones: readonly DhakaArea[]): DhakaArea[] {
  return [...new Set(zones)].sort(compareAreas);
}

function compareAreas(first: DhakaArea, second: DhakaArea): number {
  return (AREA_ORDER.get(first) ?? 0) - (AREA_ORDER.get(second) ?? 0);
}

function permutations<T>(values: readonly T[]): T[][] {
  if (values.length <= 1) {
    return [[...values]];
  }

  return values.flatMap((value, index) => {
    const remaining = [
      ...values.slice(0, index),
      ...values.slice(index + 1),
    ];
    return permutations(remaining).map((tail) => [value, ...tail]);
  });
}

function validateDetourLimit(maxDetourPercent: number): void {
  if (
    !Number.isInteger(maxDetourPercent) ||
    maxDetourPercent < 0 ||
    maxDetourPercent > 100
  ) {
    throw new RangeError(
      "POOL_MAX_DETOUR_PERCENT must be an integer from 0 through 100.",
    );
  }
}
