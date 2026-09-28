"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import {
  cancelRide as cancelRideRequest,
  createRide as createRideRequest,
  getRide,
  listMyRides,
} from "@/lib/api/rides";
import {
  isTerminalRideStatus,
  type CreateRideInput,
  type Ride,
} from "@/lib/api/types";

const POLL_INTERVAL_MS = 5_000;

export interface PassengerRidesState {
  rides: Ride[];
  currentRide: Ride | null;
  isLoading: boolean;
  error: string | null;
  isUnauthenticated: boolean;
  createRide: (input: CreateRideInput) => Promise<Ride>;
  cancelRide: (rideId: string) => Promise<Ride>;
  refresh: () => Promise<void>;
}

function errorMessage(caughtError: unknown) {
  if (caughtError instanceof ApiError) {
    return caughtError.message;
  }

  return "Unable to load your rides. Please try again.";
}

export function usePassengerRides(): PassengerRidesState {
  const [rides, setRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUnauthenticated, setIsUnauthenticated] = useState(false);
  const isMountedRef = useRef(true);
  const isPollingRef = useRef(false);

  const recordError = useCallback((caughtError: unknown) => {
    if (!isMountedRef.current) {
      return;
    }

    if (
      caughtError instanceof ApiError &&
      caughtError.code === "UNAUTHENTICATED"
    ) {
      setIsUnauthenticated(true);
      return;
    }

    setError(errorMessage(caughtError));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const nextRides = await listMyRides();

      if (!isMountedRef.current) {
        return;
      }

      setRides(nextRides);
      setError(null);
      setIsUnauthenticated(false);
    } catch (caughtError) {
      recordError(caughtError);
      throw caughtError;
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [recordError]);

  useEffect(() => {
    isMountedRef.current = true;
    void refresh().catch(() => undefined);

    return () => {
      isMountedRef.current = false;
    };
  }, [refresh]);

  const currentRide = useMemo(
    () => rides.find((ride) => !isTerminalRideStatus(ride.status)) ?? null,
    [rides],
  );

  useEffect(() => {
    if (!currentRide) {
      return;
    }

    let isEffectActive = true;

    const pollCurrentRide = async () => {
      if (isPollingRef.current) {
        return;
      }

      isPollingRef.current = true;

      try {
        const updatedRide = await getRide(currentRide.id);

        if (!isEffectActive || !isMountedRef.current) {
          return;
        }

        setRides((previousRides) =>
          previousRides.map((ride) =>
            ride.id === updatedRide.id ? updatedRide : ride,
          ),
        );

        if (isTerminalRideStatus(updatedRide.status)) {
          void refresh().catch(() => undefined);
        }
      } catch (caughtError) {
        if (isEffectActive) {
          recordError(caughtError);
        }
      } finally {
        isPollingRef.current = false;
      }
    };

    const intervalId = window.setInterval(() => {
      void pollCurrentRide();
    }, POLL_INTERVAL_MS);

    return () => {
      isEffectActive = false;
      window.clearInterval(intervalId);
    };
  }, [currentRide, recordError, refresh]);

  const createRide = useCallback(
    async (input: CreateRideInput) => {
      try {
        const createdRide = await createRideRequest(input);

        if (isMountedRef.current) {
          setRides((previousRides) => [createdRide, ...previousRides]);
        }

        void refresh().catch(() => undefined);
        return createdRide;
      } catch (caughtError) {
        recordError(caughtError);
        throw caughtError;
      }
    },
    [recordError, refresh],
  );

  const cancelRide = useCallback(
    async (rideId: string) => {
      try {
        const cancelledRide = await cancelRideRequest(rideId);

        if (isMountedRef.current) {
          setRides((previousRides) =>
            previousRides.map((ride) =>
              ride.id === cancelledRide.id ? cancelledRide : ride,
            ),
          );
        }

        void refresh().catch(() => undefined);
        return cancelledRide;
      } catch (caughtError) {
        recordError(caughtError);
        throw caughtError;
      }
    },
    [recordError, refresh],
  );

  return {
    rides,
    currentRide,
    isLoading,
    error,
    isUnauthenticated,
    createRide,
    cancelRide,
    refresh,
  };
}
