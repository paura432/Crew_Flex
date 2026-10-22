import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["node_modules", "supabase/functions/**"],
    testTimeout: 20_000,
    // PGlite applies every migration in `beforeAll` (tests/db): ~25 files now, and a loaded machine (builds,
    // browsers) pushed it past the 10 s default, which skipped the whole RLS suite.
    hookTimeout: 120_000,
  },
});
