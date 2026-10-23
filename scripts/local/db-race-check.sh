#!/usr/bin/env bash
# db-race-check.sh — concurrency checks that need two real Postgres sessions (PGlite has one).
# LOCAL Docker stack only: talks to the container `supabase_db_crew-flex` with `docker exec psql`
# (never a URL), after the same local-target check as scripts/local/sb-local.sh. Every scenario
# restores the rows it changed, so the deterministic seed stays as it was.
# Usage: bash scripts/local/db-race-check.sh [e3|idempotency|review|availability|applications|notices|wallet-trash|outreach|all]   (default: all)
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; cd "$REPO_ROOT"
CONTAINER=supabase_db_crew-flex
die() { echo "db-race-check: $*" >&2; exit 2; }

docker inspect "$CONTAINER" >/dev/null 2>&1 || die "local container $CONTAINER is not running"
api="$(pnpm exec supabase status -o env 2>/dev/null | sed -n 's/^API_URL="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p')"
case "$api" in http://127.0.0.1:*|http://localhost:*) ;; *) die "supabase status does not point at a local stack" ;; esac

psql_as() { # $1 = user uuid; SQL on stdin; runs as the authenticated API role with that JWT subject
  { printf "set role authenticated;\nselect set_config('request.jwt.claims', '{\"sub\":\"%s\",\"role\":\"authenticated\"}', false);\n" "$1"; cat; } \
    | docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -qtA 2>&1
}
psql_owner() { docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -qtA 2>&1; }

ADMIN_OTHER=00000000-0000-4000-8000-000000000002
PLATFORM_ADMIN=00000000-0000-4000-8000-000000000031
LIS="(select id from public.work_requirements where title = 'B2 · A330 avionics check support')"
FAIL=0
OUT_A="$(mktemp)"; OUT_B="$(mktemp)"; trap 'rm -f "$OUT_A" "$OUT_B"' EXIT
pass() { echo "PASS  $*"; }
fail() { echo "FAIL  $*"; FAIL=1; }

e3() {
  echo "== E-3: two managers each delete a different hard qualification of the same requirement"
  local before; before="$(echo "select count(*) from public.work_requirement_qualifications where work_requirement_id = $LIS and requirement_level = 'hard';" | psql_owner)"
  [ "$before" = 2 ] || die "LIS requirement should start with 2 hard qualifications (has $before)"
  # Both transactions delete while the other is still open, then both commit: each one alone is valid.
  psql_as "$ADMIN_OTHER" >"$OUT_A" <<SQL &
begin;
delete from public.work_requirement_qualifications where work_requirement_id = $LIS
  and qualification_type_id = (select id from public.qualification_types where code = 'B2');
select pg_sleep(1.5);
commit;
SQL
  local a=$!
  sleep 0.5
  psql_as "$ADMIN_OTHER" >"$OUT_B" <<SQL || true
begin;
delete from public.work_requirement_qualifications where work_requirement_id = $LIS
  and qualification_type_id = (select id from public.qualification_types where code = 'TR-A330');
commit;
SQL
  wait "$a" || true
  local after; after="$(echo "select count(*) from public.work_requirement_qualifications where work_requirement_id = $LIS and requirement_level = 'hard';" | psql_owner)"
  local errors; errors="$(cat "$OUT_A" "$OUT_B" | grep -c 'at least one hard qualification' || true)"
  if [ "$after" -ge 1 ] && [ "$errors" = 1 ]; then pass "one transaction committed, the other was rejected; $after hard qualification(s) left"
  else fail "hard left=$after, rejections=$errors"; cat "$OUT_A" "$OUT_B"; fi
  # Restore the seed rows (owner role; the trigger is satisfied by the end state).
  psql_owner >/dev/null <<SQL
insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
select $LIS, id, 'hard' from public.qualification_types where code in ('B2', 'TR-A330')
on conflict (work_requirement_id, qualification_type_id) do nothing;
SQL
}

