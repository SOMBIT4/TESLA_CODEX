"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import CurrentRideCard from "@/components/passenger/current-ride-card";
import RideHistory from "@/components/passenger/ride-history";
import RideRequestForm from "@/components/passenger/ride-request-form";
import { Alert } from "@/components/ui/alert";
import { usePassengerRides } from "@/hooks/use-passenger-rides";
import { isTerminalRideStatus } from "@/lib/api/types";

export default function PassengerDashboard() {
  const router = useRouter();
  const {
    rides,
    currentRide,
    isLoading,
    error,
    isUnauthenticated,
    createRide,
    cancelRide,
  } = usePassengerRides();

  useEffect(() => {
    if (isUnauthenticated) {
      router.replace("/login");
    }
  }, [isUnauthenticated, router]);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p role="status">Loading your rides…</p>
      </main>
    );
  }

  const historyRides = rides.filter((ride) =>
    isTerminalRideStatus(ride.status),
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <div className="mb-8 max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">
          Passenger workspace
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Your next shared ride, clearly priced.
        </h1>
        <p className="mt-3 text-muted-foreground">
          Request a Bullet ride and follow its live status here.
        </p>
      </div>

      {error ? <Alert className="mb-5">{error}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <RideRequestForm activeRide={currentRide} onCreateRide={createRide} />
        {currentRide ? (
          <CurrentRideCard onCancel={cancelRide} ride={currentRide} />
        ) : null}
      </div>

      <div className="mt-8">
        <RideHistory rides={historyRides} />
      </div>
    </main>
  );
}
