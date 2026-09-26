import { describe, expect, it, vi } from "vitest";
import {
  createAuthRepository,
  type AuthQueryClient,
} from "../src/modules/auth/auth.repository.js";

const storedRow = {
  id: "user-1",
  name: "Nusrat",
  email: "nusrat@example.com",
  password_hash: "$2b$10$hash",
  role: "PASSENGER",
  created_at: "2026-09-26T00:00:00.000Z",
};

function createQueryClient(rows = [storedRow]): AuthQueryClient & {
  query: ReturnType<typeof vi.fn>;
} {
  return {
    query: vi.fn().mockResolvedValue({ rows }),
  };
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
});
