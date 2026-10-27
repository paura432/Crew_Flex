#!/usr/bin/env bash
# cleanup-test-rows.sh — remove the rows that local test runs leave behind, LOCAL Docker stack only.
#
# The E2E suite creates one `E2E <timestamp>` work requirement per run and the browser smoke one
# `Local UI check · …` (V0 has no delete path for requirements). Everything else (the deterministic
# seed, the 22 synthetic accounts, their qualifications and windows) is left untouched.
# Goes through scripts/local/sb-local.sh, which refuses any remote target.
# Usage: bash scripts/local/cleanup-test-rows.sh [--dry-run]
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; cd "$REPO_ROOT"
WHERE="title like 'E2E %' or title like 'Local UI check%' or title like 'E2E should fail%'"
if [ "${1:-}" = "--dry-run" ]; then
  bash scripts/local/sb-local.sh db query "select title, created_at from public.work_requirements where $WHERE order by created_at"
  exit 0
fi
# work_requirement_qualifications cascade with the requirement; audit rows stay (append-only, synthetic).
bash scripts/local/sb-local.sh db query "delete from public.work_requirements where $WHERE returning title"
# ui-smoke step 5 declares a B2 for Delta and removes it at the end; an interrupted run leaves it (the seed has none).
bash scripts/local/sb-local.sh db query "delete from public.technician_qualifications q using public.qualification_types qt
  where qt.id = q.qualification_type_id and qt.code = 'B2'
    and q.technician_profile_id = '00000000-0000-4000-8000-000000000021' returning qt.code"
# PKG recruiter / PKG P11: the browser smoke's revoked «Smoke client …» / «Cliente P11 …» rows once nothing references them, and Lisbon back to
# an MRO if an interrupted run left it a staffing agency (no-ops before migration 20261024500000).
bash scripts/local/sb-local.sh db query "do \$\$ begin
  if to_regclass('public.represented_clients') is not null then
    update public.represented_clients set status = 'revoked', revoked_at = now()
      where (name like 'Smoke client %' or name like 'Cliente P11 %') and status <> 'revoked';
    update public.work_requirements set status = 'closed'
      where (title like 'Local UI check · recruiter %' or title like 'Local UI check · P11 recruiter %') and status not in ('closed', 'draft');
    delete from public.represented_clients rc where (rc.name like 'Smoke client %' or rc.name like 'Cliente P11 %')
      and not exists (select 1 from public.work_requirements wr where wr.on_behalf_of_client_id = rc.id);
  end if;
  update public.organizations set type = 'mro' where name = 'Demo Aero Services Lisbon' and type <> 'mro';
  update public.work_requirements wr set status = 'open'
    from public.organizations o where o.id = wr.organization_id and o.name = 'Demo Aero Services Lisbon'
    and wr.status = 'paused' and wr.title = 'B2 · A330 avionics check support';
end \$\$"
