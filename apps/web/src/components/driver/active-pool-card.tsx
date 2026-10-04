"use client";

import {
  ArrowRight,
  Check,
  LoaderCircle,
  MapPinCheck,
  UserRound,
} from "lucide-react";
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
import type { DriverActivePool } from "@/lib/api/types";
import type { DhakaArea } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";

interface ActivePoolCardProps {
  pool: DriverActivePool | null;
  pendingAction: DriverPendingAction | null;
  pendingRideId: string | null;
  pendingPickupZone: DhakaArea | null;
  onArrive: (pickupZone: DhakaArea) => Promise<void>;
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
  pendingPickupZone,
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
  const canArrive =
    pool.status === "MATCHED" || pool.status === "DRIVER_ARRIVED";
  const hasPickupsRemaining = pool.routeStops.some(
    (stop) => stop.kind === "PICKUP" && !stop.done,
  );
  const mapMarkers: ZoneMapMarker[] = pool.routeStops.map((stop) => ({
    id: `${stop.kind.toLowerCase()}:${stop.zone}`,
    zone: stop.zone,
    role: stop.kind === "PICKUP" ? "pickup" : "destination",
    done: stop.done,
    members: stop.members.map((member) => ({
      passengerName: member.passengerName,
      seats: member.seatsReserved,
    })),
  }));

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
          className="mt-6 min-h-[22rem]"
          mode="pool"
          markers={mapMarkers}
        />

        <section
          aria-label={t("driver.routePlan")}
          className="mt-6 rounded-2xl border bg-muted/35 p-4 sm:p-5"
        >
          <h3 className="font-semibold">{t("driver.routePlan")}</h3>
          <ol className="mt-3 space-y-2.5">
            {pool.routeStops.map((stop, index) => {
              const isPickup = stop.kind === "PICKUP";
              const stopKindLabel = t(
                isPickup ? "map.pickup" : "map.destination",
              );
              const isArrivingThisStop =
                pendingAction === "arrive" && pendingPickupZone === stop.zone;

              return (
                <li
                  aria-label={`${stopKindLabel} · ${stop.zone}`}
                  className="flex flex-wrap items-center gap-3 rounded-xl bg-card px-3.5 py-3"
                  data-route-stop={`${stop.kind}:${stop.zone}`}
                  key={`${stop.kind}:${stop.zone}`}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs font-semibold text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {stopKindLabel} · {stop.zone}
                    </p>
                    <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      {stop.members.map((member) => (
                        <li key={member.rideId}>
                          {member.passengerName} · {member.seatsReserved}{" "}
                          {member.seatsReserved === 1
                            ? t("common.seat")
                            : t("common.seats")}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {stop.done ? (
                    <Badge className="gap-1" variant="success">
                      <Check aria-hidden="true" className="size-3" />
                      {t("common.completed")}
                    </Badge>
                  ) : null}
                  {isPickup && canArrive && !stop.done ? (
                    <Button
                      aria-label={`${isArrivingThisStop ? t("driver.markingArrived") : t("driver.markArrived")} · ${stop.zone}`}
                      disabled={isPending}
                      onClick={() => void onArrive(stop.zone)}
                      size="sm"
                      variant="outline"
                    >
                      {isArrivingThisStop ? (
                        <LoaderCircle
                          aria-hidden="true"
                          className="size-3.5 animate-spin"
                        />
                      ) : (
                        <MapPinCheck aria-hidden="true" className="size-3.5" />
                      )}
                      {isArrivingThisStop
                        ? t("driver.markingArrived")
                        : t("driver.markArrived")}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>

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

        {pool.status === "DRIVER_ARRIVED" ? (
          <>
            {hasPickupsRemaining ? (
              <p className="mt-5 text-sm text-muted-foreground" role="status">
                {t("driver.pickupsRemain")}
              </p>
            ) : null}
            <Button
              className="group mt-4 w-full"
              disabled={isPending || hasPickupsRemaining}
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
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
