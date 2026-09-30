import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type {
  AuthRepository,
  CreateDriverInput,
  CreatePassengerInput,
} from "../src/modules/auth/auth.repository.js";
import { createAuthService } from "../src/modules/auth/auth.service.js";
import type { AuthUserRecord } from "../src/modules/auth/auth.types.js";

function createAuthTestContext() {
  const users = new Map<string, AuthUserRecord>();

  const repository: AuthRepository = {
    async findByEmail(email) {
      return [...users.values()].find((user) => user.email === email) ?? null;
    },
    async findById(id) {
      return users.get(id) ?? null;
    },
    async createPassenger(input: CreatePassengerInput) {
      if ([...users.values()].some((user) => user.email === input.email)) {
        throw { code: "23505" };
      }

      const user: AuthUserRecord = {
        id: input.id,
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        role: "PASSENGER",
        createdAt: new Date().toISOString(),
      };
      users.set(user.id, user);
      return user;
    },
    async createDriver(input: CreateDriverInput) {
      if ([...users.values()].some((user) => user.email === input.email)) {
        throw { code: "23505" };
      }

      const user: AuthUserRecord = {
        id: input.id,
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        role: "DRIVER",
        createdAt: new Date().toISOString(),
      };
      users.set(user.id, user);
      return user;
    },
  };

  return {
    app: createApp({ authService: createAuthService(repository) }),
    deleteUser: (id: string) => users.delete(id),
  };
}

const registration = {
  name: "Nusrat",
  email: "nusrat@example.com",
  password: "demo-pass-123",
};

describe("passenger authentication endpoints", () => {
  it("registers a passenger and sets an HttpOnly auth cookie", async () => {
    const { app } = createAuthTestContext();

    const response = await request(app)
      .post("/api/auth/register")
      .send(registration);

    expect(response.status).toBe(201);
    expect(response.body.data.user).toMatchObject({
      name: "Nusrat",
      email: "nusrat@example.com",
      role: "PASSENGER",
    });
    expect(response.body.data.user).not.toHaveProperty("passwordHash");
    expect(response.body.data.user).not.toHaveProperty("password");
    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/auth_token=.*HttpOnly/i),
        expect.stringMatching(/SameSite=Lax/i),
      ]),
    );
  });

  it("registers a driver with a vehicle and allows that role to log in", async () => {
    const { app } = createAuthTestContext();

    const registered = await request(app)
      .post("/api/auth/register")
      .send({
        ...registration,
        name: "Jashim",
        email: "jashim@example.com",
        role: "DRIVER",
        vehicleName: "Bullet",
        vehicleCapacity: 3,
      });

    expect(registered.status).toBe(201);
    expect(registered.body.data.user).toMatchObject({
      name: "Jashim",
      email: "jashim@example.com",
      role: "DRIVER",
    });

    const loggedIn = await request(app)
      .post("/api/auth/login")
      .send({ email: "jashim@example.com", password: registration.password });

    expect(loggedIn.status).toBe(200);
    expect(loggedIn.body.data.user.role).toBe("DRIVER");
  });

  it("rejects duplicate normalized emails with a conflict", async () => {
    const { app } = createAuthTestContext();

    await request(app).post("/api/auth/register").send(registration);
    const response = await request(app)
      .post("/api/auth/register")
      .send({ ...registration, email: "  NUSRAT@EXAMPLE.COM " });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: {
        code: "EMAIL_ALREADY_REGISTERED",
        message: "Email is already registered.",
      },
    });
  });

  it("logs in with valid credentials and sets an auth cookie", async () => {
    const { app } = createAuthTestContext();

    await request(app).post("/api/auth/register").send(registration);
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: registration.email, password: registration.password });

    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe(registration.email);
    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringMatching(/auth_token=.*HttpOnly/i)]),
    );
  });

  it("uses one credential error for unknown emails and wrong passwords", async () => {
    const { app } = createAuthTestContext();

    await request(app).post("/api/auth/register").send(registration);
    const unknown = await request(app)
      .post("/api/auth/login")
      .send({ email: "unknown@example.com", password: registration.password });
    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ email: registration.email, password: "wrong-pass-123" });

    expect(unknown.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(unknown.body).toEqual(wrongPassword.body);
    expect(unknown.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("clears the cookie on repeatable logout", async () => {
    const { app } = createAuthTestContext();
    const agent = request.agent(app);

    await agent.post("/api/auth/register").send(registration);
    const loggedOut = await agent.post("/api/auth/logout");
    const loggedOutAgain = await request(app).post("/api/auth/logout");

    expect(loggedOut.status).toBe(200);
    expect(loggedOut.body).toEqual({ data: { loggedOut: true } });
    expect(loggedOut.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringMatching(/auth_token=;/i)]),
    );
    expect(loggedOutAgain.status).toBe(200);
  });

  it("returns only the authenticated public user and rejects deleted users", async () => {
    const context = createAuthTestContext();
    const agent = request.agent(context.app);

    const registered = await agent
      .post("/api/auth/register")
      .send(registration);
    const userId = registered.body.data.user.id as string;
    const current = await agent.get("/api/auth/me");

    expect(current.status).toBe(200);
    expect(current.body.data.user).toEqual(registered.body.data.user);
    expect(current.body.data.user).not.toHaveProperty("passwordHash");
    expect(current.body.data.user).not.toHaveProperty("password");

    context.deleteUser(userId);
    const deleted = await agent.get("/api/auth/me");

    expect(deleted.status).toBe(401);
    expect(deleted.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns a validation error for malformed input", async () => {
    const { app } = createAuthTestContext();

    const response = await request(app)
      .post("/api/auth/register")
      .send({ name: "N", email: "invalid", password: "short" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
