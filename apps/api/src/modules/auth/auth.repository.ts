import { db } from "../../db/pool.js";
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

export interface AuthRepository {
  findByEmail(email: string): Promise<AuthUserRecord | null>;
  findById(id: string): Promise<AuthUserRecord | null>;
  createPassenger(input: CreatePassengerInput): Promise<AuthUserRecord>;
}

export function createAuthRepository(
  client: AuthQueryClient = db as unknown as AuthQueryClient,
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
