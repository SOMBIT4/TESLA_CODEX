"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { formatPoysha } from "@/lib/format/money";
import type { Ride } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/locale-context";
import type { MessageKey } from "@/lib/i18n/messages";

interface CurrentRideCardProps {
  ride: Ride;
  onCancel: (rideId: string) => Promise<unknown>;
}

const statusMessageKeys: Record<Ride["status"], MessageKey> = {
    REQUESTED: "status.requested",
    MATCHED: "status.matched",
    DRIVER_ARRIVED: "status.driverArrived",
    STARTED: "status.started",
    COMPLETED: "status.completed",
    CANCELLED: "status.cancelled",
};

function statusMessageKey(status: Ride["status"]): MessageKey {
  return statusMessageKeys[status];
}

function statusVariant(status: Ride["status"]) {
  if (status === "REQUESTED") {
    return "warning" as const;
  }

  if (status === "STARTED") {
    return "success" as const;
  }

  return "default" as const;
}

export default function CurrentRideCard({
  ride,
  onCancel,
}: CurrentRideCardProps) {
  const { t } = useI18n();
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelRide = async () => {
    setError(null);
    setIsCancelling(true);

    try {
      await onCancel(ride.id);
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError
          ? caughtError.message
          : t("passenger.cancelError"),
      );
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <section
      aria-labelledby="current-ride-title"
      className="rounded-xl border bg-card p-6 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {t("passenger.currentRide")}
          </p>
          <h2
            className="text-2xl font-semibold tracking-tight"
            id="current-ride-title"
          >
            {ride.pickupZone} {t("common.to")} {ride.destinationZone}
          </h2>
        </div>
        <Badge variant={statusVariant(ride.status)}>
          {t(statusMessageKey(ride.status))}
        </Badge>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-muted-foreground">{t("auth.vehicleSeats")}</dt>
          <dd className="mt-1 font-medium">{ride.seatsRequested}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            {t("fare.estimatedSolo")}
          </dt>
          <dd className="mt-1 font-medium">
            {formatPoysha(ride.estimatedFarePoysha)}
          </dd>
        </div>
      </dl>

      {ride.status === "REQUESTED" ? (
        <Button
          className="mt-6"
          disabled={isCancelling}
          onClick={cancelRide}
          variant="outline"
        >
          {isCancelling
            ? t("passenger.cancelling")
            : t("passenger.cancelRide")}
        </Button>
      ) : null}
      {error ? <Alert className="mt-3">{error}</Alert> : null}
    </section>
  );
}
