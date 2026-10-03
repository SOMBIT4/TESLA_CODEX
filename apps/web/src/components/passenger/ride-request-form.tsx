"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  ArrowDownUp,
  ArrowRight,
  LoaderCircle,
  Lock,
  UserRound,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Kicker } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { ZoneDot } from "@/components/ui/route-rail";
import ZoneMap, { type ZoneMapMarker } from "@/components/maps/zone-map";
import { DHAKA_AREAS } from "@/lib/constants/areas";
import { ApiError } from "@/lib/api/client";
import { estimateRide } from "@/lib/api/rides";
import { formatPoysha } from "@/lib/format/money";
import { useI18n } from "@/lib/i18n/locale-context";
import type { CreateRideInput, DhakaArea, Ride } from "@/lib/api/types";
import { cn } from "@/lib/utils";

interface RideRequestFormProps {
  activeRide: Ride | null;
  onCreateRide: (input: CreateRideInput) => Promise<unknown>;
}

// Mirrors MAX_RIDE_SEATS in the API fare rules.
const SEAT_OPTIONS = [1, 2, 3, 4] as const;

function getErrorMessage(caughtError: unknown, fallback: string) {
  return caughtError instanceof ApiError ? caughtError.message : fallback;
}

export default function RideRequestForm({
  activeRide,
  onCreateRide,
}: RideRequestFormProps) {
  const { t } = useI18n();
  const [pickupZone, setPickupZone] = useState<DhakaArea | "">("");
  const [destinationZone, setDestinationZone] = useState<DhakaArea | "">("");
  const [mapSelectionTarget, setMapSelectionTarget] = useState<
    "pickup" | "destination"
  >("pickup");
  const [seats, setSeats] = useState(1);
  const [estimatedFarePoysha, setEstimatedFarePoysha] = useState<number | null>(
    null,
  );
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const estimateSequenceRef = useRef(0);
  const isLocked = activeRide !== null;
  const isDisabled = isLocked || isSubmitting;
  const hasValidRoute =
    pickupZone !== "" &&
    destinationZone !== "" &&
    pickupZone !== destinationZone;
  const mapMarkers: ZoneMapMarker[] = DHAKA_AREAS.map((zone) => {
    const role =
      pickupZone === zone
        ? "pickup"
        : destinationZone === zone
          ? "destination"
          : "zone";

    return {
      id: `zone:${zone}`,
      zone,
      role,
    };
  });

  const handleMapZoneSelect = (zone: DhakaArea) => {
    if (isDisabled) return;

    if (mapSelectionTarget === "pickup") {
      setPickupZone(zone);
    } else {
      setDestinationZone(zone);
    }
  };

  useEffect(() => {
    const requestSequence = ++estimateSequenceRef.current;
    setEstimatedFarePoysha(null);
    setEstimateError(null);

    if (!hasValidRoute || isLocked) {
      return;
    }

    const input: CreateRideInput = {
      pickupZone,
      destinationZone,
      seats,
    };
    const timeoutId = window.setTimeout(() => {
      void estimateRide(input)
        .then((estimate) => {
          if (estimateSequenceRef.current === requestSequence) {
            setEstimatedFarePoysha(estimate.estimatedFarePoysha);
          }
        })
        .catch((caughtError) => {
          if (estimateSequenceRef.current === requestSequence) {
            setEstimateError(
              getErrorMessage(caughtError, t("passenger.estimateError")),
            );
          }
        });
    }, 400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [destinationZone, hasValidRoute, isLocked, pickupZone, seats]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    if (!hasValidRoute || isLocked) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onCreateRide({ pickupZone, destinationZone, seats });
    } catch (caughtError) {
      setSubmitError(getErrorMessage(caughtError, t("passenger.requestError")));
    } finally {
      setIsSubmitting(false);
    }
  };

  const swapZones = () => {
    setPickupZone(destinationZone);
    setDestinationZone(pickupZone);
  };

  return (
    <section
      aria-labelledby="request-ride-title"
      className="animate-rise rounded-[1.375rem] border border-border/80 bg-card p-5 shadow-card sm:p-7"
      style={{ animationDelay: "60ms" }}
    >
      <div className="mb-6">
        <Kicker>{t("passenger.rideRequest")}</Kicker>
        <h2
          className="mt-1 text-2xl font-extrabold tracking-[-0.03em]"
          id="request-ride-title"
        >
          {t("passenger.whereGoing")}
        </h2>
      </div>

      {isLocked ? (
        <p
          className="mb-5 flex items-center gap-2.5 rounded-2xl border border-marigold/40 bg-marigold/[0.14] px-4 py-3 text-sm font-medium text-warning-foreground"
          role="status"
        >
          <Lock aria-hidden="true" className="size-4 shrink-0" />
          {t("passenger.activeRideMessage")}
        </p>
      ) : null}

      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* Pickup and destination read as two stops on one line. */}
        <div className="rounded-2xl border bg-background/60 p-3 sm:p-4">
          <div className="space-y-1.5">
            <label
              className="pl-1 text-[0.8125rem] font-semibold text-foreground/85"
              htmlFor="pickup-zone"
            >
              {t("passenger.pickupZone")}
            </label>
            <NativeSelect
              disabled={isDisabled}
              id="pickup-zone"
              leading={<ZoneDot zone={pickupZone} />}
              onChange={(event) =>
                setPickupZone(event.target.value as DhakaArea | "")
              }
              value={pickupZone}
            >
              <option value="">{t("passenger.choosePickup")}</option>
              {DHAKA_AREAS.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="relative my-2 flex justify-end">
            <button
              aria-label={t("passenger.swapZones")}
              className="group flex size-9 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-card transition-[color,transform,border-color] duration-300 hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
              disabled={isDisabled || (!pickupZone && !destinationZone)}
              onClick={swapZones}
              type="button"
            >
              <ArrowDownUp
                aria-hidden="true"
                className="size-4 transition-transform duration-500 ease-spring group-active:rotate-180"
              />
            </button>
          </div>

          <div className="space-y-1.5">
            <label
              className="pl-1 text-[0.8125rem] font-semibold text-foreground/85"
              htmlFor="destination-zone"
            >
              {t("passenger.destinationZone")}
            </label>
            <NativeSelect
              disabled={isDisabled}
              id="destination-zone"
              leading={<ZoneDot hollow zone={destinationZone} />}
              onChange={(event) =>
                setDestinationZone(event.target.value as DhakaArea | "")
              }
              value={destinationZone}
            >
              <option value="">{t("passenger.chooseDestination")}</option>
              {DHAKA_AREAS.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>

        <div className="space-y-3">
          <fieldset
            className="space-y-2"
            disabled={isDisabled}
            role="radiogroup"
            aria-label={t("map.zone")}
          >
            <legend className="pl-1 text-[0.8125rem] font-semibold text-foreground/85">
              {t("map.zone")}
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {(["pickup", "destination"] as const).map((target) => (
                <label
                  className={cn(
                    "flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
                    mapSelectionTarget === target
                      ? "border-primary bg-secondary text-foreground"
                      : "bg-card text-muted-foreground hover:border-foreground/30",
                  )}
                  key={target}
                >
                  <input
                    checked={mapSelectionTarget === target}
                    className="sr-only"
                    name="map-selection-target"
                    onChange={() => setMapSelectionTarget(target)}
                    type="radio"
                    value={target}
                  />
                  {t(target === "pickup" ? "map.pickup" : "map.destination")}
                </label>
              ))}
            </div>
            <p className="px-1 text-xs text-muted-foreground" role="status">
              {t(
                mapSelectionTarget === "pickup"
                  ? "map.selectPickup"
                  : "map.selectDestination",
              )}
            </p>
          </fieldset>

          <ZoneMap
            className="min-h-[24rem]"
            disabled={isDisabled}
            markers={mapMarkers}
            mode="selectable"
            onZoneSelect={handleMapZoneSelect}
          />
        </div>

        <fieldset
          aria-labelledby="requested-seats-label"
          className="min-w-0"
          disabled={isDisabled}
        >
          <span
            className="block pl-1 text-[0.8125rem] font-semibold text-foreground/85"
            id="requested-seats-label"
          >
            {t("auth.vehicleSeats")}
          </span>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SEAT_OPTIONS.map((seatCount) => {
              const isSelected = seats === seatCount;

              return (
                <label
                  className={cn(
                    "group relative flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-center transition-[border-color,background-color,box-shadow,transform] duration-200 active:scale-[0.97] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
                    isSelected
                      ? "border-primary bg-secondary shadow-[inset_0_0_0_1px_hsl(var(--primary))]"
                      : "bg-card hover:border-foreground/30",
                  )}
                  key={seatCount}
                >
                  <input
                    checked={isSelected}
                    className="sr-only"
                    name="requested-seats"
                    onChange={() => setSeats(seatCount)}
                    type="radio"
                    value={seatCount}
                  />
                  <span aria-hidden="true" className="flex gap-0.5">
                    {SEAT_OPTIONS.map((slot) => (
                      <UserRound
                        className={cn(
                          "size-3.5 transition-colors duration-200",
                          slot <= seatCount
                            ? isSelected
                              ? "text-primary"
                              : "text-foreground/70"
                            : "text-border",
                        )}
                        key={slot}
                        strokeWidth={2.5}
                      />
                    ))}
                  </span>
                  <span className="text-sm font-semibold">
                    {seatCount}{" "}
                    {seatCount === 1 ? t("common.seat") : t("common.seats")}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {hasValidRoute && !isLocked ? (
          <div className="animate-slide-down overflow-hidden rounded-2xl bg-ink text-paper">
            <div className="flex items-end justify-between gap-4 px-5 pb-4 pt-5">
              <div className="min-w-0">
                <p className="text-[0.8125rem] text-paper/60">
                  {t("fare.estimatedSolo")}
                </p>
                {estimatedFarePoysha !== null ? (
                  <p
                    className="mt-1 animate-pop font-mono text-[2rem] font-semibold leading-none tracking-tight"
                    key={estimatedFarePoysha}
                  >
                    {formatPoysha(estimatedFarePoysha)}
                  </p>
                ) : (
                  <p
                    className="mt-2 flex items-center gap-2 text-sm text-paper/80"
                    role="status"
                  >
                    <LoaderCircle
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                    {t("passenger.calculatingFare")}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-paper/70">
                <ZoneDot zone={pickupZone} />
                <span className="h-px w-5 bg-paper/30" />
                <ZoneDot hollow zone={destinationZone} />
              </div>
            </div>
            <div className="border-t border-dashed border-white/15 px-5 py-3 text-xs text-paper/60">
              {t("fare.poolNote")}
            </div>
            {estimateError ? (
              <p
                className="border-t border-white/10 bg-destructive/20 px-5 py-3 text-sm text-paper"
                role="alert"
              >
                {estimateError}
              </p>
            ) : null}
          </div>
        ) : null}

        {submitError ? <Alert>{submitError}</Alert> : null}

        <Button
          className="group w-full"
          disabled={!hasValidRoute || isLocked || isSubmitting}
          size="lg"
          type="submit"
        >
          {isSubmitting ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : null}
          {isSubmitting
            ? t("passenger.requestingRide")
            : t("passenger.requestRide")}
          {isSubmitting ? null : (
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform duration-300 ease-out group-hover:translate-x-1"
            />
          )}
        </Button>
      </form>
    </section>
  );
}
