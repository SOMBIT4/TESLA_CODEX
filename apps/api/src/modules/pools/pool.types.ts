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

export interface PoolLifecycleSummary extends PoolSummary {
  startedAt: Date | string | null;
  completedAt: Date | string | null;
}

export interface PoolLifecycleTransition {
  pool: PoolLifecycleSummary;
  transitionedRideIds: string[];
}

export interface ActivePoolMember {
  rideId: string;
  passengerName: string;
  pickupZone: DhakaArea;
  destinationZone: DhakaArea;
  seatsReserved: number;
  farePoysha: number;
}

export interface DriverActivePool {
  id: string;
  status: Extract<PoolStatus, "MATCHED" | "DRIVER_ARRIVED" | "STARTED">;
  pickupZone: DhakaArea;
  vehicle: {
    name: string;
    capacity: number;
  };
  occupiedSeats: number;
  members: ActivePoolMember[];
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

export interface TransitionPoolInput {
  driverUserId: string;
  poolId: string;
  expectedStatus: PoolStatus;
  targetStatus: PoolStatus;
}

export type PoolAcceptanceOutcome =
  | { kind: "accepted"; acceptance: PoolAcceptance }
  | { kind: "driver_profile_missing" }
  | { kind: "driver_offline" }
  | { kind: "no_active_vehicle" }
  | { kind: "ride_not_found" }
  | { kind: "ride_not_requested" }
  | { kind: "ride_not_compatible" }
  | { kind: "pool_not_accepting" }
  | { kind: "pool_full" };

export type PoolLifecycleOutcome =
  | { kind: "transitioned"; transition: PoolLifecycleTransition }
  | { kind: "driver_profile_missing" }
  | { kind: "pool_not_found" }
  | { kind: "invalid_pool_transition" }
  | { kind: "pool_ride_state_mismatch" };

export type ActivePoolOutcome =
  | { kind: "active_pool"; activePool: DriverActivePool }
  | { kind: "no_active_pool" }
  | { kind: "driver_profile_missing" };
