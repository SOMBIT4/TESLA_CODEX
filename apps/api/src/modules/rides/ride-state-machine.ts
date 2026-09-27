import type { RideStatus } from "./ride.types.js";

export const VALID_RIDE_TRANSITIONS: Readonly<
  Record<RideStatus, readonly RideStatus[]>
> = {
  REQUESTED: ["MATCHED", "CANCELLED"],
  MATCHED: ["DRIVER_ARRIVED"],
  DRIVER_ARRIVED: ["STARTED"],
  STARTED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionRide(from: RideStatus, to: RideStatus): boolean {
  return VALID_RIDE_TRANSITIONS[from].includes(to);
}
