#!/usr/bin/env bash
# release2 — compatibility drill for publishing local `main` after release 1 (see release2.mjs):
# production `work-requirements` (from a worktree of the production commit) and the working tree's
# function, each against the local DB at the production schema and at the full schema.
# DESTROYS the local Docker database (reset to the production schema), then resets it again with
# every local migration and the seed. Flag rows (`app_private.feature_flags`) are not re-created and a
# running `supabase functions serve` must be restarted afterwards (it keeps stale connections).
# Usage: bash scripts/local/release-compat/release2.sh [<prod-sha>] [<prod-last-migration>]
#   default: bash scripts/local/release-compat/release2.sh 65df3b9 20261019150100
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"; cd "$REPO_ROOT"
PROD="${1:-65df3b9}"; PROD_MIG="${2:-20261019150100}"
[ -z "$(git status --porcelain -- src supabase)" ] || { echo "release2: src/ and supabase/ must be clean — they are the release under test" >&2; exit 2; }
echo "release2: production $PROD (schema $PROD_MIG) vs working tree $(git rev-parse --short HEAD)"
WT="$(mktemp -d)"
cleanup() { git worktree remove --force "$WT/wt" 2>/dev/null || true; rm -rf "$WT"; }
trap cleanup EXIT
git worktree add -q "$WT/wt" "$PROD"
SB_LOCAL_CONFIRM=yes bash scripts/local/sb-local.sh db reset --version "$PROD_MIG" >/dev/null
status=0
PROD_WT="$WT/wt" node scripts/local/release-compat/release2.mjs || status=$?
SB_LOCAL_CONFIRM=yes bash scripts/local/sb-local.sh db reset >/dev/null
echo "release2: local DB reset to the working tree's migrations + seed — re-insert the flag rows and restart 'functions serve'"
exit "$status"
