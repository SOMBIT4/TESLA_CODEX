import { db } from "../../db/pool.js";
import { withTransaction } from "../../db/transaction.js";
import type {
  CancelRequestedRideInput,
  CreateRideRecordInput,
  RideRecord,
  RideStatus,
} from "./ride.types.js";

const rideColumns = `
  id,
  passenger_id,
  pickup_zone,
  destination_zone,
  seats_requested,
  status,
  estimated_fare_poysha,
  created_at,
  cancelled_at,
  completed_at`;

interface RideRow {
  id: string;
  passenger_id: string;
  pickup_zone: RideRecord["pickupZone"];
  destination_zone: RideRecord["destinationZone"];
  seats_requested: number;
  status: string;
  estimated_fare_poysha: number;
  created_at: Date | string;
  cancelled_at: Date | string | null;
  completed_at: Date | string | null;
}

export interface RideQueryClient {
  query<T = unknown>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: T[] }>;
}

export type RideTransactionRunner = <T>(
  callback: (client: RideQueryClient) => Promise<T>,
) => Promise<T>;

export interface RideRepository {
  create(input: CreateRideRecordInput): Promise<RideRecord>;
  findOwnedById(
    rideId: string,
    passengerId: string,
  ): Promise<RideRecord | null>;
  listForPassenger(passengerId: string): Promise<RideRecord[]>;
  cancelRequestedRide(
    input: CancelRequestedRideInput,
  ): Promise<RideRecord | null>;
}

const defaultTransactionRunner: RideTransactionRunner = (callback) =>
  withTransaction((client) => callback(client as unknown as RideQueryClient));

export function createRideRepository(
  client: RideQueryClient = db as unknown as RideQueryClient,
  runInTransaction: RideTransactionRunner = defaultTransactionRunner,
): RideRepository {
  return {
    async create(input) {
      const result = await client.query<RideRow>(
        `INSERT INTO ride_requests (
           id,
           passenger_id,
           pickup_zone,
           destination_zone,
           seats_requested,
           status,
           estimated_fare_poysha
         )
         VALUES ($1, $2, $3, $4, $5, 'REQUESTED', $6)
         RETURNING ${rideColumns}`,
        [
          input.id,
          input.passengerId,
          input.pickupZone,
          input.destinationZone,
          input.seatsRequested,
          input.estimatedFarePoysha,
        ],
      );

      return mapRideRow(result.rows[0]);
    },

    async findOwnedById(rideId, passengerId) {
      const result = await client.query<RideRow>(
        `SELECT ${rideColumns}
         FROM ride_requests
         WHERE id = $1
           AND passenger_id = $2`,
        [rideId, passengerId],
      );

      return result.rows[0] ? mapRideRow(result.rows[0]) : null;
    },

    async listForPassenger(passengerId) {
      const result = await client.query<RideRow>(
        `SELECT ${rideColumns}
         FROM ride_requests
         WHERE passenger_id = $1
         ORDER BY created_at DESC, id DESC`,
        [passengerId],
      );

      return result.rows.map(mapRideRow);
    },

    async cancelRequestedRide(input) {
      return runInTransaction(async (transactionClient) => {
        const result = await transactionClient.query<RideRow>(
          `UPDATE ride_requests
           SET status = 'CANCELLED',
               cancelled_at = NOW()
           WHERE id = $1
             AND passenger_id = $2
             AND status = 'REQUESTED'
           RETURNING ${rideColumns}`,
          [input.rideId, input.passengerId],
        );
        const row = result.rows[0];

        if (!row) {
          return null;
        }

        await transactionClient.query(
          `INSERT INTO ride_status_events (
             id,
             ride_request_id,
             actor_user_id,
             from_status,
             to_status
           )
           VALUES ($1, $2, $3, $4, $5)`,
          [
            input.statusEventId,
            input.rideId,
            input.passengerId,
            "REQUESTED",
            "CANCELLED",
          ],
        );

        return mapRideRow(row);
      });
    },
  };
}

function mapRideRow(row: RideRow): RideRecord {
  return {
    id: row.id,
    passengerId: row.passenger_id,
    pickupZone: row.pickup_zone,
    destinationZone: row.destination_zone,
    seatsRequested: row.seats_requested,
    status: row.status as RideStatus,
    estimatedFarePoysha: row.estimated_fare_poysha,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at,
    completedAt: row.completed_at,
  };
}
