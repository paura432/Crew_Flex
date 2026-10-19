#!/usr/bin/env bash
# db-owner-sql.sh — run SQL from stdin as the database OWNER on the LOCAL Docker stack only, for
# local E2E setup that API roles cannot do (e.g. the owner-only app_private.feature_flags row).
# Same local-target check as db-race-check.sh: talks to the container `supabase_db_crew-flex` with
# `docker exec psql` (never a URL) and refuses unless `supabase status` points at 127.0.0.1/localhost.
# Usage: echo "select 1" | bash scripts/local/db-owner-sql.sh
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; cd "$REPO_ROOT"
CONTAINER=supabase_db_crew-flex
die() { echo "db-owner-sql: $*" >&2; exit 2; }

docker inspect "$CONTAINER" >/dev/null 2>&1 || die "local container $CONTAINER is not running"
api="$(pnpm exec supabase status -o env 2>/dev/null | sed -n 's/^API_URL="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p')"
case "$api" in http://127.0.0.1:*|http://localhost:*) ;; *) die "supabase status does not point at a local stack" ;; esac

docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -qtA
