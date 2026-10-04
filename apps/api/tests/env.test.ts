import { afterEach, describe, expect, it, vi } from "vitest";

const originalValue = process.env.POOL_MAX_DETOUR_PERCENT;

afterEach(() => {
  if (originalValue === undefined) {
    delete process.env.POOL_MAX_DETOUR_PERCENT;
  } else {
    process.env.POOL_MAX_DETOUR_PERCENT = originalValue;
  }
  vi.resetModules();
});

async function loadEnv(value: string | undefined) {
  if (value === undefined) {
    delete process.env.POOL_MAX_DETOUR_PERCENT;
  } else {
    process.env.POOL_MAX_DETOUR_PERCENT = value;
  }

  vi.resetModules();
  return import("../src/config/env.js");
}

describe("pool detour configuration", () => {
  it("defaults the maximum pool detour to 35 percent", async () => {
    const { env } = await loadEnv(undefined);

    expect(env.POOL_MAX_DETOUR_PERCENT).toBe(35);
  });

  it("accepts an integer override from 0 through 100", async () => {
    const { env } = await loadEnv("42");

    expect(env.POOL_MAX_DETOUR_PERCENT).toBe(42);
  });

  it.each(["", "35.5", "-1", "101"])(
    "rejects invalid detour configuration %j at startup",
    async (value) => {
      await expect(loadEnv(value)).rejects.toThrow();
    },
  );
});