e3_simultaneous() {
  echo "== E-3: both deferred checks run at the same moment (a third session holds the parent row)"
  : >"$OUT_A"; local holder; holder=$(mktemp); local pids=()
  psql_owner >"$holder" <<SQL &
begin;
select 1 from public.work_requirements where id = $LIS for update;
select pg_sleep(2);
commit;
SQL
  local h=$!
  sleep 0.3
  for code in B2 TR-A330; do
    { psql_as "$ADMIN_OTHER" <<SQL
begin;
delete from public.work_requirement_qualifications where work_requirement_id = $LIS
  and qualification_type_id = (select id from public.qualification_types where code = '$code');
commit;
SQL
    } >>"$OUT_A" 2>&1 &
    pids+=($!)
  done
  wait "$h" "${pids[@]}" || true
  local after; after="$(echo "select count(*) from public.work_requirement_qualifications where work_requirement_id = $LIS and requirement_level = 'hard';" | psql_owner)"
  local errors; errors="$(grep -c 'at least one hard qualification' "$OUT_A" || true)"
  if [ "$after" = 1 ] && [ "$errors" = 1 ]; then pass "commits serialized on the parent row: one rejected, 1 hard qualification left"
  else fail "hard left=$after, rejections=$errors"; cat "$OUT_A"; fi
  : >"$OUT_A"; rm -f "$holder"
  psql_owner >/dev/null <<SQL
insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
select $LIS, id, 'hard' from public.qualification_types where code in ('B2', 'TR-A330')
on conflict (work_requirement_id, qualification_type_id) do nothing;
SQL
}

idempotency() {
  echo "== I-1: two simultaneous requests with the same Idempotency-Key create ONE requirement"
  : >"$OUT_A"; : >"$OUT_B"
  local key; key="$(cat /proc/sys/kernel/random/uuid)"
  local title="Race idempotency $key"
  local call="select id || ':' || replayed from public.create_work_requirement_idempotent('$key',
    (select id from public.organizations where name = 'Demo Aero Services Lisbon'), '$title', 'LIS',
    '2027-02-01T06:00Z', '2027-02-02T18:00Z', 'day', 1, 'planned',
    jsonb_build_array(jsonb_build_object('qualification_type_id', (select id from public.qualification_types where code = 'B2'), 'requirement_level', 'hard')));"
  # Session A claims the key and holds its transaction open; B arrives while A is still running.
  printf 'begin;\n%s\nselect pg_sleep(1.5);\ncommit;\n' "$call" | psql_as "$ADMIN_OTHER" >"$OUT_A" &
  local a=$!
  sleep 0.4
  printf '%s\n' "$call" | psql_as "$ADMIN_OTHER" >"$OUT_B" || true
  wait "$a" || true
  local n; n="$(echo "select count(*) from public.work_requirements where title = '$title';" | psql_owner)"
  local ra rb; ra="$(grep -E '^[0-9a-f-]{36}:' "$OUT_A" | tail -1)"; rb="$(grep -E '^[0-9a-f-]{36}:' "$OUT_B" | tail -1)"
  if [ "$n" = 1 ] && [ "${ra%%:*}" = "${rb%%:*}" ] && [ "${ra##*:}" = false ] && [ "${rb##*:}" = true ]; then
    pass "1 row; first call created it, the concurrent replay waited and returned the same id"
  else fail "rows=$n a=$ra b=$rb"; cat "$OUT_A" "$OUT_B"; fi
  # Local owner cleanup (the app has no delete path; qualifications and the key go with the row/actor).
  echo "delete from app_private.idempotency_keys where key = '$key'; delete from public.work_requirements where title = '$title';" | psql_owner >/dev/null
}

review() {
  echo "== Phase 6: two simultaneous reviews of the same pending qualification decide only once"
  : >"$OUT_A"; : >"$OUT_B"
  local q="(select q.id from public.technician_qualifications q join public.qualification_types t on t.id = q.qualification_type_id
            where q.technician_profile_id = '00000000-0000-4000-8000-000000000024' and t.code = 'B1.1')"
  local since; since="$(echo "select clock_timestamp();" | psql_owner)"
  [ "$(echo "select verification_status from public.technician_qualifications where id = $q;" | psql_owner)" = pending ] \
    || die "Golf's B1.1 must start pending"
  printf "begin;\nselect verification_status from public.review_qualification(%s, 'verified', (select updated_at from public.technician_qualifications where id = %s), null, null);\nselect pg_sleep(1.5);\ncommit;\n" "$q" "$q" \
    | psql_as "$PLATFORM_ADMIN" >"$OUT_A" &
  local a=$!
  sleep 0.4
  printf "select verification_status from public.review_qualification(%s, 'rejected', (select updated_at from public.technician_qualifications where id = %s), 'Race check', null);\n" "$q" "$q" \
    | psql_as "$PLATFORM_ADMIN" >"$OUT_B" || true
  wait "$a" || true
  local final; final="$(echo "select verification_status from public.technician_qualifications where id = $q;" | psql_owner)"
  local audits; audits="$(echo "select count(*) from public.audit_events where action = 'qualification.reviewed' and entity_id = $q and created_at >= '$since';" | psql_owner)"
  if [ "$final" = verified ] && grep -q 'not awaiting review' "$OUT_B" && [ "$audits" = 1 ]; then
    pass "first decision won (verified), the concurrent one got 'not awaiting review', 1 audit event"
  else fail "final=$final audits=$audits"; cat "$OUT_A" "$OUT_B"; fi
  # Restore the seed state (Golf B1.1 pending); the audit trail is append-only and stays.
  echo "update public.technician_qualifications set verification_status = 'pending', reviewed_by = null, reviewed_at = null, review_note = null where id = $q;" | psql_owner >/dev/null
}

