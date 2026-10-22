import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "tmp/**",
    // Agent worktrees (Claude Code `isolation: worktree`) are other checkouts, linted in their own tree.
    ".claude/worktrees/**",
    "next-env.d.ts",
    // Deno code: checked with `deno check` / `deno lint`.
    "supabase/functions/**",
  ]),
]);
