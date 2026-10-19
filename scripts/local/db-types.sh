#!/usr/bin/env bash
# db-types.sh — regenerate src/types/database.generated.ts from the LOCAL Docker stack (all local
# migrations applied). Never the production project (`pnpm db:types` targets it).
# Usage: pnpm db:types:local
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; cd "$REPO_ROOT"
OUT=src/types/database.generated.ts
raw="$(mktemp)"; trap 'rm -f "$raw"' EXIT
bash scripts/local/sb-local.sh gen types typescript --local --schema public >"$raw"
# pnpm may print workspace warnings on stdout: keep only the generated TypeScript.
grep -q '^export type Json' "$raw" || { echo "db-types: no TypeScript in the generator output" >&2; exit 2; }
latest="$(ls supabase/migrations | sort | tail -1 | cut -d_ -f1)"
{
  echo "// Generated with \`pnpm db:types:local\` (scripts/local/db-types.sh) from the LOCAL stack, schema ="
  echo "// migrations up to ${latest}. Do not edit by hand."
  echo "// Domain types live in src/domain; row-shaped helpers in src/types/database.ts."
  sed -n '/^export type Json/,$p' "$raw"
} >"$OUT"
pnpm exec prettier --write "$OUT" >/dev/null
echo "db-types: wrote $OUT (migrations up to ${latest})"
