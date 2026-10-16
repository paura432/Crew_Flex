#!/usr/bin/env bash
# db-race-check.sh — concurrency checks that need two real Postgres sessions (PGlite has one).
# LOCAL Docker stack only: talks to the container `supabase_db_crew-flex` with `docker exec psql`
# (never a URL), after the same local-target check as scripts/local/sb-local.sh. Every scenario
# restores the rows it changed, so the deterministic seed stays as it was.
# Usage: bash scripts/local/db-race-check.sh [e3|idempotency|review|all]   (default: all)
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

case "${1:-all}" in
  e3) e3; e3_simultaneous ;;
  idempotency) idempotency ;;
  review) review ;;
  all) e3; e3_simultaneous; idempotency; review ;;
  *) die "unknown scenario: $1" ;;
esac
exit "$FAIL"