availability() {
  echo "== Availability: concurrent day edits of one technician are serialised (migration 20261019130000)"
  local foxtrot=00000000-0000-4000-8000-000000000023
  local scope="technician_profile_id = '$foxtrot' and starts_at < '2031-07-01' and ends_at > '2031-06-01'"
  local on_day="select count(*) from public.availability_windows where technician_profile_id = '$foxtrot' and starts_at < '2031-06-11' and ends_at > '2031-06-10';"
  local first
  for first in replace insert; do
    echo "delete from public.availability_windows where $scope;" | psql_owner >/dev/null
    # A writes the day (via the RPC, or a direct insert spanning it) and holds its transaction;
    # B clears the same day with another key while A is open. B must see A's rows: 0 left.
    if [ "$first" = replace ]; then
      psql_as "$foxtrot" >"$OUT_A" <<SQL &
begin;
select windows_created from public.replace_availability_days(gen_random_uuid(), '[{"date":"2031-06-10","status":"available"}]');
select pg_sleep(1.5);
commit;
SQL
    else
      psql_as "$foxtrot" >"$OUT_A" <<SQL &
begin;
insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
values ('$foxtrot', '2031-06-09 12:00Z', '2031-06-11 12:00Z', 'available');
select pg_sleep(1.5);
commit;
SQL
    fi
    local a=$!
    sleep 0.5
    psql_as "$foxtrot" >"$OUT_B" <<SQL || true
select windows_created from public.replace_availability_days(gen_random_uuid(), '[{"date":"2031-06-10","status":null}]');
SQL
    wait "$a" || true
    local left; left="$(echo "$on_day" | psql_owner)"
    if [ "$left" = 0 ]; then pass "$first then clear: the clear waited and saw the first write (0 windows on the day)"
    else fail "$first then clear: $left window(s) left on the cleared day"; cat "$OUT_A" "$OUT_B"; fi
  done
  echo "delete from public.availability_windows where $scope;" | psql_owner >/dev/null
}

