export const DHAKA_AREAS = [
  "Banani",
  "Gulshan 1",
  "Gulshan 2",
  "Mohakhali",
  "Dhanmondi",
  "Mirpur",
  "Uttara",
  "Farmgate",
  "Bashundhara",
] as const;

export type DhakaArea = (typeof DHAKA_AREAS)[number];

export const BASE_FARE_POYSHA = 5000;
export const DISTANCE_RATE_POYSHA_PER_KM = 1200;
export const POOL_DISCOUNT_POYSHA = 1500;
export const MIN_RIDE_SEATS = 1;
export const MAX_RIDE_SEATS = 3;

type DistanceDefinition = readonly [DhakaArea, DhakaArea, number];

// Each unordered area pair is declared once. The map below mirrors every
// definition so callers get the same distance in either direction.
const DISTANCE_DEFINITIONS: readonly DistanceDefinition[] = [
  ["Banani", "Gulshan 1", 2],
  ["Banani", "Gulshan 2", 3],
  ["Banani", "Mohakhali", 3],
  ["Banani", "Dhanmondi", 6],
  ["Banani", "Mirpur", 10],
  ["Banani", "Uttara", 12],
  ["Banani", "Farmgate", 5],
  ["Banani", "Bashundhara", 8],
  ["Gulshan 1", "Gulshan 2", 2],
  ["Gulshan 1", "Mohakhali", 2],
  ["Gulshan 1", "Dhanmondi", 6],
  ["Gulshan 1", "Mirpur", 10],
  ["Gulshan 1", "Uttara", 12],
  ["Gulshan 1", "Farmgate", 5],
  ["Gulshan 1", "Bashundhara", 7],
  ["Gulshan 2", "Mohakhali", 3],
  ["Gulshan 2", "Dhanmondi", 7],
  ["Gulshan 2", "Mirpur", 11],
  ["Gulshan 2", "Uttara", 13],
  ["Gulshan 2", "Farmgate", 6],
  ["Gulshan 2", "Bashundhara", 6],
  ["Mohakhali", "Dhanmondi", 5],
  ["Mohakhali", "Mirpur", 8],
  ["Mohakhali", "Uttara", 10],
  ["Mohakhali", "Farmgate", 4],
  ["Mohakhali", "Bashundhara", 8],
  ["Dhanmondi", "Mirpur", 7],
  ["Dhanmondi", "Uttara", 12],
  ["Dhanmondi", "Farmgate", 4],
  ["Dhanmondi", "Bashundhara", 10],
  ["Mirpur", "Uttara", 8],
  ["Mirpur", "Farmgate", 7],
  ["Mirpur", "Bashundhara", 14],
  ["Uttara", "Farmgate", 9],
  ["Uttara", "Bashundhara", 9],
  ["Farmgate", "Bashundhara", 9],
];

const areaPairKey = (first: DhakaArea, second: DhakaArea): string =>
  [first, second].sort().join("::");

const DISTANCES_KM = new Map<string, number>();

for (const [first, second, distanceKm] of DISTANCE_DEFINITIONS) {
  DISTANCES_KM.set(areaPairKey(first, second), distanceKm);
}

export const getDistanceKm = (
  pickup: DhakaArea,
  destination: DhakaArea,
): number => {
  if (pickup === destination) {
    throw new RangeError("Pickup and destination must be different areas.");
  }

  const distanceKm = DISTANCES_KM.get(areaPairKey(pickup, destination));

  if (distanceKm === undefined) {
    throw new RangeError(
      `No distance is configured for ${pickup} and ${destination}.`,
    );
  }

  return distanceKm;
};

export const calculateFare = (
  pickup: DhakaArea,
  destination: DhakaArea,
  seats: number,
  pooled: boolean,
): number => {
  if (
    !Number.isInteger(seats) ||
    seats < MIN_RIDE_SEATS ||
    seats > MAX_RIDE_SEATS
  ) {
    throw new RangeError("Seats must be an integer between 1 and 3.");
  }

  const distanceChargePoysha =
    getDistanceKm(pickup, destination) * DISTANCE_RATE_POYSHA_PER_KM;
  const pooledDiscountPoysha = pooled ? POOL_DISCOUNT_POYSHA : 0;
  const farePerSeatPoysha =
    BASE_FARE_POYSHA + distanceChargePoysha - pooledDiscountPoysha;

  return farePerSeatPoysha * seats;
};
