"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DriverPendingAction } from "@/hooks/use-driver-dashboard";
import { formatTaka } from "@/lib/format/money";
import type { DriverActivePool } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/locale-context";

interface ActivePoolCardProps {
  pool: DriverActivePool | null;
  pendingAction: DriverPendingAction | null;
  pendingRideId: string | null;
  onArrive: () => Promise<void>;
  onStart: () => Promise<void>;
  onDropOff: (rideId: string) => Promise<void>;
}

const statusMessageKeys = {
  MATCHED: "status.matched",
  DRIVER_ARRIVED: "status.driverArrived",
  STARTED: "status.started",
} as const;

export default function ActivePoolCard({
  pool,
  pendingAction,
  pendingRideId,
  onArrive,
  onStart,
  onDropOff,
}: ActivePoolCardProps) {
  const { t } = useI18n();

  if (!pool) {
    return (
      <Card>
        <CardHeader>
          <p className="text-sm font-medium text-muted-foreground">
            {t("driver.activePool")}
          </p>
          <CardTitle className="mt-1 text-xl">
            {t("driver.noActivePool")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t("driver.noActivePoolHint")}
          </p>
        </CardContent>
      </Card>
    );
  }

  const availableSeats = pool.vehicle.capacity - pool.occupiedSeats;
  const isPending = pendingAction !== null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {t("driver.activePool")} · {pool.vehicle.name}
            </p>
            <CardTitle className="mt-1 text-xl">
              {pool.pickupZone} {t("driver.pool")}
            </CardTitle>
          </div>
          <Badge variant={pool.status === "STARTED" ? "success" : "default"}>
            {t(statusMessageKeys[pool.status])}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {availableSeats} {t("common.of")} {pool.vehicle.capacity}{" "}
          {t("common.seats")}{" "}
          {t("driver.availableSeats")}
        </p>

        <ul
          className="mt-5 space-y-3"
          aria-label={t("driver.activeMembers")}
        >
          {pool.members.map((member) => (
            <li className="rounded-lg border p-4" key={member.rideId}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{member.passengerName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {member.pickupZone} → {member.destinationZone}
                  </p>
                </div>
                <p className="font-medium">{formatTaka(member.farePoysha)}</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {member.seatsReserved}{" "}
                {member.seatsReserved === 1
                  ? t("common.seat")
                  : t("common.seats")}
              </p>
              {pool.status === "STARTED" ? (
                <Button
                  className="mt-4"
                  disabled={isPending}
                  onClick={() => void onDropOff(member.rideId)}
                  size="sm"
                  variant="outline"
                >
                  {pendingAction === "drop-off" &&
                  pendingRideId === member.rideId
                    ? t("driver.droppingOff")
                    : t("driver.dropOff")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>

        {pool.status === "MATCHED" ? (
          <Button
            className="mt-6"
            disabled={isPending}
            onClick={() => void onArrive()}
          >
            {pendingAction === "arrive"
              ? t("driver.markingArrived")
              : t("driver.markArrived")}
          </Button>
        ) : null}

        {pool.status === "DRIVER_ARRIVED" ? (
          <Button
            className="mt-6"
            disabled={isPending}
            onClick={() => void onStart()}
          >
            {pendingAction === "start"
              ? t("driver.startingTrip")
              : t("driver.startTrip")}
          </Button>
        ) : null}

      </CardContent>
    </Card>
  );
}
