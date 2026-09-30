import { describe, expect, it } from "vitest";
import {
  loginSchema,
  registerSchema,
} from "../src/modules/auth/auth.schema.js";

describe("auth request schemas", () => {
  it("defaults registration to a passenger and strips unknown fields", () => {
    const result = registerSchema.safeParse({
      name: "  Nusrat  ",
      email: "  NUSRAT@EXAMPLE.COM ",
      password: "demo-pass-123",
      isAdmin: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        name: "Nusrat",
        email: "nusrat@example.com",
        password: "demo-pass-123",
        role: "PASSENGER",
      });
    }
  });

  it("accepts a driver registration with vehicle details", () => {
    const result = registerSchema.safeParse({
      name: " Jashim ",
      email: " JASHIM@EXAMPLE.COM ",
      password: "demo-pass-123",
      role: "DRIVER",
      vehicleName: " Bullet ",
      vehicleCapacity: 3,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        name: "Jashim",
        email: "jashim@example.com",
        password: "demo-pass-123",
        role: "DRIVER",
        vehicleName: "Bullet",
        vehicleCapacity: 3,
      });
    }
  });

  it("requires vehicle details for driver registration", () => {
    expect(
      registerSchema.safeParse({
        name: "Jashim",
        email: "jashim@example.com",
        password: "demo-pass-123",
        role: "DRIVER",
      }).success,
    ).toBe(false);
  });

  it("limits a driver vehicle to between one and four seats", () => {
    const driver = (vehicleCapacity: number) =>
      registerSchema.safeParse({
        name: "Jashim",
        email: "jashim@example.com",
        password: "demo-pass-123",
        role: "DRIVER",
        vehicleName: "Bullet",
        vehicleCapacity,
      }).success;

    expect(driver(1)).toBe(true);
    expect(driver(4)).toBe(true);
    expect(driver(0)).toBe(false);
    expect(driver(5)).toBe(false);
    expect(driver(8)).toBe(false);
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
