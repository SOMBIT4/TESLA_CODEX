"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserRound } from "lucide-react";
import WorkspaceHeading from "@/components/layout/workspace-heading";
import CurrentRideCard from "@/components/passenger/current-ride-card";
import RideHistory from "@/components/passenger/ride-history";
import RideRequestForm from "@/components/passenger/ride-request-form";
import { Alert } from "@/components/ui/alert";
import { SkeletonBlock } from "@/components/ui/skeleton";
import { usePassengerRides } from "@/hooks/use-passenger-rides";
import { useI18n } from "@/lib/i18n/locale-context";
import { isTerminalRideStatus } from "@/lib/api/types";

export default function PassengerDashboard() {
  const router = useRouter();
  const { t } = useI18n();
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
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <p
          className="mb-6 text-sm font-medium text-muted-foreground"
          role="status"
        >
          {t("status.loadingRides")}
        </p>
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <SkeletonBlock className="h-[30rem] rounded-[1.375rem]" />
          <SkeletonBlock className="h-72 rounded-[1.375rem]" />
        </div>
      </main>
    );
  }

  const historyRides = rides.filter((ride) =>
    isTerminalRideStatus(ride.status),
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <WorkspaceHeading
        icon={<UserRound aria-hidden="true" className="size-4" />}
        label={t("passenger.workspace")}
        subtitle={t("passenger.subtitle")}
        title={t("passenger.title")}
      />

      {error ? <Alert className="mb-6">{error}</Alert> : null}

      <div className="grid items-start gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <RideRequestForm activeRide={currentRide} onCreateRide={createRide} />
        {currentRide ? (
          <CurrentRideCard onCancel={cancelRide} ride={currentRide} />
        ) : (
          <NoActiveRide />
        )}
      </div>

      <div className="mt-8">
        <RideHistory rides={historyRides} />
      </div>
    </main>
  );
}

function NoActiveRide() {
  const { t } = useI18n();

  return (
    <section
      className="paper-texture relative hidden animate-rise overflow-hidden rounded-[1.375rem] border border-dashed border-input p-7 lg:block"
      style={{ animationDelay: "140ms" }}
    >
      <svg
        aria-hidden="true"
        className="h-28 w-full"
        fill="none"
        preserveAspectRatio="xMidYMid meet"
        viewBox="0 0 320 110"
      >
        <path
          className="animate-dash stroke-ink/30"
          d="M24 86 C 90 86, 96 24, 160 24 S 236 86, 296 86"
          strokeDasharray="3 11"
          strokeLinecap="round"
          strokeWidth="3"
        />
        <circle
          cx="24"
          cy="86"
          className="fill-card stroke-ink/35"
          r="9"
          strokeWidth="3"
        />
        <circle
          cx="296"
          cy="86"
          className="fill-card stroke-ink/35"
          r="9"
          strokeWidth="3"
        />
      </svg>
      <h2 className="mt-4 text-lg font-bold tracking-[-0.02em]">
        {t("passenger.noActiveRide")}
      </h2>
      <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">
        {t("passenger.noActiveRideHint")}
      </p>
    </section>
  );
}
