import type { DhakaArea } from "../fares/fare-rules.js";
import type { RideStatus } from "../rides/ride.types.js";

export const POOL_STATUSES = [
  "MATCHED",
  "DRIVER_ARRIVED",
  "STARTED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type PoolStatus = (typeof POOL_STATUSES)[number];

export interface PoolSummary {
  id: string;
  status: PoolStatus;
  pickupZone: DhakaArea;
  capacity: number;
  occupiedSeats: number;
  availableSeats: number;
}

export interface PoolMembershipSummary {
  id: string;
  rideRequestId: string;
  seatsReserved: number;
  farePoysha: number;
  status: "ACTIVE";
}

export interface PoolAcceptance {
  pool: PoolSummary;
  membership: PoolMembershipSummary;
}

export interface PoolRideForFare {
  id: string;
  status: RideStatus;
  pickupZone: DhakaArea;
  destinationZone: DhakaArea;
  seatsRequested: number;
}

export interface AcceptRideInput {
  driverUserId: string;
  rideId: string;
  poolId: string;
  membershipId: string;
  statusEventId: string;
}

export type PoolAcceptanceOutcome =
  | { kind: "accepted"; acceptance: PoolAcceptance }
  | { kind: "driver_profile_missing" }
  | { kind: "driver_offline" }
  | { kind: "no_active_vehicle" }
  | { kind: "ride_not_found" }
  | { kind: "ride_not_requested" }
  | { kind: "ride_not_compatible" }
  | { kind: "pool_full" };
