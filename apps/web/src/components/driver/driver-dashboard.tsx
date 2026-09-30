"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ActivePoolCard from "@/components/driver/active-pool-card";
import DriverAvailabilityCard from "@/components/driver/driver-availability-card";
import DriverHistory from "@/components/driver/driver-history";
import WaitingRequests from "@/components/driver/waiting-requests";
import { Alert } from "@/components/ui/alert";
import { useDriverDashboard } from "@/hooks/use-driver-dashboard";

export default function DriverDashboard() {
  const router = useRouter();
  const {
    snapshot,
    waitingRides,
    activePool,
    history,
    isLoading,
    error,
    isUnauthenticated,
    pendingAction,
    pendingRideId,
    toggleStatus,
    acceptRide,
    arrive,
    start,
    dropOffRide,
  } = useDriverDashboard();

  useEffect(() => {
    if (isUnauthenticated) {
      router.replace("/login");
    }
  }, [isUnauthenticated, router]);

  if (isUnauthenticated) {
    return null;
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p role="status">Loading driver workspace…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <div className="mb-8 max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">
          Driver workspace
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Keep Bullet moving, one pool at a time.
        </h1>
        <p className="mt-3 text-muted-foreground">
          Set your availability, accept compatible requests, and manage the
          active pool from here.
        </p>
      </div>

      {error ? <Alert className="mb-5">{error}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <DriverAvailabilityCard
          onToggleStatus={toggleStatus}
          pendingAction={pendingAction}
          snapshot={snapshot}
        />
        <ActivePoolCard
          onArrive={arrive}
          onDropOff={dropOffRide}
          onStart={start}
          pendingAction={pendingAction}
          pendingRideId={pendingRideId}
          pool={activePool}
        />
      </div>

      <div className="mt-6">
        <WaitingRequests
          activePoolStatus={activePool?.status ?? null}
          isOnline={snapshot?.isOnline ?? false}
          onAcceptRide={acceptRide}
          pendingAction={pendingAction}
          rides={waitingRides}
        />
      </div>

      <div className="mt-10">
        <DriverHistory history={history} />
      </div>
    </main>
  );
}
