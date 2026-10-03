export const USER_ROLES = ["PASSENGER", "DRIVER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phoneNumber: string | null;
  createdAt: string;
}

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

export const RIDE_STATUSES = [
  "REQUESTED",
  "MATCHED",
  "DRIVER_ARRIVED",
  "STARTED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type RideStatus = (typeof RIDE_STATUSES)[number];

export interface Ride {
  id: string;
  status: RideStatus;
  pickupZone: DhakaArea;
  destinationZone: DhakaArea;
  seatsRequested: number;
  estimatedFarePoysha: number;
  createdAt: string;
  cancelledAt: string | null;
  completedAt: string | null;
}

export interface CreateRideInput {
  pickupZone: DhakaArea;
  destinationZone: DhakaArea;
  seats: number;
}

export interface FareEstimate {
  estimatedFarePoysha: number;
  estimatedFareDisplay: string;
}

export interface DriverVehicle {
  id: string;
  name: string;
  capacity: number;
  isActive: boolean;
}

export interface DriverSnapshot {
  isOnline: boolean;
  vehicle: DriverVehicle | null;
}

export interface WaitingRide {
  id: string;
  pickupZone: DhakaArea;
  destinationZone: DhakaArea;
  seatsRequested: number;
  estimatedFarePoysha: number;
  createdAt: string;
}

export type ActivePoolStatus = "MATCHED" | "DRIVER_ARRIVED" | "STARTED";

export interface DriverActivePoolMember {
  rideId: string;
  passengerName: string;
  pickupZone: DhakaArea;
  destinationZone: DhakaArea;
  seatsReserved: number;
  farePoysha: number;
}

export interface DriverActivePool {
  id: string;
  status: ActivePoolStatus;
  pickupZone: DhakaArea;
  vehicle: Pick<DriverVehicle, "name" | "capacity">;
  occupiedSeats: number;
  members: DriverActivePoolMember[];
}

export interface DriverHistoryMember {
  passengerName: string;
  pickupZone: DhakaArea;
  destinationZone: DhakaArea;
  seatsReserved: number;
  farePoysha: number;
  completedAt: string;
}

export interface DriverHistoryPool {
  id: string;
  pickupZone: DhakaArea;
  vehicle: Pick<DriverVehicle, "name" | "capacity">;
  startedAt: string | null;
  completedAt: string;
  members: DriverHistoryMember[];
}

export interface PoolSummary {
  id: string;
  status: ActivePoolStatus;
  pickupZone: DhakaArea;
  capacity: number;
  occupiedSeats: number;
  availableSeats: number;
}

export interface PoolAcceptance {
  pool: PoolSummary;
  membership: {
    id: string;
    rideRequestId: string;
    seatsReserved: number;
    farePoysha: number;
    status: "ACTIVE";
  };
}

export type PoolLifecycleAction = "arrive" | "start";

export interface PoolLifecycleTransition {
  pool: PoolSummary & {
    startedAt: string | null;
    completedAt: string | null;
  };
  transitionedRideIds: string[];
}

export interface PoolDropOffTransition {
  pool: Omit<PoolSummary, "status"> & {
    status: ActivePoolStatus | "COMPLETED";
    startedAt: string | null;
    completedAt: string | null;
  };
  droppedOffRideId: string;
  completedAt: string;
}

export function isTerminalRideStatus(status: RideStatus): boolean {
  return status === "COMPLETED" || status === "CANCELLED";
}
