import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("API build configuration", () => {
  it("does not enable TypeScript-only imports for an emitting build", () => {
    const config = JSON.parse(
      readFileSync(new URL("../tsconfig.json", import.meta.url), "utf8"),
    ) as { compilerOptions?: { allowImportingTsExtensions?: boolean } };

    expect(config.compilerOptions?.allowImportingTsExtensions).not.toBe(true);
  });
});
