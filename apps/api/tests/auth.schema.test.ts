import { describe, expect, it } from "vitest";
import {
  loginSchema,
  registerSchema,
} from "../src/modules/auth/auth.schema.js";

describe("auth request schemas", () => {
  it("normalizes registration input and strips privilege fields", () => {
    const result = registerSchema.safeParse({
      name: "  Nusrat  ",
      email: "  NUSRAT@EXAMPLE.COM ",
      password: "demo-pass-123",
      role: "DRIVER",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        name: "Nusrat",
        email: "nusrat@example.com",
        password: "demo-pass-123",
      });
    }
  });

  it("rejects registration values outside the documented limits", () => {
    expect(
      registerSchema.safeParse({
        name: "N",
        email: "not-an-email",
        password: "short",
      }).success,
    ).toBe(false);

    expect(
      registerSchema.safeParse({
        name: "Valid Name",
        email: "valid@example.com",
        password: "a".repeat(73),
      }).success,
    ).toBe(false);
  });

  it("normalizes login email without accepting an invalid email", () => {
    const result = loginSchema.safeParse({
      email: "  NUSRAT@EXAMPLE.COM ",
      password: "demo-pass-123",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("nusrat@example.com");
    }

    expect(
      loginSchema.safeParse({
        email: "not-an-email",
        password: "demo-pass-123",
      }).success,
    ).toBe(false);
  });
});
