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

describe("authentication and ride documentation", () => {
  it("documents the auth session and passenger ride-request milestone", () => {
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
    expect(projectStatus).toContain(
      "The passenger ride-request feature branch is implemented",
    );
    expect(projectStatus).toContain("feature/driver-flow");
  });
});
