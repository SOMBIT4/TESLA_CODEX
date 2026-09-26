import type { DhakaArea } from "../fares/fare-rules.js";

export const RIDE_STATUSES = [
  "REQUESTED",
  "MATCHED",
  "DRIVER_ARRIVED",
  "STARTED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type RideStatus = (typeof RIDE_STATUSES)[number];

export interface RideRecord {
  id: string;
  passengerId: string;
  pickupZone: DhakaArea;
  destinationZone: DhakaArea;
  seatsRequested: number;
  status: RideStatus;
  estimatedFarePoysha: number;
  createdAt: Date | string;
  cancelledAt: Date | string | null;
}

export interface CreateRideRecordInput {
  id: string;
  passengerId: string;
  pickupZone: DhakaArea;
  destinationZone: DhakaArea;
  seatsRequested: number;
  estimatedFarePoysha: number;
}

export interface CancelRequestedRideInput {
  rideId: string;
  passengerId: string;
  statusEventId: string;
}