# --- D-06 applications and the M05 edit (migration 20261022130300) ------------------------------
# Each scenario builds its own requirement 30–32 days ahead (owner fixture) and deletes it at the end
# (cascades applications, proposals, events); the audit trail is append-only and stays.
DELTA=00000000-0000-4000-8000-000000000021
ECHO=00000000-0000-4000-8000-000000000022
ADMIN_AIRLINE=00000000-0000-4000-8000-000000000003
new_uuid() { cat /proc/sys/kernel/random/uuid; }
applications_ready() {
  [ "$(echo "select to_regclass('public.applications') is not null;" | psql_owner)" = t ] && return 0
  fail "migration 20261022130300 is not applied to the local stack (applications scenarios not run)"
  return 1
}
# Owner fixture: an open requirement of organization "$1" with hard B1.1 and headcount $2; prints its id.
race_need() {
  psql_owner <<SQL | tail -1
with wr as (
  insert into public.work_requirements
    (organization_id, title, location, starts_at, ends_at, shift, headcount, urgency, status, created_by)
  select o.id, 'Race applications', 'LIS', date_trunc('day', now()) + interval '30 days',
         date_trunc('day', now()) + interval '32 days', 'day', $2, 'planned', 'open', m.profile_id
  from public.organizations o
  join public.organization_members m on m.organization_id = o.id and m.role = 'admin'
  where o.name = '$1' limit 1
  returning id)
insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
select wr.id, qt.id, 'hard' from wr, public.qualification_types qt where qt.code = 'B1.1'
returning work_requirement_id;
SQL
}
# Owner fixture: an `accepted` application of technician $2 on requirement $1 with proposal v1 ($3);
# prints "<application id>|<updated_at>" (the version a transition must send).
race_accepted() {
  psql_owner <<SQL | tail -1
with a as (
  insert into public.applications (requirement_id, technician_profile_id, status, current_proposal_id, accepted_proposal_id)
  values ('$1', '$2', 'accepted', '$3', '$3')
  returning id, updated_at),
p as (
  insert into public.application_proposals (id, application_id, version, terms)
  select '$3', a.id, 1, '{}'::jsonb from a)
select a.id || '|' || to_char(a.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') from a;
SQL
}
race_available() { # technician $1 is available over the race period (removed by race_cleanup)
  echo "insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
        values ('$1', date_trunc('day', now()) + interval '29 days', date_trunc('day', now()) + interval '33 days', 'available');" \
    | psql_owner >/dev/null
}
race_cleanup() { # requirement ids
  local r
  for r in "$@"; do echo "delete from public.work_requirements where id = '$r';" | psql_owner >/dev/null; done
  echo "delete from public.availability_windows where technician_profile_id in ('$DELTA', '$ECHO')
          and starts_at = date_trunc('day', now()) + interval '29 days'
          and ends_at = date_trunc('day', now()) + interval '33 days';" | psql_owner >/dev/null
}
confirm_sql() { # "<application id>|<version>" → the confirmation statement
  printf "select status from public.transition_application('%s', 'confirmed', '%s', gen_random_uuid());" "${1%%|*}" "${1##*|}"
}

applications() {
  echo "== D-06 T4: two confirmations of the last seat at the same time — exactly one wins"
  applications_ready || return 0
  : >"$OUT_A"; : >"$OUT_B"
  race_available "$DELTA"; race_available "$ECHO"
  local req a b; req="$(race_need 'Demo Aero Services Lisbon' 1)"
  a="$(race_accepted "$req" "$DELTA" "$(new_uuid)")"; b="$(race_accepted "$req" "$ECHO" "$(new_uuid)")"
  printf 'begin;\n%s\nselect pg_sleep(1.5);\ncommit;\n' "$(confirm_sql "$a")" | psql_as "$ADMIN_OTHER" >"$OUT_A" &
  local pa=$!
  sleep 0.4
  printf '%s\n' "$(confirm_sql "$b")" | psql_as "$ADMIN_OTHER" >"$OUT_B" || true
  wait "$pa" || true
  local confirmed status audits covered
  confirmed="$(echo "select count(*) from public.applications where requirement_id = '$req' and status = 'confirmed';" | psql_owner)"
  status="$(echo "select status from public.work_requirements where id = '$req';" | psql_owner)"
  audits="$(echo "select count(*) from public.audit_events where action = 'application.confirmed' and metadata ->> 'requirement_id' = '$req';" | psql_owner)"
  covered="$(echo "select count(*) from public.audit_events where entity_id = '$req' and metadata ->> 'to' = 'covered';" | psql_owner)"
  if [ "$confirmed" = 1 ] && [ "$status" = covered ] && [ "$audits" = 1 ] && [ "$covered" = 1 ] \
     && grep -q 'every seat is confirmed' "$OUT_B"; then
    pass "one confirmation won, the other waited and got HEADCOUNT_REACHED; covered once; 1 audit row"
  else fail "confirmed=$confirmed status=$status audits=$audits covered=$covered"; cat "$OUT_A" "$OUT_B"; fi
  race_cleanup "$req"
}

pause_vs_confirm() {
  echo "== M05 × D-06: pause and confirm of the same requirement at the same time (both orders)"
  applications_ready || return 0
  local first
  for first in pause confirm; do
    : >"$OUT_A"; : >"$OUT_B"
    race_available "$DELTA"
    local req a; req="$(race_need 'Demo Aero Services Lisbon' 1)"; a="$(race_accepted "$req" "$DELTA" "$(new_uuid)")"
    local pause="update public.work_requirements set status = 'paused' where id = '$req';"
    local held="$pause" other; other="$(confirm_sql "$a")"
    if [ "$first" = confirm ]; then held="$other"; other="$pause"; fi
    printf 'begin;\n%s\nselect pg_sleep(1.5);\ncommit;\n' "$held" | psql_as "$ADMIN_OTHER" >"$OUT_A" &
    local pa=$!
    sleep 0.4
    printf '%s\n' "$other" | psql_as "$ADMIN_OTHER" >"$OUT_B" || true
    wait "$pa" || true
    local app status
    app="$(echo "select status from public.applications where id = '${a%%|*}';" | psql_owner)"
    status="$(echo "select status from public.work_requirements where id = '$req';" | psql_owner)"
    if [ "$first" = pause ] && [ "$status" = paused ] && [ "$app" = accepted ] && grep -q 'is not open' "$OUT_B"; then
      pass "pause first: the confirmation waited for the row and got REQUIREMENT_NOT_OPEN"
    elif [ "$first" = confirm ] && [ "$status" = covered ] && [ "$app" = confirmed ] && grep -q 'is not allowed' "$OUT_B"; then
      pass "confirm first: the requirement is covered and the pause was refused (55000)"
    else fail "$first first: requirement=$status application=$app"; cat "$OUT_A" "$OUT_B"; fi
    race_cleanup "$req"
  done
}

double_booking() {
  echo "== D-06: two organizations confirm the same technician for overlapping periods at the same time"
  applications_ready || return 0
  : >"$OUT_A"; : >"$OUT_B"
  race_available "$DELTA"
  local lis bcn a b
  lis="$(race_need 'Demo Aero Services Lisbon' 1)"; bcn="$(race_need 'Demo Airline Ops Barcelona' 1)"
  a="$(race_accepted "$lis" "$DELTA" "$(new_uuid)")"; b="$(race_accepted "$bcn" "$DELTA" "$(new_uuid)")"
  printf 'begin;\n%s\nselect pg_sleep(1.5);\ncommit;\n' "$(confirm_sql "$a")" | psql_as "$ADMIN_OTHER" >"$OUT_A" &
  local pa=$!
  sleep 0.4
  printf '%s\n' "$(confirm_sql "$b")" | psql_as "$ADMIN_AIRLINE" >"$OUT_B" || true
  wait "$pa" || true
  local confirmed; confirmed="$(echo "select count(*) from public.applications where technician_profile_id = '$DELTA' and requirement_id in ('$lis', '$bcn') and status = 'confirmed';" | psql_owner)"
  if [ "$confirmed" = 1 ] && grep -q 'another confirmed assignment overlaps' "$OUT_B"; then
    pass "the technician's advisory lock serialised both; the second got OVERLAPPING_ASSIGNMENT"
  else fail "confirmed=$confirmed"; cat "$OUT_A" "$OUT_B"; fi
  race_cleanup "$lis" "$bcn"
}

apply_vs_edit() {
  echo "== M05: an edit racing the first application waits for it and is refused (HAS_APPLICATIONS)"
  applications_ready || return 0
  : >"$OUT_A"; : >"$OUT_B"
  race_available "$DELTA"
  local req; req="$(race_need 'Demo Aero Services Lisbon' 1)"
  printf "begin;\nselect replayed from public.apply_to_requirement('%s', gen_random_uuid(), true);\nselect pg_sleep(1.5);\ncommit;\n" "$req" \
    | psql_as "$DELTA" >"$OUT_A" &
  local pa=$!
  sleep 0.4
  psql_as "$ADMIN_OTHER" >"$OUT_B" <<SQL || true
select u.changed
from public.work_requirements wr,
  lateral public.update_work_requirement(wr.id, wr.updated_at, 'Race applications (edited)', wr.location,
    wr.starts_at, wr.ends_at, wr.shift, wr.headcount, wr.urgency,
    (select jsonb_agg(jsonb_build_object('qualification_type_id', q.qualification_type_id,
                                         'requirement_level', q.requirement_level))
     from public.work_requirement_qualifications q where q.work_requirement_id = wr.id)) u
where wr.id = '$req';
SQL
  wait "$pa" || true
  local apps title
  apps="$(echo "select count(*) from public.applications where requirement_id = '$req';" | psql_owner)"
  title="$(echo "select title from public.work_requirements where id = '$req';" | psql_owner)"
  if [ "$apps" = 1 ] && [ "$title" = 'Race applications' ] && grep -q 'received applications cannot be edited' "$OUT_B"; then
    pass "the application committed first; the edit waited on the requirement row and was refused"
  else fail "applications=$apps title=$title"; cat "$OUT_A" "$OUT_B"; fi
  race_cleanup "$req"
}

# --- In-app notices (migration 20261023800000) ----------------------------------------------------
# Lima (a member of Lisbon) is promoted to manager for the scenario and set back to member at the end.
LIMA=00000000-0000-4000-8000-000000000042
LISBON_ORG="(select id from public.organizations where name = 'Demo Aero Services Lisbon')"
notices_ready() {
  [ "$(echo "select to_regclass('public.notifications') is not null;" | psql_owner)" = t ] && return 0
  fail "migration 20261023800000 is not applied to the local stack (notices scenario not run)"
  return 1
}
notices_role_loss() {
  echo "== notices: a manager demoted while an application is written keeps no notice of it (both orders)"
  applications_ready || return 0
  notices_ready || return 0
  local first
  for first in apply demote; do
    : >"$OUT_A"; : >"$OUT_B"
    race_available "$DELTA"
    echo "update public.organization_members set role = 'manager'
            where profile_id = '$LIMA' and organization_id = $LISBON_ORG;" | psql_owner >/dev/null
    local req; req="$(race_need 'Demo Aero Services Lisbon' 1)"
    local apply="select replayed from public.apply_to_requirement('$req', gen_random_uuid(), true);"
    local demote="update public.organization_members set role = 'member' where profile_id = '$LIMA' and organization_id = $LISBON_ORG;"
    local held_as="$DELTA" held="$apply" other_as="$ADMIN_OTHER" other="$demote"
    if [ "$first" = demote ]; then held_as="$ADMIN_OTHER"; held="$demote"; other_as="$DELTA"; other="$apply"; fi
    printf 'begin;\n%s\nselect pg_sleep(1.5);\ncommit;\n' "$held" | psql_as "$held_as" >"$OUT_A" &
    local pa=$!
    sleep 0.4
    printf '%s\n' "$other" | psql_as "$other_as" >"$OUT_B" || true
    wait "$pa" || true
    local count_of="select count(*) from public.notifications n join public.applications a on a.id = n.application_id where a.requirement_id = '$req' and n.recipient_id ="
    local lima admin
    lima="$(echo "$count_of '$LIMA';" | psql_owner)"
    admin="$(echo "$count_of '$ADMIN_OTHER';" | psql_owner)"
    if [ "$lima" = 0 ] && [ "$admin" = 1 ]; then
      pass "$first first: the membership lock ordered both; the demoted manager has no notice, the admin has one"
    else fail "$first first: demoted manager notices=$lima admin notices=$admin"; cat "$OUT_A" "$OUT_B"; fi
    echo "update public.organization_members set role = 'member'
            where profile_id = '$LIMA' and organization_id = $LISBON_ORG;" | psql_owner >/dev/null
    race_cleanup "$req"
  done
}

# --- Wallet trash expiry (migration 20261024200000, security review MEDIUM-1) -----------------------
# Delta restores an archived document while a platform admin's sweep expires the trash. Whoever takes the
# row first wins; a restored document is never deleted (the DELETE re-checks the expiry on its target),
# and a deleted one cannot be restored. The document, its object, its tombstone and any orphan tombstone
# recorded by the sweep during the scenario are removed afterwards (audit rows stay: append-only).
wallet_trash_ready() {
  [ "$(echo "select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'professional_documents' and column_name = 'archived_at');" | psql_owner)" = t ] && return 0
  fail "migration 20261024200000 is not applied to the local stack (wallet-trash scenario not run)"
  return 1
}
wallet_trash() {
  echo "== wallet trash: the owner restores while the sweep expires the same document (both orders)"
  wallet_trash_ready || return 0
  local first
  for first in restore sweep; do
    : >"$OUT_A"; : >"$OUT_B"
    local key; key="$(new_uuid)"
    local path="$DELTA/$key-0123456789abcdef"
    local since; since="$(echo "select now();" | psql_owner)"
    local doc
    doc="$(psql_owner <<SQL | tail -1
insert into storage.objects (bucket_id, name, owner, metadata)
values ('professional-documents', '$path', '$DELTA', '{"size": 3, "mimetype": "application/pdf"}');
insert into public.professional_documents (owner_id, kind, title, storage_path, mime_type, size_bytes, sha256, archived_at)
values ('$DELTA', 'other', 'Race trash', '$path', 'application/pdf', 3, repeat('a', 64), now() - interval '400 days')
returning id;
SQL
)"
    local restore="update public.professional_documents set archived_at = null where id = '$doc';"
    local sweep="select count(*) from public.document_maintenance_batch(true, 100) where storage_path = '$path' and action = 'expired';"
    local held_as="$DELTA" held="$restore" other_as="$PLATFORM_ADMIN" other="$sweep"
    if [ "$first" = sweep ]; then held_as="$PLATFORM_ADMIN"; held="$sweep"; other_as="$DELTA"; other="$restore"; fi
    printf 'begin;\n%s\nselect pg_sleep(1.5);\ncommit;\n' "$held" | psql_as "$held_as" >"$OUT_A" &
    local pa=$!
    sleep 0.4
    printf '%s\n' "$other" | psql_as "$other_as" >"$OUT_B" || true
    wait "$pa" || true
    local row tomb audit
    row="$(echo "select coalesce((select (archived_at is null)::text from public.professional_documents where id = '$doc'), 'gone');" | psql_owner)"
    tomb="$(echo "select coalesce(string_agg(reason, ','), 'none') from app_private.document_object_tombstones where storage_path = '$path';" | psql_owner)"
    audit="$(echo "select count(*) from public.audit_events where action = 'document.trash_expired' and entity_id = '$doc';" | psql_owner)"
    if [ "$first" = restore ] && [ "$row" = true ] && [ "$tomb" = none ] && [ "$audit" = 0 ]; then
      pass "restore first: the document is back in the wallet; the sweep neither deleted, tombstoned nor audited it"
    elif [ "$first" = sweep ] && [ "$row" = gone ] && [ "$tomb" = trash_expired ] && [ "$audit" = 1 ]; then
      pass "sweep first: expired once (trash_expired tombstone, audited); the late restore found nothing"
    else fail "$first first: row=$row tombstone=$tomb audit=$audit"; cat "$OUT_A" "$OUT_B"; fi
    # The object row was inserted above without a blob; Storage refuses direct deletes unless allowed.
    psql_owner >/dev/null <<SQL
