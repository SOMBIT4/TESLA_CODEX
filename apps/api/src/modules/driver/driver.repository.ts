import { db } from "../../db/pool.js";
import type { DriverSnapshot, WaitingRide } from "./driver.types.js";

interface DriverSnapshotRow {
  driver_id: string;
  is_online: boolean;
  updated_at: Date | string;
  vehicle_id: string | null;
  vehicle_name: string | null;
  vehicle_capacity: number | null;
  vehicle_is_active: boolean | null;
}

interface WaitingRideRow {
  id: string;
  pickup_zone: WaitingRide["pickupZone"];
  destination_zone: WaitingRide["destinationZone"];
  seats_requested: number;
  estimated_fare_poysha: number;
  created_at: Date | string;
}

export interface DriverQueryClient {
  query<T = unknown>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: T[] }>;
}

export interface DriverRepository {
  findSnapshot(userId: string): Promise<DriverSnapshot | null>;
  setOnlineStatusIfAllowed(
    userId: string,
    isOnline: boolean,
  ): Promise<DriverSnapshot | null>;
  listRequestedRides(): Promise<WaitingRide[]>;
}

export function createDriverRepository(
  client: DriverQueryClient = db as unknown as DriverQueryClient,
): DriverRepository {
  return {
    async findSnapshot(userId) {
      const result = await client.query<DriverSnapshotRow>(
        `SELECT d.id AS driver_id,
                d.is_online,
                d.updated_at,
                v.id AS vehicle_id,
                v.name AS vehicle_name,
                v.capacity AS vehicle_capacity,
                v.is_active AS vehicle_is_active
         FROM drivers AS d
         LEFT JOIN vehicles AS v
           ON v.driver_id = d.id
          AND v.is_active = TRUE
         WHERE d.user_id = $1`,
        [userId],
      );

      return result.rows[0] ? mapSnapshotRow(result.rows[0]) : null;
    },

    async setOnlineStatusIfAllowed(userId, isOnline) {
      const result = await client.query<DriverSnapshotRow>(
        `WITH updated_driver AS (
           UPDATE drivers AS d
           SET is_online = $2::boolean,
               updated_at = NOW()
           WHERE d.user_id = $1
             AND ($2::boolean = FALSE OR EXISTS (
               SELECT 1
               FROM vehicles AS v
               WHERE v.driver_id = d.id
                 AND v.is_active = TRUE
             ))
           RETURNING d.id, d.is_online, d.updated_at
         )
         SELECT u.id AS driver_id,
                u.is_online,
                u.updated_at,
                v.id AS vehicle_id,
                v.name AS vehicle_name,
                v.capacity AS vehicle_capacity,
                v.is_active AS vehicle_is_active
         FROM updated_driver AS u
         LEFT JOIN vehicles AS v
           ON v.driver_id = u.id
          AND v.is_active = TRUE`,
        [userId, isOnline],
      );

      return result.rows[0] ? mapSnapshotRow(result.rows[0]) : null;
    },

    async listRequestedRides() {
      const result = await client.query<WaitingRideRow>(
        `SELECT id,
                pickup_zone,
                destination_zone,
                seats_requested,
                estimated_fare_poysha,
                created_at
         FROM ride_requests
         WHERE status = 'REQUESTED'
         ORDER BY created_at ASC, id ASC
         LIMIT 50`,
      );

      return result.rows.map(mapWaitingRideRow);
    },
  };
}

function mapSnapshotRow(row: DriverSnapshotRow): DriverSnapshot {
  return {
    driverId: row.driver_id,
    isOnline: row.is_online,
    updatedAt: row.updated_at,
    vehicle: row.vehicle_id
      ? {
          id: row.vehicle_id,
          name: row.vehicle_name ?? "",
          capacity: row.vehicle_capacity ?? 0,
          isActive: row.vehicle_is_active === true,
        }
      : null,
  };
}

function mapWaitingRideRow(row: WaitingRideRow): WaitingRide {
  return {
    id: row.id,
    pickupZone: row.pickup_zone,
    destinationZone: row.destination_zone,
    seatsRequested: row.seats_requested,
    estimatedFarePoysha: row.estimated_fare_poysha,
    createdAt: row.created_at,
  };
}
