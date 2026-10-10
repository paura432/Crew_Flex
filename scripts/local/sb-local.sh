#!/usr/bin/env bash
# sb-local.sh — run ONE Supabase CLI command against the LOCAL Docker stack and never a remote project.
#
# Safety (docs/qa/LOCAL_ENVIRONMENT.md):
#   - refuses `--linked`, `--project-ref`, `--db-url` with a non-local host, and any `link`, `projects`,
#     `secrets`, `functions deploy`, `db push`, `migration up/repair` subcommand (those can reach remote);
#   - appends `--local` to db/migration/functions-serve commands that accept it;
#   - before any db command, reads `supabase status -o env` and requires the DB and API URLs to point at
#     127.0.0.1 or localhost.
# Usage: bash scripts/local/sb-local.sh db query "select 1"
#        bash scripts/local/sb-local.sh db reset        (asks for confirmation unless SB_LOCAL_CONFIRM=yes)
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; cd "$REPO_ROOT"
die() { echo "sb-local: $*" >&2; exit 2; }

[ $# -ge 1 ] || die "usage: sb-local.sh <supabase subcommand…>"
for a in "$@"; do
  case "$a" in
    --linked|--project-ref|--project-ref=*|--project-id|--project-id=*) die "refusing '$a': remote targeting is not allowed here" ;;
    --db-url=*) case "${a#--db-url=}" in *@127.0.0.1*|*@localhost*) ;; *) die "refusing --db-url with a non-local host" ;; esac ;;
    --db-url) die "pass --db-url=<url> (inline) so the host can be checked" ;;
  esac
done
case "$1 ${2:-}" in
  "link "*|"projects "*|"secrets "*|"functions deploy"|"functions delete"|"functions download"|"db push"|"db dump"|"migration up"|"migration repair"|"branches "*|"orgs "*)
    die "'$1 ${2:-}' is not a local-only operation" ;;
esac

is_local_host() { case "$1" in http://127.0.0.1:*|http://localhost:*|postgresql://*@127.0.0.1:*|postgresql://*@localhost:*) return 0 ;; *) return 1 ;; esac; }

check_status() {
  local env api db
  env="$(pnpm exec supabase status -o env 2>/dev/null)" || die "local stack is not running (supabase start)"
  api="$(printf '%s\n' "$env" | sed -n 's/^API_URL="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p')"
  db="$(printf '%s\n' "$env" | sed -n 's/^DB_URL="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p')"
  [ -n "$api" ] && [ -n "$db" ] || die "could not read API_URL/DB_URL from supabase status"
  is_local_host "$api" || die "API_URL is not local: ${api%%\?*}"
  is_local_host "$db" || die "DB_URL is not local"
  echo "sb-local: target $api · db host $(printf '%s' "$db" | sed -E 's#.*@([^:/]+):([0-9]+).*#\1:\2#')" >&2
}

ARGS=("$@")
case "$1 ${2:-}" in
  "db reset"|"db query"|"db diff"|"db lint"|"migration list"|"migration fetch"|"inspect "*)
    check_status; ARGS+=(--local) ;;
  "db start"|"start "*|"start"|"stop "*|"stop"|"status "*|"status"|"functions serve"|"gen types")
    ;;
esac
if [ "$1 ${2:-}" = "db reset" ] && [ "${SB_LOCAL_CONFIRM:-}" != "yes" ]; then
  read -r -p "sb-local: this DESTROYS the local Docker database and re-seeds it. Type 'local' to continue: " ans
  [ "$ans" = "local" ] || die "aborted"
fi
exec pnpm exec supabase "${ARGS[@]}"
