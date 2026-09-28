export const USER_ROLES = ["PASSENGER", "DRIVER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
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

export function isTerminalRideStatus(status: RideStatus): boolean {
  return status === "COMPLETED" || status === "CANCELLED";
}