begin;
set local storage.allow_delete_query = 'true';
delete from public.professional_documents where id = '$doc';
delete from app_private.document_object_tombstones
  where storage_path = '$path' or (reason = 'orphan_upload' and deleted_at >= '$since');
delete from storage.objects where bucket_id = 'professional-documents' and name = '$path';
commit;
SQL
  done
}

# --- PKG outreach: «Distribuir aviso Urgente / AOG» (migrations 20261024400000…400200) -----------------
# Delta's notice preferences are saved for the scenario and put back as they were at the end.
ADMIN_MRO=00000000-0000-4000-8000-000000000001
MANAGER_MRO=00000000-0000-4000-8000-000000000014
outreach_ready() {
  [ "$(echo "select to_regproc('public.requirement_outreach') is not null;" | psql_owner)" = t ] && return 0
  fail "migrations 20261024400000…400200 are not applied to the local stack (outreach scenario not run)"
  return 1
}
OUTREACH_SAVED=""
outreach_opt_in() { # Delta accepts AOG notices for the scenario (previous row kept in OUTREACH_SAVED)
  OUTREACH_SAVED="$(echo "select row_to_json(p) from public.technician_notice_preferences p where profile_id = '$DELTA';" | psql_owner)"
  psql_owner >/dev/null <<SQL
insert into public.technician_notice_preferences (profile_id, urgent_opt_in, aog_opt_in, mobilization_hours)
values ('$DELTA', true, true, 12)
on conflict (profile_id) do update set urgent_opt_in = true, aog_opt_in = true, mobilization_hours = 12,
  time_zone = 'Europe/Madrid', quiet_start = null, quiet_end = null;
SQL
}
outreach_restore() {
  if [ -z "$OUTREACH_SAVED" ]; then
    echo "delete from public.technician_notice_preferences where profile_id = '$DELTA';" | psql_owner >/dev/null
  else
    psql_owner >/dev/null <<SQL
update public.technician_notice_preferences p
set urgent_opt_in = s.urgent_opt_in, aog_opt_in = s.aog_opt_in, mobilization_hours = s.mobilization_hours,
    time_zone = s.time_zone, quiet_start = s.quiet_start, quiet_end = s.quiet_end
from json_populate_record(null::public.technician_notice_preferences, '$OUTREACH_SAVED'::json) s
where p.profile_id = '$DELTA';
SQL
  fi
}
aog_need() { # an open AOG need of Demo MRO Madrid over the race period; prints its id
  local req; req="$(race_need 'Demo MRO Madrid' 1)"
  echo "update public.work_requirements set urgency = 'aog' where id = '$req';" | psql_owner >/dev/null
  echo "$req"
}
outreach_twice() {
  echo "== outreach: an admin and a manager distribute the same need at once — one distribution, one notice"
  applications_ready || return 0
  outreach_ready || return 0
  : >"$OUT_A"; : >"$OUT_B"
  race_available "$DELTA"
  outreach_opt_in
  local req; req="$(aog_need)"
  printf "begin;\nselect notified from public.requirement_outreach('%s');\nselect pg_sleep(1.5);\ncommit;\n" "$req" \
    | psql_as "$ADMIN_MRO" >"$OUT_A" &
  local pa=$!
  sleep 0.4
  printf "select notified from public.requirement_outreach('%s');\n" "$req" | psql_as "$MANAGER_MRO" >"$OUT_B" || true
  wait "$pa" || true
  local runs audits notices
  runs="$(echo "select count(*) from public.outreach_distributions where requirement_id = '$req';" | psql_owner)"
  audits="$(echo "select count(*) from public.audit_events where action = 'requirement.outreach_distributed' and entity_id = '$req';" | psql_owner)"
  notices="$(echo "select count(*) from public.notifications where kind = 'outreach' and requirement_id = '$req' and recipient_id = '$DELTA';" | psql_owner)"
  if [ "$runs" = 1 ] && [ "$audits" = 1 ] && [ "$notices" = 1 ] && grep -q 'already distributed' "$OUT_B"; then
    pass "the requirement lock ordered both; the second got OUTREACH_ALREADY_SENT and nobody got two notices"
  else fail "distributions=$runs audits=$audits delta notices=$notices"; cat "$OUT_A" "$OUT_B"; fi
  outreach_restore
  race_cleanup "$req"
}
outreach_flood() {
  echo "== outreach: four needs of one organization distributed at once — the 3-per-24 h bound still holds"
  applications_ready || return 0
  outreach_ready || return 0
  : >"$OUT_A"; : >"$OUT_B"
  race_available "$DELTA"
  outreach_opt_in
  # The 3-per-24 h delivery bound counts earlier notices too (ui-smoke «PKG outreach» leaves one): start clean.
  echo "delete from public.notifications where kind = 'outreach' and recipient_id = '$DELTA';" | psql_owner >/dev/null
  local needs=() i
  for i in 1 2 3 4; do needs+=("$(aog_need)"); done
  printf "begin;\nselect notified from public.requirement_outreach('%s');\nselect pg_sleep(1.5);\ncommit;\n" "${needs[0]}" \
    | psql_as "$ADMIN_MRO" >"$OUT_A" &
  local pids=($!)
  sleep 0.4
  for i in 1 2 3; do
    printf "select notified from public.requirement_outreach('%s');\n" "${needs[$i]}" | psql_as "$MANAGER_MRO" >>"$OUT_B" &
    pids+=($!)
  done
  wait "${pids[@]}" || true
  local list; list="$(printf "'%s'," "${needs[@]}")"; list="${list%,}"
  local runs notices
  runs="$(echo "select count(*) from public.outreach_distributions where requirement_id in ($list);" | psql_owner)"
  notices="$(echo "select count(*) from public.notifications where kind = 'outreach' and recipient_id = '$DELTA' and requirement_id in ($list);" | psql_owner)"
  if [ "$runs" = 4 ] && [ "$notices" = 3 ]; then
    pass "the organization lock serialised the four distributions; Delta got 3 notices, not 4"
  else fail "distributions=$runs delta notices=$notices"; cat "$OUT_A" "$OUT_B"; fi
  outreach_restore
  race_cleanup "${needs[@]}"
}

case "${1:-all}" in
  e3) e3; e3_simultaneous ;;
  idempotency) idempotency ;;
  review) review ;;
  availability) availability ;;
  applications) applications; pause_vs_confirm; double_booking; apply_vs_edit ;;
  notices) notices_role_loss ;;
  wallet-trash) wallet_trash ;;
  outreach) outreach_twice; outreach_flood ;;
  all) e3; e3_simultaneous; idempotency; review; availability
       applications; pause_vs_confirm; double_booking; apply_vs_edit; notices_role_loss; wallet_trash
       outreach_twice; outreach_flood ;;
  *) die "unknown scenario: $1" ;;
esac
exit "$FAIL"
