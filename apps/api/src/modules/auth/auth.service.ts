import { randomUUID } from "node:crypto";
import { AppError } from "../../shared/errors/AppError.js";
import {
  comparePassword,
  hashPassword,
  signAuthToken,
} from "./auth.security.js";
import {
  createAuthRepository,
  type AuthRepository,
} from "./auth.repository.js";
import type { LoginInput, RegisterInput } from "./auth.schema.js";
import type { AuthSession, AuthUserRecord, PublicUser } from "./auth.types.js";

export interface AuthSecurity {
  hashPassword(password: string): Promise<string>;
  comparePassword(password: string, passwordHash: string): Promise<boolean>;
  signAuthToken(identity: {
    userId: string;
    role: AuthUserRecord["role"];
  }): string;
}

export interface AuthService {
  register(input: RegisterInput): Promise<AuthSession>;
  login(input: LoginInput): Promise<AuthSession>;
  getCurrentUser(userId: string): Promise<PublicUser>;
}

const defaultSecurity: AuthSecurity = {
  hashPassword,
  comparePassword,
  signAuthToken,
};

export function createAuthService(
  repository: AuthRepository = createAuthRepository(),
  security: AuthSecurity = defaultSecurity,
): AuthService {
  return {
    async register(input) {
      const passwordHash = await security.hashPassword(input.password);

      try {
        const user =
          input.role === "DRIVER"
            ? await createDriver(repository, input, passwordHash)
            : await repository.createPassenger({
                id: randomUUID(),
                name: input.name,
                email: input.email,
                passwordHash,
              });

        return createSession(user, security);
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError(
            "EMAIL_ALREADY_REGISTERED",
            "Email is already registered.",
            409,
          );
        }

        throw error;
      }
    },

    async login(input) {
      const user = await repository.findByEmail(input.email);

      if (
        !user ||
        !(await security.comparePassword(input.password, user.passwordHash))
      ) {
        throw new AppError(
          "INVALID_CREDENTIALS",
          "Invalid email or password.",
          401,
        );
      }

      return createSession(user, security);
    },

    async getCurrentUser(userId) {
      const user = await repository.findById(userId);

      if (!user) {
        throw new AppError("UNAUTHENTICATED", "Authentication required.", 401);
      }

      return toPublicUser(user);
    },
  };
}

async function createDriver(
  repository: AuthRepository,
  input: RegisterInput,
  passwordHash: string,
): Promise<AuthUserRecord> {
  if (!input.vehicleName || input.vehicleCapacity === undefined) {
    throw new AppError(
      "INVALID_DRIVER_REGISTRATION",
      "Vehicle name and capacity are required for driver registration.",
      400,
    );
  }

  return repository.createDriver({
    id: randomUUID(),
    name: input.name,
    email: input.email,
    passwordHash,
    driverId: randomUUID(),
    vehicleId: randomUUID(),
    vehicleName: input.vehicleName,
    vehicleCapacity: input.vehicleCapacity,
  });
}

function createSession(
  user: AuthUserRecord,
  security: AuthSecurity,
): AuthSession {
  return {
    user: toPublicUser(user),
    token: security.signAuthToken({ userId: user.id, role: user.role }),
  };
}

function toPublicUser(user: AuthUserRecord): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}
