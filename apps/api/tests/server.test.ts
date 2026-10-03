import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { listen } = vi.hoisted(() => ({ listen: vi.fn() }));

vi.mock("../src/app.js", () => ({
  createApp: () => ({ listen }),
}));

describe("API server startup", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    listen.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("prefers Render's PORT over API_PORT", async () => {
    vi.stubEnv("PORT", "10000");
    vi.stubEnv("API_PORT", "4000");

    const { env } = await import("../src/config/env.js");

    expect(env.API_PORT).toBe(10000);
  });

  it("falls back to API_PORT when PORT is not set", async () => {
    vi.stubEnv("PORT", undefined);
    vi.stubEnv("API_PORT", "4100");

    const { env } = await import("../src/config/env.js");

    expect(env.API_PORT).toBe(4100);
  });

  it("binds the HTTP server to all network interfaces", async () => {
    vi.stubEnv("PORT", "10000");
    vi.stubEnv("API_PORT", "4000");

    await import("../src/server.js");

    expect(listen).toHaveBeenCalledWith(
      10000,
      "0.0.0.0",
      expect.any(Function),
    );
  });
});
