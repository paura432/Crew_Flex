#!/usr/bin/env bash
# Creates the three synthetic, auto-confirmed test accounts in the STAGING Supabase project
# through the Auth Admin API. The global e-mail-confirmation setting is NOT changed.
#
# Usage (secrets only from your shell, never from a file in this repo):
#   SUPABASE_URL=https://<staging-ref>.supabase.co SUPABASE_SECRET_KEY='<sb_secret_…>' \
#     bash scripts/staging/seed-users.sh
# It prompts for e-mails and passwords and prints only the resulting user ids.
set -euo pipefail

: "${SUPABASE_URL:?SUPABASE_URL is required (staging project only)}"
: "${SUPABASE_SECRET_KEY:?SUPABASE_SECRET_KEY is required (staging secret key, from your shell)}"

case "$SUPABASE_URL" in
  *sbjkzrkmcekokkqiuvvh*) echo "Refusing to seed the PRODUCTION project." >&2; exit 1 ;;
esac

create_user() { # email password metadata-json
  local email="$1" password="$2" meta="$3"
  local payload
  payload=$(printf '{"email":"%s","password":"%s","email_confirm":true,"user_metadata":%s}' \
    "$email" "$password" "$meta")
  curl -sS --fail-with-body -X POST "$SUPABASE_URL/auth/v1/admin/users" \
    -H "apikey: $SUPABASE_SECRET_KEY" \
    -H "Authorization: Bearer $SUPABASE_SECRET_KEY" \
    -H "Content-Type: application/json" \
    -d "$payload" | sed -n 's/.*"id":"\([0-9a-f-]*\)".*/created \1/p'
}

read -r -p "Professional A e-mail: " PRO_A_EMAIL
read -r -s -p "Professional A password: " PRO_A_PASSWORD; echo
read -r -p "Professional B e-mail: " PRO_B_EMAIL
read -r -s -p "Professional B password: " PRO_B_PASSWORD; echo
read -r -p "Organization admin e-mail: " ORG_EMAIL
read -r -s -p "Organization admin password: " ORG_PASSWORD; echo

create_user "$PRO_A_EMAIL" "$PRO_A_PASSWORD" '{"account_type":"professional","display_name":"E2E Pro A"}'
create_user "$PRO_B_EMAIL" "$PRO_B_PASSWORD" '{"account_type":"professional","display_name":"E2E Pro B"}'
create_user "$ORG_EMAIL" "$ORG_PASSWORD" \
  '{"account_type":"organization","display_name":"E2E Org Admin","organization_name":"E2E Org","organization_type":"mro","country":"ES"}'

echo "Done. Put the same e-mails/passwords in .env.e2e (git-ignored). The sign-up trigger created the profiles, technician rows, the organization and its admin membership."
