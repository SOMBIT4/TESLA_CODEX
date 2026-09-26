import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { checkDatabaseHealth } from "../src/db/health.js";
import { withTransaction } from "../src/db/transaction.js";

vi.mock("../src/db/health.js", () => ({
  checkDatabaseHealth: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

function createFakeTransactionPool() {
  const queries: string[] = [];
  const client = {
    query: vi.fn(async (sql: string) => {
      queries.push(sql);
      return { rows: [], rowCount: 0 };
    }),
    release: vi.fn(),
  };
  const pool = {
    connect: vi.fn().mockResolvedValue(client),
  };

  return { client, pool, queries };
}

describe("database foundation", () => {
  it("commits and releases a transaction client after success", async () => {
    const { client, pool, queries } = createFakeTransactionPool();

    const result = await withTransaction(async (transactionClient) => {
      await transactionClient.query("SELECT 1");
      return "saved";
    }, pool);

    expect(result).toBe("saved");
    expect(queries).toEqual(["BEGIN", "SELECT 1", "COMMIT"]);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("rolls back and releases a transaction client after failure", async () => {
    const { client, pool, queries } = createFakeTransactionPool();
    const failure = new Error("write failed");

    await expect(
      withTransaction(async () => {
        throw failure;
      }, pool),
    ).rejects.toBe(failure);

    expect(queries).toEqual(["BEGIN", "ROLLBACK"]);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("reports a healthy database", async () => {
    vi.mocked(checkDatabaseHealth).mockResolvedValue(undefined);

    const response = await request(createApp()).get("/health/db");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: { status: "ok", service: "database" },
    });
  });

  it("returns a stable error when the database is unavailable", async () => {
    vi.mocked(checkDatabaseHealth).mockRejectedValue(new Error("offline"));

    const response = await request(createApp()).get("/health/db");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: "Database is unavailable.",
      },
    });
  });
});
