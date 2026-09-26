import type { DhakaArea } from "../fares/fare-rules.js";

export interface DriverVehicle {
  id: string;
  name: string;
  capacity: number;
  isActive: boolean;
}

export interface DriverSnapshot {
  driverId: string;
  isOnline: boolean;
  updatedAt: Date | string;
  vehicle: DriverVehicle | null;
}

export interface WaitingRide {
  id: string;
  pickupZone: DhakaArea;
  destinationZone: DhakaArea;
  seatsRequested: number;
  estimatedFarePoysha: number;
  createdAt: Date | string;
}
