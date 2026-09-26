import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import {
  comparePassword,
  getAuthCookieOptions,
  hashPassword,
  signAuthToken,
  verifyAuthToken,
} from "../src/modules/auth/auth.security.js";

describe("auth security primitives", () => {
  it("stores passwords as bcrypt hashes and compares them safely", async () => {
    const password = "demo-pass-123";
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash).toMatch(/^\$2[aby]\$/);
    await expect(comparePassword(password, hash)).resolves.toBe(true);
    await expect(comparePassword("wrong-pass", hash)).resolves.toBe(false);
  });

  it("signs and verifies a token without password data", () => {
    const token = signAuthToken({ userId: "user-1", role: "PASSENGER" });

    expect(jwt.decode(token)).toMatchObject({
      sub: "user-1",
      role: "PASSENGER",
    });
    expect(jwt.decode(token)).not.toHaveProperty("passwordHash");
    expect(verifyAuthToken(token)).toEqual({
      userId: "user-1",
      role: "PASSENGER",
    });
  });

  it("rejects an expired token", () => {
    const token = jwt.sign(
      { sub: "user-1", role: "PASSENGER" },
      env.JWT_SECRET,
      { expiresIn: -1 },
    );

    expect(() => verifyAuthToken(token)).toThrow();
  });

  it("uses the documented local cookie security options", () => {
    expect(getAuthCookieOptions()).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    });
  });
});
