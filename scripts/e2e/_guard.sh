#!/usr/bin/env bash
# Shared production write guard for scripts/e2e/*.sh — same two conditions as tests/e2e/guard.ts:
#   1. target identity: the ref inside SUPABASE_URL equals E2E_AUTHORIZED_PROJECT_REF (and the linked
#      ref in supabase/.temp/project-ref when present);
#   2. explicit one-off confirmation: E2E_WRITE_CONFIRM=WRITE:<ref>:<today UTC>, typed on the command
#      line, never stored in .env.e2e.
# Exit code 2 on refusal. Sourced, not executed. Prints nothing secret.
set -euo pipefail

guard_die() { echo "e2e-guard: $*" >&2; exit 2; }

guard_require_write_authorization() {
  local url="${SUPABASE_URL:-}" ref
  ref="$(printf '%s' "$url" | sed -nE 's#^https://([a-z]{20})\.supabase\.co/?$#\1#p')"
  [ -n "$ref" ] || guard_die "SUPABASE_URL must be https://<ref>.supabase.co"
  [ -n "${E2E_AUTHORIZED_PROJECT_REF:-}" ] || guard_die "E2E_AUTHORIZED_PROJECT_REF is required (condition 1: target identity)"
  [ "$E2E_AUTHORIZED_PROJECT_REF" = "$ref" ] || guard_die "SUPABASE_URL does not belong to E2E_AUTHORIZED_PROJECT_REF"
  local repo_root linked
  repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  if [ -f "$repo_root/supabase/.temp/project-ref" ]; then
    linked="$(tr -d '[:space:]' < "$repo_root/supabase/.temp/project-ref")"
    [ "$linked" = "$ref" ] || guard_die "the linked Supabase project differs from the authorized ref"
  fi
  if [ -f "$repo_root/.env.e2e" ] && grep -Eq '^[[:space:]]*E2E_WRITE_CONFIRM[[:space:]]*=' "$repo_root/.env.e2e"; then
    guard_die "E2E_WRITE_CONFIRM must be typed per run, never stored in .env.e2e"
  fi
  local expected="WRITE:$ref:$(date -u +%F)"
  [ "${E2E_WRITE_CONFIRM:-}" = "$expected" ] || guard_die "E2E_WRITE_CONFIRM=$expected is required for this run (condition 2: explicit operator confirmation)"
  GUARD_REF="$ref"
}
