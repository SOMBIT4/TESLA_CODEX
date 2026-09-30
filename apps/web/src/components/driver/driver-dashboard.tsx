"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CarFront } from "lucide-react";
import ActivePoolCard from "@/components/driver/active-pool-card";
import DriverAvailabilityCard from "@/components/driver/driver-availability-card";
import DriverHistory from "@/components/driver/driver-history";
import WaitingRequests from "@/components/driver/waiting-requests";
import WorkspaceHeading from "@/components/layout/workspace-heading";
import { Alert } from "@/components/ui/alert";
import { SkeletonBlock } from "@/components/ui/skeleton";
import { useDriverDashboard } from "@/hooks/use-driver-dashboard";
import { useI18n } from "@/lib/i18n/locale-context";

export default function DriverDashboard() {
  const router = useRouter();
  const { t } = useI18n();
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
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <p
          className="mb-6 text-sm font-medium text-muted-foreground"
          role="status"
        >
          {t("driver.loading")}
        </p>
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-5">
            <SkeletonBlock className="h-56 rounded-[1.375rem]" />
            <SkeletonBlock className="h-64 rounded-[1.375rem]" />
          </div>
          <SkeletonBlock className="h-[30rem] rounded-[1.375rem] lg:col-span-7" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <WorkspaceHeading
        icon={<CarFront aria-hidden="true" className="size-4" />}
        label={t("driver.workspace")}
        subtitle={t("driver.subtitle")}
        title={t("driver.title")}
      />

      {error ? <Alert className="mb-6">{error}</Alert> : null}

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-5">
          <DriverAvailabilityCard
            onToggleStatus={toggleStatus}
            pendingAction={pendingAction}
            snapshot={snapshot}
          />
          <WaitingRequests
            activePoolStatus={activePool?.status ?? null}
            isOnline={snapshot?.isOnline ?? false}
            onAcceptRide={acceptRide}
            pendingAction={pendingAction}
            rides={waitingRides}
          />
        </div>
        <div className="lg:sticky lg:top-24 lg:col-span-7">
          <ActivePoolCard
            onArrive={arrive}
            onDropOff={dropOffRide}
            onStart={start}
            pendingAction={pendingAction}
            pendingRideId={pendingRideId}
            pool={activePool}
          />
        </div>
      </div>

      <div className="mt-12 border-t pt-10">
        <DriverHistory history={history} />
      </div>
    </main>
  );
}
