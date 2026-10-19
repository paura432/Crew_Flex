# 06 · Active context

_Last updated 2026-10-19 (evening) CEST. Keep under ~60 lines; replace, don't append history._

## Current task

V1.8 → Next.js functional migration, LOCAL only (owner brief 2026-10-19). Master audit and matrix:
`docs/integration/crewflex-v13/10-master-matrix.md` (modules M00–M17, dependency graph, batches).
Batch 1 (M01 password recovery) and batch 2 (M06 matches list: search, eligible-only, sort, 20/page,
compare ≤3), batch 3 (M02 profile-status checklist + read-only month calendar) and batch 4 (M10
document expiry chips, M04 «use 7–3/7–4 as base») VERIFIED_LOCAL. The decision-free queue of the matrix
(§7) is now empty: further modules (M05 lifecycle, M07–M09, M11–M14, M16) need owner decisions or a
scope change — listed in 10-master-matrix.md §1.
Local gotchas: `rm tsconfig.tsbuildinfo` when new i18n keys «don't exist» for tsc; Next dev logs a
`performance.measure` negative-timestamp page error (dev only — the production build is clean).

## State

| Item         | State                                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| Production   | `origin/main` `65df3b9`, Vercel `7179643776` success; 15 migrations; 8 functions (matching/capacity/availability v3) |
| Data         | unchanged: 3 users, 0 organizations, 0 windows, 0 `aog_only`; no flags, 0 buckets, no wallet object                  |
| Local `main` | ahead of `65df3b9`, not pushed: wallet (release 2, not approved), designs, rollout docs                              |
| Worktrees    | `../cf-r1` (`65df3b9`), `../cf-r1a` (`2216d38`) — can be removed when the owner wants                                |

## Risks

1. Enum has `aog_only` (Q12 true): never reinstall `ddf5c4b` matching/capacity/availability; forward fix only; never convert `aog_only` rows.
2. Never `git push origin main` while local `main` carries the wallet; publish only reviewed commits explicitly.
3. Authenticated flows never verified in production (no session, 0 organizations).
4. `pnpm db:types` targets production — use `pnpm db:types:local`.

## Blocked on the owner

- Step 6: production E2E (3 approvals: seed synthetic users, run, cleanup).
- D-06 Q2–Q6 and D-07 P1–P4: owner **proposals** recorded 2026-10-19 in the contracts; ratification
  needed before any sensitive implementation (§4.1 of each doc). P3 period needs legal criterion.
- Wallet release 2: retention periods, legal-hold procedure, maintenance mechanism (not approved).

## E2E certification (prepared 2026-10-19, local only)

`remote-smoke` 31 checks (19 + release-1 R1a–R1f cycle save, R2a–R2f «AOG only») and read-only browser checks
`scripts/e2e/ui-release1.mjs` (24). Local: 41/41 API (+10 remediation), 24/24 browser. Production guard: 31
blocked, 0 requests without `E2E_WRITE_CONFIRM`. Runbook: `docs/qa/PRODUCTION_E2E_RUNBOOK.md`.

## Incident (open)

2026-10-19: the owner ran `scripts/e2e/seed-users.sh` (runbook step 1) in their terminal and got **HTTP 401**
from the Auth Admin API (most likely the pasted secret key was empty/invalid). No account was created
(`created` lines absent). Owner decision: no new remote write; seeding and production E2E paused until the
V1.8 functional migration (local) is complete. Re-verify with the read-only preflight before any retry.
Read-only check afterwards: users 3, synthetic 0, organizations 0. Observed: existing user #1 (oldest)
has `auth.users.updated_at` = 2026-10-19 17:36 UTC with no new sign-in (last 2026-10-09); `auth.audit_log_entries`
has no rows since 16:00 UTC, so the cause is unknown (no Claude write: every query was read-only). Owner to
confirm whether it was a dashboard action.

## Next step (one)

V1.8 → Next.js functional migration, LOCAL only: master audit/matrix first, then module batches (owner brief 2026-10-19). No accounts, no remote writes.
