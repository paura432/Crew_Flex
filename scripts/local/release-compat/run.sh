#!/usr/bin/env bash
# release-compat — proves every intermediate state of a rollout on the LOCAL Docker stack:
# functions served from the production commit or the release commit (each from its own worktree,
# on its own port), against the local DB at the production schema and then the release schema,
# plus the rollback hazard. DESTROYS the local Docker database (reset), then restores it.
# Usage: bash scripts/local/release-compat/run.sh <prod-sha> <release-sha> <prod-last-migration> [<mid-sha>]
#   original order: bash scripts/local/release-compat/run.sh ddf5c4b 65df3b9 20261015130400
#   safe order (schema before the enum from <mid-sha>, new availability, then the enum):
#                   bash scripts/local/release-compat/run.sh ddf5c4b 65df3b9 20261015130400 2216d38
# Stop `supabase functions serve` first (the harness serves functions itself).
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"; cd "$REPO_ROOT"
[ $# -eq 3 ] || [ $# -eq 4 ] || { echo "usage: $0 <prod-sha> <release-sha> <prod-last-migration> [<mid-sha>]" >&2; exit 2; }
PROD="$1"; REL="$2"; PROD_MIG="$3"; MID="${4:-}"
WT="$(mktemp -d)"
cleanup() { for c in "$PROD" "$REL" $MID; do git worktree remove --force "$WT/wt-$c" 2>/dev/null || true; done; rm -rf "$WT"; }
trap cleanup EXIT
for c in "$PROD" "$REL" $MID; do
  git worktree add -q "$WT/wt-$c" "$c"
  (cd "$WT/wt-$c" && pnpm install --frozen-lockfile --offline --ignore-scripts >/dev/null)
done
SB_LOCAL_CONFIRM=yes bash scripts/local/sb-local.sh db reset --version "$PROD_MIG" >/dev/null
status=0
WT_DIR="$WT" PROD_SHA="$PROD" RELEASE_SHA="$REL" MID_SHA="$MID" node scripts/local/release-compat/run.mjs || status=$?
# Restore the working tree's schema (all local migrations) for normal local work.
bash scripts/local/sb-local.sh migration up --local >/dev/null
echo "release-compat: local DB restored to the working tree's migrations (flag rows are not re-created)"
exit "$status"
