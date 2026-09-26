import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Docker build context", () => {
  it("contains only build inputs required by the Docker images", () => {
    const dockerignore = readFileSync(
      new URL("../../../.dockerignore", import.meta.url),
      "utf8",
    );
    const apiDockerfile = readFileSync(
      new URL("../../../apps/api/Dockerfile", import.meta.url),
      "utf8",
    );
    const webDockerfile = readFileSync(
      new URL("../../../apps/web/Dockerfile", import.meta.url),
      "utf8",
    );

    expect(dockerignore).toContain("**/node_modules");
    expect(dockerignore).toContain("**/.next");
    expect(dockerignore).toContain("**/dist");
    expect(apiDockerfile).toContain("COPY tsconfig.base.json ./");
    expect(webDockerfile).toContain("COPY tsconfig.base.json ./");
  });
});
