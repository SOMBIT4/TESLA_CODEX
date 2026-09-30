"use client";

import { useState } from "react";
import { LoaderCircle, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kicker } from "@/components/ui/card";
import { StatusTracker } from "@/components/ui/status-tracker";
import { ApiError } from "@/lib/api/client";
import { zoneColor } from "@/lib/constants/zone-colors";
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

const statusHintKeys: Partial<Record<Ride["status"], MessageKey>> = {
  REQUESTED: "passenger.hintRequested",
  MATCHED: "passenger.hintMatched",
  DRIVER_ARRIVED: "passenger.hintDriverArrived",
  STARTED: "passenger.hintStarted",
};

const PROGRESS_STATUSES: Ride["status"][] = [
  "REQUESTED",
  "MATCHED",
  "DRIVER_ARRIVED",
  "STARTED",
];

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
  const hintKey = statusHintKeys[ride.status];

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
      className="animate-rise overflow-hidden rounded-[1.375rem] border border-border/80 bg-card shadow-card"
      style={{ animationDelay: "140ms" }}
    >
      <div
        aria-hidden="true"
        className="h-1.5"
        style={{
          backgroundImage: `linear-gradient(90deg, ${zoneColor(
            ride.pickupZone,
          )}, ${zoneColor(ride.destinationZone)})`,
        }}
      />

      <div className="p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Kicker>{t("passenger.currentRide")}</Kicker>
            <h2
              className="mt-1 text-2xl font-extrabold tracking-[-0.03em]"
              id="current-ride-title"
            >
              {ride.pickupZone} {t("common.to")} {ride.destinationZone}
            </h2>
          </div>
          <Badge live variant={statusVariant(ride.status)}>
            {t(statusMessageKeys[ride.status])}
          </Badge>
        </div>

        {hintKey ? (
          <p
            className="mt-3 animate-fade text-[0.95rem] text-muted-foreground"
            key={ride.status}
          >
            {t(hintKey)}
          </p>
        ) : null}

        <StatusTracker
          className="mt-7"
          current={PROGRESS_STATUSES.indexOf(ride.status)}
          label={t("passenger.progress")}
          steps={PROGRESS_STATUSES.map((status) =>
            t(statusMessageKeys[status]),
          )}
        />

        <dl className="mt-7 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-muted/70 px-4 py-3">
            <dt className="text-xs text-muted-foreground">
              {t("auth.vehicleSeats")}
            </dt>
            <dd className="mt-1 font-mono text-lg font-semibold">
              {ride.seatsRequested}
            </dd>
          </div>
          <div className="rounded-2xl bg-muted/70 px-4 py-3">
            <dt className="text-xs text-muted-foreground">
              {t("fare.estimatedSolo")}
            </dt>
            <dd className="mt-1 font-mono text-lg font-semibold">
              {formatPoysha(ride.estimatedFarePoysha)}
            </dd>
          </div>
        </dl>

        {ride.status === "REQUESTED" ? (
          <Button
            className="mt-6 w-full hover:border-destructive/40 hover:bg-destructive/[0.06] hover:text-destructive sm:w-auto"
            disabled={isCancelling}
            onClick={cancelRide}
            variant="outline"
          >
            {isCancelling ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
            ) : (
              <X aria-hidden="true" className="size-4" />
            )}
            {isCancelling
              ? t("passenger.cancelling")
              : t("passenger.cancelRide")}
          </Button>
        ) : null}
        {error ? <Alert className="mt-3">{error}</Alert> : null}
      </div>
    </section>
  );
}
