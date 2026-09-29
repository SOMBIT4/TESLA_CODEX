import { db } from "../../db/pool.js";
import { withTransaction } from "../../db/transaction.js";
import type { DhakaArea } from "../fares/fare-rules.js";
import type {
  AcceptRideInput,
  ActivePoolOutcome,
  DriverActivePool,
  PoolAcceptanceOutcome,
  PoolLifecycleOutcome,
  PoolRideForFare,
  PoolStatus,
  TransitionPoolInput,
} from "./pool.types.js";

export type {
  AcceptRideInput,
  ActivePoolOutcome,
  DriverActivePool,
  PoolAcceptanceOutcome,
  PoolLifecycleOutcome,
  PoolRideForFare,
  TransitionPoolInput,
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

interface LifecyclePoolRow extends PoolRow {
  started_at: Date | string | null;
  completed_at: Date | string | null;
}

interface PoolMemberRideRow {
  ride_request_id: string;
  status: PoolRideForFare["status"];
  seats_reserved: number;
}

interface OccupiedSeatsRow {
  occupied_seats: number | string;
}

interface ActivePoolRow {
  pool_id: string;
  pool_status: DriverActivePool["status"];
  pickup_zone: DhakaArea;
  vehicle_name: string;
  vehicle_capacity: number;
  ride_request_id: string | null;
  passenger_name: string | null;
  member_pickup_zone: DhakaArea | null;
  member_destination_zone: DhakaArea | null;
  seats_reserved: number | null;
  fare_poysha: number | null;
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
  getActivePool(driverUserId: string): Promise<ActivePoolOutcome>;
  acceptRide(
    input: AcceptRideInput,
    calculatePooledFare: (ride: PoolRideForFare) => number,
  ): Promise<PoolAcceptanceOutcome>;
  transitionPool(
    input: TransitionPoolInput,
    createStatusEventId: () => string,
  ): Promise<PoolLifecycleOutcome>;
}

const defaultTransactionRunner: PoolTransactionRunner = (callback) =>
  withTransaction((client) => callback(client as unknown as PoolQueryClient));

export function createPoolRepository(
  client: PoolQueryClient = db as unknown as PoolQueryClient,
  runInTransaction: PoolTransactionRunner = defaultTransactionRunner,
): PoolRepository {
  return {
    async getActivePool(driverUserId) {
      const driverResult = await client.query<{ driver_id: string }>(
        `SELECT id AS driver_id
         FROM drivers
         WHERE user_id = $1`,
        [driverUserId],
      );
      const driver = driverResult.rows[0];

      if (!driver) {
        return { kind: "driver_profile_missing" };
      }

      const poolResult = await client.query<ActivePoolRow>(
        `SELECT p.id AS pool_id,
                p.status AS pool_status,
                p.pickup_zone,
                v.name AS vehicle_name,
                v.capacity AS vehicle_capacity,
                m.ride_request_id,
                m.seats_reserved,
                m.fare_poysha,
                r.pickup_zone AS member_pickup_zone,
                r.destination_zone AS member_destination_zone,
                u.name AS passenger_name
         FROM pools AS p
         JOIN vehicles AS v
           ON v.id = p.vehicle_id
         LEFT JOIN pool_memberships AS m
           ON m.pool_id = p.id
          AND m.status = 'ACTIVE'
         LEFT JOIN ride_requests AS r
           ON r.id = m.ride_request_id
         LEFT JOIN users AS u
           ON u.id = r.passenger_id
         WHERE p.driver_id = $1
           AND p.status IN ('MATCHED', 'DRIVER_ARRIVED', 'STARTED')
         ORDER BY m.joined_at ASC, m.id ASC`,
        [driver.driver_id],
      );
      const activePool = mapActivePool(poolResult.rows);

      if (!activePool) {
        return { kind: "no_active_pool" };
      }

      return { kind: "active_pool", activePool };
    },

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

        if (pool && pool.status !== "MATCHED") {
          return { kind: "pool_not_accepting" };
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

    async transitionPool(input, createStatusEventId) {
      try {
        return await runInTransaction(async (transactionClient) => {
          const driverResult = await transactionClient.query<{
            driver_id: string;
          }>(
            `SELECT id AS driver_id
             FROM drivers
             WHERE user_id = $1
             FOR UPDATE`,
            [input.driverUserId],
          );
          const driver = driverResult.rows[0];

          if (!driver) {
            return { kind: "driver_profile_missing" };
          }

          const poolResult = await transactionClient.query<LifecyclePoolRow>(
            `SELECT id,
                    status,
                    pickup_zone,
                    capacity_snapshot,
                    started_at,
                    completed_at
             FROM pools
             WHERE id = $1
               AND driver_id = $2
             FOR UPDATE`,
            [input.poolId, driver.driver_id],
          );
          const pool = poolResult.rows[0];

          if (!pool) {
            return { kind: "pool_not_found" };
          }

          if (pool.status !== input.expectedStatus) {
            return { kind: "invalid_pool_transition" };
          }

          const memberRidesResult =
            await transactionClient.query<PoolMemberRideRow>(
              `SELECT m.ride_request_id,
                      m.seats_reserved,
                      r.status
               FROM pool_memberships AS m
               JOIN ride_requests AS r
                 ON r.id = m.ride_request_id
               WHERE m.pool_id = $1
                 AND m.status = 'ACTIVE'
               ORDER BY m.joined_at ASC, m.id ASC
               FOR UPDATE OF m, r`,
              [pool.id],
            );
          const memberRides = memberRidesResult.rows;

          if (
            memberRides.length === 0 ||
            memberRides.some((ride) => ride.status !== input.expectedStatus)
          ) {
            return { kind: "pool_ride_state_mismatch" };
          }

          const updatedPoolResult =
            await transactionClient.query<LifecyclePoolRow>(
              `UPDATE pools
               SET status = $2::VARCHAR(30),
                   started_at = CASE
                     WHEN $2::VARCHAR(30) = 'STARTED'::VARCHAR(30) THEN NOW()
                     ELSE started_at
                   END,
                   completed_at = CASE
                     WHEN $2::VARCHAR(30) = 'COMPLETED'::VARCHAR(30) THEN NOW()
                     ELSE completed_at
                   END
               WHERE id = $1
                 AND status = $3
               RETURNING id,
                         status,
                         pickup_zone,
                         capacity_snapshot,
                         started_at,
                         completed_at`,
              [pool.id, input.targetStatus, input.expectedStatus],
            );
          const updatedPool = updatedPoolResult.rows[0];

          if (!updatedPool) {
            throw new PoolTransitionAbort("invalid_pool_transition");
          }

          for (const memberRide of memberRides) {
            const updatedRideResult = await transactionClient.query<{
              id: string;
            }>(
              `UPDATE ride_requests
               SET status = $2
               WHERE id = $1
                 AND status = $3
               RETURNING id`,
              [
                memberRide.ride_request_id,
                input.targetStatus,
                input.expectedStatus,
              ],
            );

            if (!updatedRideResult.rows[0]) {
              throw new PoolTransitionAbort("pool_ride_state_mismatch");
            }

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
                createStatusEventId(),
                memberRide.ride_request_id,
                updatedPool.id,
                input.driverUserId,
                input.expectedStatus,
                input.targetStatus,
              ],
            );
          }

          const occupiedSeats = memberRides.reduce(
            (total, memberRide) => total + memberRide.seats_reserved,
            0,
          );

          return {
            kind: "transitioned",
            transition: {
              pool: {
                id: updatedPool.id,
                status: updatedPool.status,
                pickupZone: updatedPool.pickup_zone,
                capacity: updatedPool.capacity_snapshot,
                occupiedSeats,
                availableSeats: updatedPool.capacity_snapshot - occupiedSeats,
                startedAt: updatedPool.started_at,
                completedAt: updatedPool.completed_at,
              },
              transitionedRideIds: memberRides.map(
                (memberRide) => memberRide.ride_request_id,
              ),
            },
          };
        });
      } catch (error) {
        if (error instanceof PoolTransitionAbort) {
          return { kind: error.kind };
        }

        throw error;
      }
    },
  };
}

