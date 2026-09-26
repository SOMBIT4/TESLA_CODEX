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

describe("authentication documentation", () => {
  it("documents the auth endpoints, cookie session, and demo passenger", () => {
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
    expect(projectStatus).toContain(
      "The passenger-auth feature branch is implemented",
    );
    expect(projectStatus).toContain("feature/ride-request");
  });
});
