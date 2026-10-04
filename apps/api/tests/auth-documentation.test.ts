import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readme = readFileSync(
  new URL("../../../README.md", import.meta.url),
  "utf8",
);
const projectStatus = readFileSync(
  new URL("../../../docs/PROJECT_STATUS.md", import.meta.url),
  "utf8",
);

describe("authentication, ride, driver, pool, and passenger documentation", () => {
  it("documents driver pooling, passenger UI, and verification", () => {
    expect(readme).toContain("POST /api/auth/register");
    expect(readme).toContain("POST /api/auth/login");
    expect(readme).toContain("POST /api/auth/logout");
    expect(readme).toContain("GET  /api/auth/me");
    expect(readme).toMatch(/HttpOnly.*auth_token|auth_token.*HttpOnly/is);
    expect(readme).toContain("nusrat@example.com");
    expect(readme).not.toContain(
      "JWT_SECRET=replace-with-a-local-development-secret",
    );
    expect(readme).not.toContain("password_hash");
    expect(readme).toContain("POST /api/rides/estimate");
    expect(readme).toContain("POST /api/rides/:rideId/cancel");
    expect(readme).toContain("GET  /api/driver/me");
    expect(readme).toContain("POST /api/driver/status");
    expect(readme).toContain("GET  /api/driver/requests");
    expect(readme).toContain("GET  /api/driver/pools/active");
    expect(readme).toContain("GET  /api/driver/history");
    expect(readme).toContain("POST /api/driver/requests/:rideId/accept");
    expect(readme).toContain("POST /api/driver/pools/:poolId/arrive");
    expect(readme).toContain("POST /api/driver/pools/:poolId/start");
    expect(readme).toContain(
      "POST /api/driver/pools/:poolId/rides/:rideId/drop-off",
    );
    expect(readme).toContain("POST /api/driver/pools/:poolId/complete");
    expect(readme).toContain("POOL_COMPLETION_REQUIRES_DROPOFF");
    expect(readme).toContain("whose ride status is not `COMPLETED`");
    expect(readme).toContain("completedAt");
    expect(readme).toContain("POOL_NOT_ACCEPTING");
    expect(readme).toContain("pnpm test:db");
    expect(readme).toMatch(/different pickup and destination zones/i);
    expect(readme).toContain("ROUTE_INCOMPATIBLE");
    expect(readme).toContain("POOL_MAX_DETOUR_PERCENT");
    expect(readme).toMatch(/capacity|available seats/i);
    expect(readme).toContain("POOL_TEST_DATABASE_URL");
    expect(readme).toContain("API_INTERNAL_URL");
    expect(readme).toContain("Estimated solo fare");
    expect(readme).toContain("## Driver Web Experience");
    expect(readme).toContain("visible tab");
    expect(readme).toContain("five seconds");
    expect(readme).toMatch(/passenger email or\s+passenger ID/);
    expect(readme).toMatch(/one coordinated hook/i);
    expect(readme).toContain("TanStack Query");
    expect(projectStatus).toContain("feature/per-rider-dropoff");
    expect(projectStatus).toContain(
      "feat(pool): add per-rider drop-off lifecycle",
    );
  });
});
