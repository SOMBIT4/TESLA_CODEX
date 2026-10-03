import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "tests/pool.db.integration.ts",
      "tests/driver-profile.db.integration.ts",
    ],
  },
});
