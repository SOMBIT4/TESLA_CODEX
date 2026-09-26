import { db } from "../../db/pool.js";
import { withTransaction } from "../../db/transaction.js";
import type { DhakaArea } from "../fares/fare-rules.js";
import type {
  AcceptRideInput,
  PoolAcceptanceOutcome,
  PoolRideForFare,
  PoolStatus,
} from "./pool.types.js";

export type {
  AcceptRideInput,
  PoolAcceptanceOutcome,
  PoolRideForFare,
} from "./pool.types.js";

interface DriverRow {
  driver_id: string;
  is_online: boolean;
  vehicle_id: string | null;
  vehicle_capacity: number | null;
}

interface RideRow {
  id: string;
  status: PoolRideForFare["status"];
  pickup_zone: DhakaArea;
  destination_zone: DhakaArea;
  seats_requested: number;
}

interface PoolRow {
  id: string;
  status: PoolStatus;
  pickup_zone: DhakaArea;
  capacity_snapshot: number;
}

interface OccupiedSeatsRow {
  occupied_seats: number | string;
}

export interface PoolQueryClient {
  query<T = unknown>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: T[] }>;
}

export type PoolTransactionRunner = <T>(
  callback: (client: PoolQueryClient) => Promise<T>,
) => Promise<T>;

export interface PoolRepository {
  acceptRide(
    input: AcceptRideInput,
    calculatePooledFare: (ride: PoolRideForFare) => number,
  ): Promise<PoolAcceptanceOutcome>;
}

const defaultTransactionRunner: PoolTransactionRunner = (callback) =>
  withTransaction((client) => callback(client as unknown as PoolQueryClient));

export function createPoolRepository(
  client: PoolQueryClient = db as unknown as PoolQueryClient,
  runInTransaction: PoolTransactionRunner = defaultTransactionRunner,
): PoolRepository {
  return {
    async acceptRide(input, calculatePooledFare) {
      return runInTransaction(async (transactionClient) => {
        const driverResult = await transactionClient.query<DriverRow>(
          `SELECT d.id AS driver_id,
                  d.is_online,
                  v.id AS vehicle_id,
                  v.capacity AS vehicle_capacity
           FROM drivers AS d
           LEFT JOIN vehicles AS v
             ON v.driver_id = d.id
            AND v.is_active = TRUE
           WHERE d.user_id = $1
           FOR UPDATE OF d`,
          [input.driverUserId],
        );
        const driver = driverResult.rows[0];

        if (!driver) {
          return { kind: "driver_profile_missing" };
        }

        if (!driver.is_online) {
          return { kind: "driver_offline" };
        }

        if (!driver.vehicle_id || !driver.vehicle_capacity) {
          return { kind: "no_active_vehicle" };
        }

        const rideResult = await transactionClient.query<RideRow>(
          `SELECT id,
                  status,
                  pickup_zone,
                  destination_zone,
                  seats_requested
           FROM ride_requests
           WHERE id = $1
           FOR UPDATE`,
          [input.rideId],
        );
        const ride = rideResult.rows[0];

        if (!ride) {
          return { kind: "ride_not_found" };
        }

        if (ride.status !== "REQUESTED") {
          return { kind: "ride_not_requested" };
        }

        const poolRide = mapRideForFare(ride);
        const farePoysha = calculatePooledFare(poolRide);
        const poolResult = await transactionClient.query<PoolRow>(
          `SELECT id,
                  status,
                  pickup_zone,
                  capacity_snapshot
           FROM pools
           WHERE driver_id = $1
             AND status IN ('MATCHED', 'DRIVER_ARRIVED', 'STARTED')
           FOR UPDATE`,
          [driver.driver_id],
        );
        let pool = poolResult.rows[0];

        if (pool && pool.pickup_zone !== ride.pickup_zone) {
          return { kind: "ride_not_compatible" };
        }

        if (!pool) {
          const createdPoolResult = await transactionClient.query<PoolRow>(
            `INSERT INTO pools (
               id,
               driver_id,
               vehicle_id,
               status,
               capacity_snapshot,
               pickup_zone
             )
             VALUES ($1, $2, $3, 'MATCHED', $4, $5)
             RETURNING id, status, pickup_zone, capacity_snapshot`,
            [
              input.poolId,
              driver.driver_id,
              driver.vehicle_id,
              driver.vehicle_capacity,
              ride.pickup_zone,
            ],
          );
          pool = createdPoolResult.rows[0];
        }

        const occupiedSeatsResult =
          await transactionClient.query<OccupiedSeatsRow>(
            `SELECT COALESCE(SUM(seats_reserved), 0)::INTEGER AS occupied_seats
             FROM pool_memberships
             WHERE pool_id = $1
               AND status = 'ACTIVE'`,
            [pool.id],
          );
        const occupiedSeats = Number(
          occupiedSeatsResult.rows[0]?.occupied_seats ?? 0,
        );

        if (occupiedSeats + ride.seats_requested > pool.capacity_snapshot) {
          return { kind: "pool_full" };
        }

        await transactionClient.query(
          `INSERT INTO pool_memberships (
             id,
             pool_id,
             ride_request_id,
             seats_reserved,
             fare_poysha,
             status
           )
           VALUES ($1, $2, $3, $4, $5, 'ACTIVE')`,
          [
            input.membershipId,
            pool.id,
            ride.id,
            ride.seats_requested,
            farePoysha,
          ],
        );
        await transactionClient.query(
          `UPDATE ride_requests
           SET status = 'MATCHED'
           WHERE id = $1`,
          [ride.id],
        );
        await transactionClient.query(
          `INSERT INTO ride_status_events (
             id,
             ride_request_id,
             pool_id,
             actor_user_id,
             from_status,
             to_status
           )
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            input.statusEventId,
            ride.id,
            pool.id,
            input.driverUserId,
            "REQUESTED",
            "MATCHED",
          ],
        );

        const newOccupiedSeats = occupiedSeats + ride.seats_requested;

        return {
          kind: "accepted",
          acceptance: {
            pool: {
              id: pool.id,
              status: pool.status,
              pickupZone: pool.pickup_zone,
              capacity: pool.capacity_snapshot,
              occupiedSeats: newOccupiedSeats,
              availableSeats: pool.capacity_snapshot - newOccupiedSeats,
            },
            membership: {
              id: input.membershipId,
              rideRequestId: ride.id,
              seatsReserved: ride.seats_requested,
              farePoysha,
              status: "ACTIVE",
            },
          },
        };
      });
    },
  };
}

function mapRideForFare(row: RideRow): PoolRideForFare {
  return {
    id: row.id,
    status: row.status,
    pickupZone: row.pickup_zone,
    destinationZone: row.destination_zone,
    seatsRequested: row.seats_requested,
  };
}
