import { db } from "../../db/pool.js";
import { withTransaction, type TransactionPool } from "../../db/transaction.js";
import type { AuthUserRecord, UserRole } from "./auth.types.js";

const userColumns = "id, name, email, password_hash, role, created_at";

interface AuthUserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: string;
  created_at: Date | string;
}

export interface AuthQueryClient {
  query<T = AuthUserRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: T[] }>;
}

export interface CreatePassengerInput {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
}

export interface CreateDriverInput extends CreatePassengerInput {
  driverId: string;
  vehicleId: string;
  vehicleName: string;
  vehicleCapacity: number;
}

export interface AuthRepository {
  findByEmail(email: string): Promise<AuthUserRecord | null>;
  findById(id: string): Promise<AuthUserRecord | null>;
  createPassenger(input: CreatePassengerInput): Promise<AuthUserRecord>;
  createDriver(input: CreateDriverInput): Promise<AuthUserRecord>;
}

export function createAuthRepository(
  client: AuthQueryClient = db as unknown as AuthQueryClient,
  transactionPool: TransactionPool = db,
): AuthRepository {
  return {
    async findByEmail(email) {
      const result = await client.query<AuthUserRow>(
        `SELECT ${userColumns}
         FROM users
         WHERE email = $1`,
        [email],
      );

      return result.rows[0] ? mapUserRow(result.rows[0]) : null;
    },

    async findById(id) {
      const result = await client.query<AuthUserRow>(
        `SELECT ${userColumns}
         FROM users
         WHERE id = $1`,
        [id],
      );

      return result.rows[0] ? mapUserRow(result.rows[0]) : null;
    },

    async createPassenger(input) {
      const result = await client.query<AuthUserRow>(
        `INSERT INTO users (id, name, email, password_hash, role)
         VALUES ($1, $2, $3, $4, 'PASSENGER')
         RETURNING ${userColumns}`,
        [input.id, input.name, input.email, input.passwordHash],
      );

      return mapUserRow(result.rows[0]);
    },

    async createDriver(input) {
      return withTransaction(async (transactionClient) => {
        const userResult = await transactionClient.query<AuthUserRow>(
          `INSERT INTO users (id, name, email, password_hash, role)
           VALUES ($1, $2, $3, $4, 'DRIVER')
           RETURNING ${userColumns}`,
          [input.id, input.name, input.email, input.passwordHash],
        );

        await transactionClient.query(
          `INSERT INTO drivers (id, user_id)
           VALUES ($1, $2)`,
          [input.driverId, input.id],
        );

        await transactionClient.query(
          `INSERT INTO vehicles (id, driver_id, name, capacity, is_active)
           VALUES ($1, $2, $3, $4, TRUE)`,
          [input.vehicleId, input.driverId, input.vehicleName, input.vehicleCapacity],
        );

        return mapUserRow(userResult.rows[0]);
      }, transactionPool);
    },
  };
}

function mapUserRow(row: AuthUserRow): AuthUserRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role as UserRole,
    createdAt: row.created_at,
  };
}
