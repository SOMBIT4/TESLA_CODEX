"use client";

import { ArrowRight, LoaderCircle, MapPinCheck, UserRound } from "lucide-react";
import ZoneMap, { type ZoneMapMarker } from "@/components/maps/zone-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Kicker,
} from "@/components/ui/card";
import { RouteRail } from "@/components/ui/route-rail";
import { StatusTracker } from "@/components/ui/status-tracker";
import type { DriverPendingAction } from "@/hooks/use-driver-dashboard";
import { zoneColor } from "@/lib/constants/zone-colors";
import { formatTaka } from "@/lib/format/money";
import { groupPoolDestinations } from "@/lib/maps/group-pool-destinations";
import type { DriverActivePool } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";

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

const POOL_STEPS = ["MATCHED", "DRIVER_ARRIVED", "STARTED"] as const;

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
      <Card
        className="paper-texture animate-rise border-dashed border-input shadow-none"
        style={{ animationDelay: "120ms" }}
      >
        <CardHeader>
          <Kicker>{t("driver.activePool")}</Kicker>
          <CardTitle className="mt-1 text-xl">
            {t("driver.noActivePool")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="max-w-sm text-sm text-muted-foreground">
            {t("driver.noActivePoolHint")}
          </p>
          <div aria-hidden="true" className="mt-8 flex items-center gap-2">
            {[0, 1, 2].map((seat) => (
              <span
                className="flex size-11 items-center justify-center rounded-2xl border-2 border-dashed border-input text-input"
                key={seat}
              >
                <UserRound className="size-4" />
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const availableSeats = pool.vehicle.capacity - pool.occupiedSeats;
  const isPending = pendingAction !== null;
  const mapMarkers: ZoneMapMarker[] = [
    {
      id: `pickup:${pool.pickupZone}`,
      zone: pool.pickupZone,
      role: "pickup",
    },
    ...groupPoolDestinations(pool.members).map((group) => ({
      id: `destination:${group.zone}`,
      zone: group.zone,
      role: "destination" as const,
      members: group.members.map((member) => ({
        passengerName: member.passengerName,
        seats: member.seatsReserved,
      })),
    })),
  ];

  return (
    <Card
      className="animate-rise overflow-hidden"
      style={{ animationDelay: "120ms" }}
    >
      <div
        aria-hidden="true"
        className="h-1.5"
        style={{ backgroundColor: zoneColor(pool.pickupZone) }}
      />
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Kicker>
              {t("driver.activePool")} · {pool.vehicle.name}
            </Kicker>
            <CardTitle className="mt-1 text-2xl">
              {pool.pickupZone} {t("driver.pool")}
            </CardTitle>
          </div>
          <Badge
            live
            variant={pool.status === "STARTED" ? "success" : "default"}
          >
            {t(statusMessageKeys[pool.status])}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <StatusTracker
          current={POOL_STEPS.indexOf(pool.status)}
          label={t("driver.progress")}
          steps={POOL_STEPS.map((status) => t(statusMessageKeys[status]))}
        />

        <ZoneMap
          className="mt-6 min-h-[18rem]"
          mode="pool"
          markers={mapMarkers}
        />

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/70 px-4 py-3">
          <span aria-hidden="true" className="flex gap-1.5">
            {Array.from({ length: pool.vehicle.capacity }, (_, seat) => (
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-lg transition-colors duration-500",
                  seat < pool.occupiedSeats
                    ? "bg-ink text-paper"
                    : "border-2 border-dashed border-input text-input",
                )}
                key={seat}
              >
                <UserRound className="size-3.5" strokeWidth={2.5} />
              </span>
            ))}
          </span>
          <p className="text-sm font-medium text-muted-foreground">
            {availableSeats} {t("common.of")} {pool.vehicle.capacity}{" "}
            {t("common.seats")} {t("driver.availableSeats")}
          </p>
        </div>

        <ul aria-label={t("driver.activeMembers")} className="mt-4 space-y-3">
          {pool.members.map((member, index) => (
            <li
              className="flex animate-rise gap-3.5 rounded-2xl border bg-card p-4 transition-shadow duration-300 hover:shadow-card"
              key={member.rideId}
              style={{ animationDelay: `${200 + index * 70}ms` }}
            >
              <RouteRail from={member.pickupZone} to={member.destinationZone} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{member.passengerName}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {member.pickupZone} → {member.destinationZone}
                    </p>
                  </div>
                  <p className="shrink-0 font-mono font-semibold">
                    {formatTaka(member.farePoysha)}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {member.seatsReserved}{" "}
                    {member.seatsReserved === 1
                      ? t("common.seat")
                      : t("common.seats")}
                  </span>
                  {pool.status === "STARTED" ? (
                    <Button
                      disabled={isPending}
                      onClick={() => void onDropOff(member.rideId)}
                      size="sm"
                      variant="outline"
                    >
                      {pendingAction === "drop-off" &&
                      pendingRideId === member.rideId ? (
                        <LoaderCircle
                          aria-hidden="true"
                          className="size-3.5 animate-spin"
                        />
                      ) : (
                        <MapPinCheck aria-hidden="true" className="size-3.5" />
                      )}
                      {pendingAction === "drop-off" &&
                      pendingRideId === member.rideId
                        ? t("driver.droppingOff")
                        : t("driver.dropOff")}
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>

        {pool.status === "MATCHED" ? (
          <Button
            className="group mt-6 w-full"
            disabled={isPending}
            onClick={() => void onArrive()}
            size="lg"
          >
            {pendingAction === "arrive" ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
            ) : null}
            {pendingAction === "arrive"
              ? t("driver.markingArrived")
              : t("driver.markArrived")}
          </Button>
        ) : null}

        {pool.status === "DRIVER_ARRIVED" ? (
          <Button
            className="group mt-6 w-full"
            disabled={isPending}
            onClick={() => void onStart()}
            size="lg"
            variant="ink"
          >
            {pendingAction === "start" ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
            ) : null}
            {pendingAction === "start"
              ? t("driver.startingTrip")
              : t("driver.startTrip")}
            {pendingAction === "start" ? null : (
              <ArrowRight
                aria-hidden="true"
                className="size-4 transition-transform duration-300 ease-out group-hover:translate-x-1"
              />
            )}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
