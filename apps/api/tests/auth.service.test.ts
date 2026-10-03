import { describe, expect, it } from "vitest";
import type {
  AuthRepository,
  CreateDriverInput,
  CreatePassengerInput,
} from "../src/modules/auth/auth.repository.js";
import { createAuthService } from "../src/modules/auth/auth.service.js";
import type { AuthUserRecord } from "../src/modules/auth/auth.types.js";

const passenger: AuthUserRecord = {
  id: "user-1",
  name: "Nusrat",
  email: "nusrat@example.com",
  passwordHash: "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro0MGG4w6VqvS1hO5Q/2YdJ5m",
  role: "PASSENGER",
  phoneNumber: null,
  createdAt: "2026-09-26T00:00:00.000Z",
};

function createRepository(
  overrides: Partial<AuthRepository> = {},
): AuthRepository & {
  created?: CreatePassengerInput;
  createdDriver?: CreateDriverInput;
} {
  const repository: AuthRepository & {
    created?: CreatePassengerInput;
    createdDriver?: CreateDriverInput;
  } = {
    findByEmail: async () => passenger,
    findById: async () => passenger,
    updateProfile: async (_id, input) => ({ ...passenger, ...input }),
    createPassenger: async (input) => {
      repository.created = input;
      return { ...passenger, ...input, passwordHash: input.passwordHash };
    },
    createDriver: async (input) => {
      repository.createdDriver = input;
      return {
        ...passenger,
        id: input.id,
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        role: "DRIVER",
      };
    },
    ...overrides,
  };

  return repository;
}

describe("auth service", () => {
  it("hashes registration passwords and always creates passengers", async () => {
    const repository = createRepository();
    const service = createAuthService(repository);

    const result = await service.register({
      name: "Nusrat",
      email: "nusrat@example.com",
      password: "demo-pass-123",
    });

    expect(repository.created?.passwordHash).not.toBe("demo-pass-123");
    expect(repository.created?.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(result.user).toMatchObject({
      email: "nusrat@example.com",
      role: "PASSENGER",
    });
    expect(result.user.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(result.user).not.toHaveProperty("passwordHash");
    expect(result.token).toEqual(expect.any(String));
  });

  it("creates a driver with an offline vehicle profile", async () => {
    const repository = createRepository();
    const service = createAuthService(repository);

    const result = await service.register({
      name: "Jashim",
      email: "jashim@example.com",
      password: "demo-pass-123",
      role: "DRIVER",
      vehicleName: "Bullet",
      vehicleCapacity: 3,
    });

    expect(repository.createdDriver).toMatchObject({
      name: "Jashim",
      email: "jashim@example.com",
      driverId: expect.any(String),
      vehicleId: expect.any(String),
      vehicleName: "Bullet",
      vehicleCapacity: 3,
    });
    expect(result.user).toMatchObject({
      email: "jashim@example.com",
      role: "DRIVER",
    });
    expect(result.user).not.toHaveProperty("isOnline");
  });

  it("maps a duplicate normalized email to a stable conflict error", async () => {
    const repository = createRepository({
      createPassenger: async () => {
        throw { code: "23505" };
      },
    });
    const service = createAuthService(repository);

    await expect(
      service.register({
        name: "Nusrat",
        email: "nusrat@example.com",
        password: "demo-pass-123",
      }),
    ).rejects.toMatchObject({
      code: "EMAIL_ALREADY_REGISTERED",
      statusCode: 409,
    });
  });

  it("returns the same invalid-credentials error for unknown and wrong passwords", async () => {
    const unknownService = createAuthService(
      createRepository({ findByEmail: async () => null }),
    );
    const wrongPasswordService = createAuthService(createRepository());

    const unknownError = await unknownService
      .login({ email: "unknown@example.com", password: "demo-pass-123" })
      .catch((error: unknown) => error);
    const wrongPasswordError = await wrongPasswordService
      .login({ email: "nusrat@example.com", password: "wrong-pass-123" })
      .catch((error: unknown) => error);

    expect(unknownError).toMatchObject({
      code: "INVALID_CREDENTIALS",
      statusCode: 401,
    });
    expect(wrongPasswordError).toMatchObject({
      code: "INVALID_CREDENTIALS",
      statusCode: 401,
    });
    expect((unknownError as { message: string }).message).toBe(
      (wrongPasswordError as { message: string }).message,
    );
  });

  it("rejects a deleted current user as unauthenticated", async () => {
    const service = createAuthService(
      createRepository({ findById: async () => null }),
    );

    await expect(service.getCurrentUser("deleted-user")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      statusCode: 401,
    });
  });

  it("includes the current phone number in the public profile", async () => {
    const service = createAuthService(
      createRepository({
        findById: async () => ({
          ...passenger,
          phoneNumber: "+8801712345678",
        }),
      }),
    );

    await expect(service.getCurrentUser("user-1")).resolves.toMatchObject({
      name: "Nusrat",
      phoneNumber: "+8801712345678",
    });
  });
});
