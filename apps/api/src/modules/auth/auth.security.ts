import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../../config/env.js";
import { USER_ROLES, type AuthIdentity, type UserRole } from "./auth.types.js";

const bcryptRounds = 10;

export const AUTH_COOKIE_NAME = "auth_token";

export interface AuthCookieOptions {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
}

interface AuthTokenClaims {
  sub: string;
  role: UserRole;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, bcryptRounds);
}

export async function comparePassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function signAuthToken(identity: AuthIdentity): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  };

  return jwt.sign(
    {
      sub: identity.userId,
      role: identity.role,
    },
    env.JWT_SECRET,
    options,
  );
}

export function verifyAuthToken(token: string): AuthIdentity {
  const claims = jwt.verify(token, env.JWT_SECRET);

  if (!isAuthTokenClaims(claims)) {
    throw new Error("Invalid authentication token.");
  }

  return {
    userId: claims.sub,
    role: claims.role,
  };
}

export function getAuthCookieOptions(): AuthCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
  };
}

function isAuthTokenClaims(
  value: string | jwt.JwtPayload,
): value is AuthTokenClaims {
  return (
    typeof value === "object" &&
    typeof value.sub === "string" &&
    typeof value.role === "string" &&
    USER_ROLES.includes(value.role as UserRole)
  );
}
