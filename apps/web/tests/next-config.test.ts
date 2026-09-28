import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalApiInternalUrl = process.env.API_INTERNAL_URL;
const originalPublicApiUrl = process.env.NEXT_PUBLIC_API_URL;

describe("Next API rewrite", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.API_INTERNAL_URL = "http://api.test:4000";
    process.env.NEXT_PUBLIC_API_URL = "https://public-api.example.com";
  });

  afterEach(() => {
    process.env.API_INTERNAL_URL = originalApiInternalUrl;
    process.env.NEXT_PUBLIC_API_URL = originalPublicApiUrl;
  });

  it("uses only the private internal API URL for browser API requests", async () => {
    const { default: nextConfig } = await import("../next.config.js");

    expect(nextConfig.rewrites).toBeTypeOf("function");
    await expect(nextConfig.rewrites?.()).resolves.toEqual([
      {
        source: "/api/:path*",
        destination: "http://api.test:4000/api/:path*",
      },
    ]);
  });
});