class PoolTransitionAbort extends Error {
  constructor(
    readonly kind: Extract<
      PoolLifecycleOutcome,
      { kind: "invalid_pool_transition" | "pool_ride_state_mismatch" }
    >["kind"],
  ) {
    super(kind);
  }
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

function mapActivePool(rows: ActivePoolRow[]): DriverActivePool | null {
  const pool = rows[0];

  if (!pool) {
    return null;
  }

  const members = rows.flatMap((row) => {
    if (
      !row.ride_request_id ||
      !row.passenger_name ||
      !row.member_pickup_zone ||
      !row.member_destination_zone ||
      row.seats_reserved === null ||
      row.fare_poysha === null
    ) {
      return [];
    }

    return [
      {
        rideId: row.ride_request_id,
        passengerName: row.passenger_name,
        pickupZone: row.member_pickup_zone,
        destinationZone: row.member_destination_zone,
        seatsReserved: row.seats_reserved,
        farePoysha: row.fare_poysha,
      },
    ];
  });

  return {
    id: pool.pool_id,
    status: pool.pool_status,
    pickupZone: pool.pickup_zone,
    vehicle: {
      name: pool.vehicle_name,
      capacity: pool.vehicle_capacity,
    },
    occupiedSeats: members.reduce(
      (total, member) => total + member.seatsReserved,
      0,
    ),
    members,
  };
}
