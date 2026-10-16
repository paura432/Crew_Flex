#!/usr/bin/env bash
# Creates the three synthetic, auto-confirmed E2E accounts in the single Crew Flex Supabase project
# (= production, OD-9) through the Auth Admin API. The global e-mail-confirmation setting is NOT changed;
# no e-mail is sent (email_confirm=true creates the user already confirmed).
#
# Usage (secrets only from your shell, never from a file in this repo):
#   set -a; . ./.env.e2e.production; set +a           # E2E_SUPABASE_URL, E2E_AUTHORIZED_PROJECT_REF, accounts
#   SUPABASE_SECRET_KEY='<sb_secret_…>' E2E_WRITE_CONFIRM=WRITE:<ref>:<today> bash scripts/e2e/seed-users.sh
# Refuses to run unless both guard conditions hold (scripts/e2e/_guard.sh). Prints only the user ids.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/_guard.sh"

SUPABASE_URL="${SUPABASE_URL:-${E2E_SUPABASE_URL:-}}"
: "${SUPABASE_SECRET_KEY:?SUPABASE_SECRET_KEY is required (from your shell, never a file)}"
guard_require_write_authorization

for v in E2E_PRO_A_EMAIL E2E_PRO_A_PASSWORD E2E_PRO_B_EMAIL E2E_PRO_B_PASSWORD E2E_ORG_ADMIN_EMAIL E2E_ORG_ADMIN_PASSWORD; do
  [ -n "${!v:-}" ] || guard_die "$v is required (synthetic account; see .env.e2e.example)"
done
for e in "$E2E_PRO_A_EMAIL" "$E2E_PRO_B_EMAIL" "$E2E_ORG_ADMIN_EMAIL"; do
  case "$e" in
    e2e*@*|*+e2e*@*) ;;
    *) guard_die "e-mail '$e' is not obviously synthetic (must start with 'e2e' or contain '+e2e')" ;;
  esac
done
for v in E2E_PRO_A_PASSWORD E2E_PRO_B_PASSWORD E2E_ORG_ADMIN_PASSWORD; do
  # The payload is built with printf: a quote or backslash would break (or extend) the JSON.
  case "${!v}" in *'"'* | *'\'*) guard_die "$v must not contain quotes or backslashes" ;; esac
  pw="${!v}"; [ "${#pw}" -ge 16 ] || guard_die "$v must have at least 16 characters"
done

create_user() { # email password metadata-json
  local email="$1" password="$2" meta="$3"
  local payload
  payload=$(printf '{"email":"%s","password":"%s","email_confirm":true,"user_metadata":%s}' \
    "$email" "$password" "$meta")
  # Key and payload reach curl through file descriptors (printf is a bash builtin): neither the
  # secret key nor the password appears in the process list (`ps`) while the request runs.
  curl -sS --fail-with-body -X POST "$SUPABASE_URL/auth/v1/admin/users" \
    -H @<(printf 'apikey: %s\nAuthorization: Bearer %s\n' "$SUPABASE_SECRET_KEY" "$SUPABASE_SECRET_KEY") \
    -H "Content-Type: application/json" \
    --data-binary @<(printf '%s' "$payload") | sed -n 's/.*"id":"\([0-9a-f-]*\)".*/created \1/p'
}

create_user "$E2E_PRO_A_EMAIL" "$E2E_PRO_A_PASSWORD" '{"account_type":"professional","display_name":"E2E Pro A"}'
create_user "$E2E_PRO_B_EMAIL" "$E2E_PRO_B_PASSWORD" '{"account_type":"professional","display_name":"E2E Pro B"}'
create_user "$E2E_ORG_ADMIN_EMAIL" "$E2E_ORG_ADMIN_PASSWORD" \
  '{"account_type":"organization","display_name":"E2E Org Admin","organization_name":"E2E Org","organization_type":"mro","country":"ES"}'

echo "Done. The sign-up trigger created the profiles, technician rows, the organization and its admin membership."
