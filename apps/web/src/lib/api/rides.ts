import { apiRequest } from "./client";
import type { CreateRideInput, FareEstimate, Ride } from "./types";

export function estimateRide(input: CreateRideInput): Promise<FareEstimate> {
  return apiRequest<FareEstimate>("/rides/estimate", {
    method: "POST",
    body: input,
  });
}

export function createRide(input: CreateRideInput): Promise<Ride> {
  return apiRequest<Ride>("/rides", { method: "POST", body: input });
}

export async function listMyRides(): Promise<Ride[]> {
  const result = await apiRequest<{ rides: Ride[] }>("/rides/me");

  return result.rides;
}

export function getRide(rideId: string): Promise<Ride> {
  return apiRequest<Ride>(`/rides/${rideId}`);
}

export function cancelRide(rideId: string): Promise<Ride> {
  return apiRequest<Ride>(`/rides/${rideId}/cancel`, { method: "POST" });
}
