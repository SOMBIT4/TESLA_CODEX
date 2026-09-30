import { useCallback, useEffect, useReducer, useRef } from "react";
import { ApiError } from "@/lib/api/client";
import {
  acceptRide as acceptRideRequest,
  dropOffRide as dropOffRideRequest,
  getActivePool,
  getDriverHistory,
  getDriverSnapshot,
  listWaitingRides,
  setDriverOnlineStatus,
  transitionPool,
} from "@/lib/api/driver";
import type {
  DriverActivePool,
  DriverHistoryPool,
  DriverSnapshot,
  PoolLifecycleAction,
  WaitingRide,
} from "@/lib/api/types";

const POLL_INTERVAL_MS = 5_000;

const ACCEPT_CONFLICT_MESSAGES: Record<string, string> = {
  POOL_FULL: "Not enough seats left in Bullet",
  RIDE_NOT_COMPATIBLE: "This ride doesn't match the current pool route",
  POOL_NOT_ACCEPTING: "This pool can't take new rides after arrival",
  RIDE_ALREADY_MATCHED: "That request is no longer available",
  RIDE_CANCELLED: "That request is no longer available",
};

export type DriverPendingAction =
  "toggle-status" | "accept" | "arrive" | "start" | "drop-off";

export interface DriverDashboardState {
  snapshot: DriverSnapshot | null;
  waitingRides: WaitingRide[];
  activePool: DriverActivePool | null;
  history: DriverHistoryPool[];
  isLoading: boolean;
  error: string | null;
  isUnauthenticated: boolean;
  pendingAction: DriverPendingAction | null;
  pendingRideId: string | null;
}

export const initialDriverDashboardState: DriverDashboardState = {
  snapshot: null,
  waitingRides: [],
  activePool: null,
  history: [],
  isLoading: true,
  error: null,
  isUnauthenticated: false,
  pendingAction: null,
  pendingRideId: null,
};

export type DriverDashboardAction =
  | { type: "SNAPSHOT_LOADED"; snapshot: DriverSnapshot }
  | {
      type: "OPERATIONS_LOADED";
      waitingRides: WaitingRide[];
      activePool: DriverActivePool | null;
      preserveError?: boolean;
    }
  | { type: "HISTORY_LOADED"; history: DriverHistoryPool[] }
  | { type: "STATUS_UPDATED"; snapshot: DriverSnapshot }
  | {
      type: "ACTION_STARTED";
      action: DriverPendingAction;
      rideId?: string;
    }
  | { type: "ACTION_FINISHED" }
  | { type: "REQUEST_FAILED"; message: string }
  | { type: "UNAUTHENTICATED" };

export function driverDashboardReducer(
  state: DriverDashboardState,
  action: DriverDashboardAction,
): DriverDashboardState {
  switch (action.type) {
    case "SNAPSHOT_LOADED":
      return {
        ...state,
        snapshot: action.snapshot,
        error: null,
        isUnauthenticated: false,
      };
    case "OPERATIONS_LOADED":
      return {
        ...state,
        waitingRides: action.waitingRides,
        activePool: action.activePool,
        isLoading: false,
        error: action.preserveError ? state.error : null,
        isUnauthenticated: false,
      };
    case "HISTORY_LOADED":
      return {
        ...state,
        history: action.history,
        isUnauthenticated: false,
      };
    case "STATUS_UPDATED":
      return {
        ...state,
        snapshot: action.snapshot,
        error: null,
      };
    case "ACTION_STARTED":
      return {
        ...state,
        pendingAction: action.action,
        pendingRideId: action.rideId ?? null,
        error: null,
      };
    case "ACTION_FINISHED":
      return { ...state, pendingAction: null, pendingRideId: null };
    case "REQUEST_FAILED":
      return {
        ...state,
        isLoading: false,
        error: action.message,
      };
    case "UNAUTHENTICATED":
      return {
        ...state,
        isLoading: false,
        error: null,
        isUnauthenticated: true,
      };
  }
}

interface RefreshOptions {
  preserveError?: boolean;
}

function getRequestFailureMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function getAcceptFailureMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return ACCEPT_CONFLICT_MESSAGES[error.code] ?? error.message;
    }

    return error.message;
  }

  return "Could not accept this ride request.";
}

