"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DHAKA_AREAS } from "@/lib/constants/areas";
import { ApiError } from "@/lib/api/client";
import { estimateRide } from "@/lib/api/rides";
import { formatPoysha } from "@/lib/format/money";
import type { CreateRideInput, DhakaArea, Ride } from "@/lib/api/types";

interface RideRequestFormProps {
  activeRide: Ride | null;
  onCreateRide: (input: CreateRideInput) => Promise<unknown>;
}

const SEAT_OPTIONS = [1, 2, 3] as const;

function getErrorMessage(caughtError: unknown, fallback: string) {
  return caughtError instanceof ApiError ? caughtError.message : fallback;
}

export default function RideRequestForm({
  activeRide,
  onCreateRide,
}: RideRequestFormProps) {
  const [pickupZone, setPickupZone] = useState<DhakaArea | "">("");
  const [destinationZone, setDestinationZone] = useState<DhakaArea | "">("");
  const [seats, setSeats] = useState(1);
  const [estimatedFarePoysha, setEstimatedFarePoysha] = useState<number | null>(
    null,
  );
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const estimateSequenceRef = useRef(0);
  const isLocked = activeRide !== null;
  const hasValidRoute =
    pickupZone !== "" &&
    destinationZone !== "" &&
    pickupZone !== destinationZone;

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
              getErrorMessage(caughtError, "Unable to estimate this ride."),
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
      setSubmitError(
        getErrorMessage(caughtError, "Unable to request your ride. Try again."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      aria-labelledby="request-ride-title"
      className="rounded-xl border bg-card p-6 shadow-sm"
    >
      <div className="mb-5">
        <p className="text-sm font-medium text-muted-foreground">
          Bullet ride request
        </p>
        <h1
          className="text-2xl font-semibold tracking-tight"
          id="request-ride-title"
        >
          Where are you going?
        </h1>
      </div>

      {isLocked ? (
        <p
          className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900"
          role="status"
        >
          You already have a ride in progress.
        </p>
      ) : null}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="pickup-zone">
            Pickup zone
          </label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            disabled={isLocked || isSubmitting}
            id="pickup-zone"
            onChange={(event) =>
              setPickupZone(event.target.value as DhakaArea | "")
            }
            value={pickupZone}
          >
            <option value="">Choose pickup zone</option>
            {DHAKA_AREAS.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="destination-zone">
            Destination zone
          </label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            disabled={isLocked || isSubmitting}
            id="destination-zone"
            onChange={(event) =>
              setDestinationZone(event.target.value as DhakaArea | "")
            }
            value={destinationZone}
          >
            <option value="">Choose destination zone</option>
            {DHAKA_AREAS.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="requested-seats">
            Seats
          </label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            disabled={isLocked || isSubmitting}
            id="requested-seats"
            onChange={(event) => setSeats(Number(event.target.value))}
            value={seats}
          >
            {SEAT_OPTIONS.map((seatCount) => (
              <option key={seatCount} value={seatCount}>
                {seatCount} {seatCount === 1 ? "seat" : "seats"}
              </option>
            ))}
          </select>
        </div>

        {hasValidRoute && !isLocked ? (
          <div className="rounded-lg bg-slate-50 px-4 py-3">
            <p className="text-sm text-muted-foreground">Estimated solo fare</p>
            {estimatedFarePoysha !== null ? (
              <p className="mt-1 text-xl font-semibold">
                {formatPoysha(estimatedFarePoysha)}
              </p>
            ) : (
              <p className="mt-1 text-sm" role="status">
                Calculating fare…
              </p>
            )}
            {estimateError ? (
              <p className="mt-2 text-sm text-destructive" role="alert">
                {estimateError}
              </p>
            ) : null}
          </div>
        ) : null}

        {submitError ? (
          <p className="text-sm text-destructive" role="alert">
            {submitError}
          </p>
        ) : null}

        <Button
          className="w-full"
          disabled={!hasValidRoute || isLocked || isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Requesting ride…" : "Request ride"}
        </Button>
      </form>
    </section>
  );
}
