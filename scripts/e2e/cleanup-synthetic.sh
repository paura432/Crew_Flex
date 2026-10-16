#!/usr/bin/env bash
# Removes ONLY the synthetic E2E accounts and the rows they own from the single Crew Flex Supabase
# project (= production, OD-9). Scope is fixed by the three E2E_* e-mails; nothing else is touched.
#
# Order (FK-safe, see supabase/migrations/20261009120000_foundation_v0.sql):
#   1. work_requirements created by the synthetic org admin (cascade: requirement qualifications);
#   2. organizations where the ONLY members are synthetic profiles (cascade: memberships);
#   3. auth.users of the synthetic e-mails (cascade: profiles → technician_profiles → availability
#      windows / qualifications). audit_events keep NULL actor/org (on delete set null).
# Runs through `supabase db query --linked` (the linked ref must equal the authorized ref).
#
# Usage:
#   set -a; . ./.env.e2e.production; set +a
#   E2E_WRITE_CONFIRM=WRITE:<ref>:<today> bash scripts/e2e/cleanup-synthetic.sh [--dry-run]
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/_guard.sh"

SUPABASE_URL="${SUPABASE_URL:-${E2E_SUPABASE_URL:-}}"
guard_require_write_authorization
DRY_RUN=0; [ "${1:-}" = "--dry-run" ] && DRY_RUN=1

for v in E2E_PRO_A_EMAIL E2E_PRO_B_EMAIL E2E_ORG_ADMIN_EMAIL; do
  [ -n "${!v:-}" ] || guard_die "$v is required"
  printf '%s' "${!v}" | grep -Eq '^[A-Za-z0-9.+_-]+@[A-Za-z0-9.-]+$' || guard_die "$v is not a plain e-mail address"
  case "${!v}" in e2e*@*|*+e2e*@*) ;; *) guard_die "${!v} is not obviously synthetic" ;; esac
done
# Compared lower-cased on both sides (auth stores e-mails lower-cased; a mixed-case value must not
# silently leave a synthetic account behind). The regex above already excludes quotes.
EMAILS="'${E2E_PRO_A_EMAIL,,}','${E2E_PRO_B_EMAIL,,}','${E2E_ORG_ADMIN_EMAIL,,}'"

SQL_REPORT="
with u as (select id from auth.users where lower(email) in ($EMAILS)),
     o as (select m.organization_id as id from public.organization_members m
           where m.profile_id in (select id from u)
           group by m.organization_id
           having bool_and(m.profile_id in (select id from u)))
select (select count(*) from u) as users,
       (select count(*) from o) as organizations,
       (select count(*) from public.work_requirements where created_by in (select id from u)) as requirements,
       (select count(*) from public.availability_windows where technician_profile_id in (select id from u)) as windows"

SQL_DELETE="
begin;
create temp table e2e_u on commit drop as select id from auth.users where lower(email) in ($EMAILS);
create temp table e2e_o on commit drop as
  select m.organization_id as id from public.organization_members m
  where m.profile_id in (select id from e2e_u)
  group by m.organization_id having bool_and(m.profile_id in (select id from e2e_u));
delete from public.work_requirements where created_by in (select id from e2e_u);
delete from public.organizations where id in (select id from e2e_o);
delete from auth.users where id in (select id from e2e_u);
commit;"

echo "Synthetic scope (before):"
pnpm exec supabase db query --linked "$SQL_REPORT" 2>/dev/null | grep -o '"rows":.*' | head -c 400; echo
if [ "$DRY_RUN" = 1 ]; then echo "dry-run: nothing deleted"; exit 0; fi
pnpm exec supabase db query --linked "$SQL_DELETE" >/dev/null 2>&1 || guard_die "delete failed (nothing committed)"
echo "Synthetic scope (after):"
pnpm exec supabase db query --linked "$SQL_REPORT" 2>/dev/null | grep -o '"rows":.*' | head -c 400; echo