export function useDriverDashboard() {
  const [state, dispatch] = useReducer(
    driverDashboardReducer,
    initialDriverDashboardState,
  );
  const isMountedRef = useRef(true);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);
  const historyPromiseRef = useRef<Promise<void> | null>(null);
  const pendingActionRef = useRef<DriverPendingAction | null>(null);
  const pollIntervalRef = useRef<number | null>(null);

  const recordFailure = useCallback(
    (error: unknown, fallback: string, preserveError = false) => {
      if (!isMountedRef.current) {
        return;
      }

      if (error instanceof ApiError && error.status === 401) {
        dispatch({ type: "UNAUTHENTICATED" });
        return;
      }

      if (!preserveError) {
        dispatch({
          type: "REQUEST_FAILED",
          message: getRequestFailureMessage(error, fallback),
        });
      }
    },
    [],
  );

  const refreshOperations = useCallback(
    (options: RefreshOptions = {}): Promise<void> => {
      if (refreshPromiseRef.current) {
        return refreshPromiseRef.current;
      }

      const refreshPromise = (async () => {
        try {
          const [waitingRides, activePool] = await Promise.all([
            listWaitingRides(),
            getActivePool(),
          ]);

          if (isMountedRef.current) {
            dispatch({
              type: "OPERATIONS_LOADED",
              waitingRides,
              activePool,
              preserveError: options.preserveError,
            });
          }
        } catch (error) {
          recordFailure(
            error,
            "Could not refresh live driver data.",
            options.preserveError,
          );
        } finally {
          refreshPromiseRef.current = null;
        }
      })();

      refreshPromiseRef.current = refreshPromise;
      return refreshPromise;
    },
    [recordFailure],
  );

  const loadSnapshot = useCallback(async () => {
    try {
      const snapshot = await getDriverSnapshot();

      if (isMountedRef.current) {
        dispatch({ type: "SNAPSHOT_LOADED", snapshot });
      }
    } catch (error) {
      recordFailure(error, "Could not load driver status.");
    }
  }, [recordFailure]);

  const refreshHistory = useCallback((): Promise<void> => {
    if (historyPromiseRef.current) {
      return historyPromiseRef.current;
    }

    const refreshPromise = (async () => {
      try {
        const history = await getDriverHistory();

        if (isMountedRef.current) {
          dispatch({ type: "HISTORY_LOADED", history });
        }
      } catch (error) {
        recordFailure(error, "Could not refresh driver history.", true);
      } finally {
        historyPromiseRef.current = null;
      }
    })();

    historyPromiseRef.current = refreshPromise;
    return refreshPromise;
  }, [recordFailure]);

  const runAction = useCallback(
    async (
      action: DriverPendingAction,
      operation: () => Promise<void>,
      getFailureMessage: (error: unknown) => string,
      pendingRideId?: string,
    ) => {
      if (pendingActionRef.current) {
        return;
      }

      pendingActionRef.current = action;
      dispatch({ type: "ACTION_STARTED", action, rideId: pendingRideId });
      let failureMessage: string | null = null;

      try {
        await refreshPromiseRef.current;
        await operation();
      } catch (error) {
        failureMessage = getFailureMessage(error);

        if (isMountedRef.current) {
          dispatch({ type: "REQUEST_FAILED", message: failureMessage });
        }
      } finally {
        await Promise.all([
          refreshOperations({ preserveError: failureMessage !== null }),
          refreshHistory(),
        ]);
        pendingActionRef.current = null;

        if (isMountedRef.current) {
          dispatch({ type: "ACTION_FINISHED" });
        }
      }
    },
    [refreshHistory, refreshOperations],
  );

  const toggleStatus = useCallback(() => {
    if (!state.snapshot) {
      return Promise.resolve();
    }

    const isOnline = !state.snapshot.isOnline;

    return runAction(
      "toggle-status",
      async () => {
        const snapshot = await setDriverOnlineStatus(isOnline);

        if (isMountedRef.current) {
          dispatch({ type: "STATUS_UPDATED", snapshot });
        }
      },
      (error) =>
        getRequestFailureMessage(error, "Could not update driver status."),
    );
  }, [runAction, state.snapshot]);

  const acceptRide = useCallback(
    (rideId: string) =>
      runAction(
        "accept",
        async () => {
          await acceptRideRequest(rideId);
        },
        getAcceptFailureMessage,
      ),
    [runAction],
  );

  const transitionActivePool = useCallback(
    (action: PoolLifecycleAction) => {
      if (!state.activePool) {
        return Promise.resolve();
      }

      const poolId = state.activePool.id;

      return runAction(
        action,
        async () => {
          await transitionPool(poolId, action);
        },
        (error) =>
          getRequestFailureMessage(error, "Could not update this pool."),
      );
    },
    [runAction, state.activePool],
  );

  const dropOffRide = useCallback(
    (rideId: string) => {
      if (!state.activePool) {
        return Promise.resolve();
      }

      const poolId = state.activePool.id;

      return runAction(
        "drop-off",
        async () => {
          await dropOffRideRequest(poolId, rideId);
        },
        (error) =>
          getRequestFailureMessage(error, "Could not drop off this rider."),
        rideId,
      );
    },
    [runAction, state.activePool],
  );

  useEffect(() => {
    isMountedRef.current = true;
    void loadSnapshot();
    void refreshOperations();
    void refreshHistory();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadSnapshot, refreshHistory, refreshOperations]);

  useEffect(() => {
    const stopPolling = () => {
      if (pollIntervalRef.current !== null) {
        window.clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };

    const poll = () => {
      if (
        document.hidden ||
        pendingActionRef.current ||
        refreshPromiseRef.current
      ) {
        return;
      }

      void refreshOperations();
    };

    const startPolling = () => {
      if (pollIntervalRef.current === null) {
        pollIntervalRef.current = window.setInterval(poll, POLL_INTERVAL_MS);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
        return;
      }

      if (!pendingActionRef.current && !refreshPromiseRef.current) {
        void refreshOperations();
      }

      startPolling();
    };

    if (!document.hidden) {
      startPolling();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshOperations]);

  return {
    ...state,
    refreshOperations,
    refreshHistory,
    toggleStatus,
    acceptRide,
    arrive: () => transitionActivePool("arrive"),
    start: () => transitionActivePool("start"),
    dropOffRide,
  };
}
