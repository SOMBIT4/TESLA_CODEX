import { apiRequest } from "./client";
import type {
  DriverActivePool,
  DriverSnapshot,
  PoolAcceptance,
  PoolDropOffTransition,
  PoolLifecycleAction,
  PoolLifecycleTransition,
  WaitingRide,
} from "./types";

export function getDriverSnapshot(): Promise<DriverSnapshot> {
  return apiRequest<DriverSnapshot>("/driver/me");
}

export function setDriverOnlineStatus(
  isOnline: boolean,
): Promise<DriverSnapshot> {
  return apiRequest<DriverSnapshot>("/driver/status", {
    method: "POST",
    body: { isOnline },
  });
}

export async function listWaitingRides(): Promise<WaitingRide[]> {
  const result = await apiRequest<{ rides: WaitingRide[] }>("/driver/requests");

  return result.rides;
}

export function getActivePool(): Promise<DriverActivePool | null> {
  return apiRequest<DriverActivePool | null>("/driver/pools/active");
}

export function acceptRide(rideId: string): Promise<PoolAcceptance> {
  return apiRequest<PoolAcceptance>(`/driver/requests/${rideId}/accept`, {
    method: "POST",
  });
}

export function transitionPool(
  poolId: string,
  action: PoolLifecycleAction,
): Promise<PoolLifecycleTransition> {
  return apiRequest<PoolLifecycleTransition>(
    `/driver/pools/${poolId}/${action}`,
    {
      method: "POST",
    },
  );
}

export function dropOffRide(
  poolId: string,
  rideId: string,
): Promise<PoolDropOffTransition> {
  return apiRequest<PoolDropOffTransition>(
    `/driver/pools/${poolId}/rides/${rideId}/drop-off`,
    { method: "POST" },
  );
}
