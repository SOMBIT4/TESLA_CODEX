import { describe, expect, it, vi } from "vitest";
import {
  createAuthRepository,
  type AuthQueryClient,
} from "../src/modules/auth/auth.repository.js";
import type { TransactionPool } from "../src/db/transaction.js";

const storedRow = {
  id: "user-1",
  name: "Nusrat",
  email: "nusrat@example.com",
  password_hash: "$2b$10$hash",
  role: "PASSENGER",
  phone_number: null as string | null,
  created_at: "2026-09-26T00:00:00.000Z",
};

const storedDriverRow = {
  ...storedRow,
  id: "driver-user-1",
  name: "Jashim",
  email: "jashim@example.com",
  role: "DRIVER",
};

function createQueryClient(rows = [storedRow]): AuthQueryClient & {
  query: ReturnType<typeof vi.fn>;
} {
  return {
    query: vi.fn().mockResolvedValue({ rows }),
  };
}

function createTransactionPool(failOnVehicle = false) {
  const transactionClient = {
    query: vi.fn().mockImplementation((text: string) => {
      if (text.includes("INSERT INTO users")) {
        return Promise.resolve({ rows: [storedDriverRow] });
      }

      if (failOnVehicle && text.includes("INSERT INTO vehicles")) {
        return Promise.reject({ code: "VEHICLE_INSERT_FAILED" });
      }

      return Promise.resolve({ rows: [] });
    }),
    release: vi.fn(),
  };
  const pool: TransactionPool = {
    connect: vi.fn().mockResolvedValue(transactionClient),
  };

  return { pool, transactionClient };
}

describe("auth repository", () => {
  it("finds a user by normalized email with a parameterized query", async () => {
    const client = createQueryClient();
    const repository = createAuthRepository(client);

    const user = await repository.findByEmail("nusrat@example.com");

    expect(client.query).toHaveBeenCalledWith(
      expect.stringMatching(/WHERE email = \$1/),
      ["nusrat@example.com"],
    );
    expect(user).toEqual({
      id: "user-1",
      name: "Nusrat",
      email: "nusrat@example.com",
      passwordHash: "$2b$10$hash",
      role: "PASSENGER",
      phoneNumber: null,
      createdAt: "2026-09-26T00:00:00.000Z",
    });
  });

  it("finds a user by id with a parameterized query", async () => {
    const client = createQueryClient();
    const repository = createAuthRepository(client);

    await repository.findById("user-1");

    expect(client.query).toHaveBeenCalledWith(
      expect.stringMatching(/WHERE id = \$1/),
      ["user-1"],
    );
  });

  it("maps the stored phone number on the current user lookup", async () => {
    const client = createQueryClient([
      { ...storedRow, phone_number: "+8801712345678" },
    ]);
    const repository = createAuthRepository(client);

    await expect(repository.findById("user-1")).resolves.toMatchObject({
      phoneNumber: "+8801712345678",
    });
  });

  it("updates only supplied profile fields using bound values", async () => {
    const client = createQueryClient([
      { ...storedRow, phone_number: null, name: "Nusrat" },
    ]);
    const repository = createAuthRepository(client);
    const updateProfile = (
      repository as unknown as {
        updateProfile?: (
          id: string,
          input: { name?: string; phoneNumber?: string | null },
        ) => Promise<unknown>;
      }
    ).updateProfile;

    expect(updateProfile).toBeTypeOf("function");
    if (!updateProfile) return;

    await updateProfile.call(repository, "user-1", {
      phoneNumber: null,
    });

    expect(client.query).toHaveBeenCalledWith(
      expect.stringMatching(/UPDATE users[\s\S]*phone_number[\s\S]*WHERE id = \$1/),
      ["user-1", null, true, null],
    );
  });

  it("creates a passenger with parameter values instead of SQL interpolation", async () => {
    const client = createQueryClient();
    const repository = createAuthRepository(client);
    const input = {
      id: "user-2",
      name: "Rafiq",
      email: "rafiq@example.com",
      passwordHash: "$2b$10$another-hash",
    };

    await repository.createPassenger(input);

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO users"),
      [input.id, input.name, input.email, input.passwordHash],
    );
    expect(client.query.mock.calls[0]?.[0]).toContain("'PASSENGER'");
    expect(client.query.mock.calls[0]?.[0]).not.toContain(input.email);
    expect(client.query.mock.calls[0]?.[0]).not.toContain(input.passwordHash);
  });

  it("creates a driver, profile, and active vehicle in one transaction", async () => {
    const client = createQueryClient();
    const { pool, transactionClient } = createTransactionPool();
    const repository = createAuthRepository(client, pool);
    const input = {
      id: "driver-user-1",
      name: "Jashim",
      email: "jashim@example.com",
      passwordHash: "$2b$10$driver-hash",
      driverId: "driver-1",
      vehicleId: "vehicle-1",
      vehicleName: "Bullet",
      vehicleCapacity: 3,
    };

    const user = await repository.createDriver(input);

    expect(user.role).toBe("DRIVER");
    expect(transactionClient.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(transactionClient.query).toHaveBeenLastCalledWith("COMMIT");
    expect(transactionClient.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO users"),
      [input.id, input.name, input.email, input.passwordHash],
    );
    expect(transactionClient.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO drivers"),
      [input.driverId, input.id],
    );
    expect(transactionClient.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO vehicles"),
      [input.vehicleId, input.driverId, input.vehicleName, input.vehicleCapacity],
    );
  });

  it("rolls back driver registration when vehicle setup fails", async () => {
    const client = createQueryClient();
    const { pool, transactionClient } = createTransactionPool(true);
    const repository = createAuthRepository(client, pool);

    await expect(
      repository.createDriver({
        id: "driver-user-1",
        name: "Jashim",
        email: "jashim@example.com",
        passwordHash: "$2b$10$driver-hash",
        driverId: "driver-1",
        vehicleId: "vehicle-1",
        vehicleName: "Bullet",
        vehicleCapacity: 3,
      }),
    ).rejects.toMatchObject({ code: "VEHICLE_INSERT_FAILED" });

    expect(transactionClient.query).toHaveBeenCalledWith("ROLLBACK");
    expect(transactionClient.release).toHaveBeenCalledOnce();
  });
});
