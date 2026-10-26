# 06 · Active context

_Last updated 2026-10-26 13:30 CET (isolated migration plan: F0, F1a, F1b closed locally). Keep under ~60 lines; replace, don't append history._

## Current task

Owner 2026-10-26: isolated plan to finish the v1.8 migration (briefs `tmp/CLAUDE_CREWFLEX_100_2026-10-26.md` and
`tmp/CrewFlex_migration_audit_2026-10-26.md`, git-ignored; ponytail ultra + caveman wenyan-ultra). Phases: F0 baseline →
F1 P0 security (local) → F2 integrate v2-16 and P01 → F3 parity P02…P14 (17-parity-matrix-v18 is the only matrix; % =
closed rows with a test / applicable rows, none before) → F4 local release candidate → F5 STG (owner) → F6 production,
one approval per step. Isolation: one worktree and short branch per batch, ff-merge here after gate + independent
review, zero remote writes. SCOPE-2 and DEFAULTS (`08-product-decisions.md`) stand; every subagent: Fable, xhigh.
Done 2026-10-26: F0 (v1.8 ZIP sha256 `53ee5b61…` = `tmp/references/crewflex-v18`; production re-read: 15 migrations / 8
functions, 0 drift), F1a (Next 16.4.3 + zod 4.6.7, `dc1b421`; production candidate `hotfix/x01-deps` `352182c`, scope
verified: 7 files, no migration), F1b (`2845675`, migration `20261026100000`: EXECUTE on the three trigger-only DEFINER
functions revoked from public/anon/authenticated; rls «trigger-only» 4 tests, red without the migration; independent security review APPROVE).
Gate at `2845675` (db reset in file order, 58 migrations, flags, fresh `functions serve`): `pnpm check` 0 (Vitest 1158,
Deno 194), build 0, E2E 48/48, race 19/19, ui-smoke 274/274 (incl. a real GoTrue sign-up). Owner's Supabase token: moved
out of the repo's env files to an owner-local file (scoped `sbp_fc…`, reaches Crew_Flex + one other project, no org).
After ANY local reset: flags via STDIN to `db-owner-sql.sh`, restart `functions serve` (wait for the NEW edge_runtime
container); copy the git-ignored `.env.local`, `supabase/functions/.env` and `.env.e2e` into a worktree before serve/E2E.

## State

| Item         | State                                                                                                                         |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Production   | frontend `origin/main` `51c835a` on the release-1 backend; X-01 live; Next 16.4.0 + zod 4.6.5 with 3 published advisories     |
| Local `main` | = `origin/main` `51c835a`                                                                                                     |
| Branch       | `feat/v18-html-parity` = `2845675` + this docs commit: 58 migrations, 23 functions; deployed nowhere                          |
| Hotfix       | `hotfix/x01-deps` = `352182c` (X-01 + Next 16.4.3 + zod 4.6.7 on `51c835a`, verified), waits for the owner (step H1)          |
| In flight    | `feat/v216-professional-block` `99db95e` (5 commits), `feat/p01-professional-home` `2daaa5f` (3); p02/p07/p08 have no commits |

## Risks

1. Production: X-01 P1 live; sign-up enumeration live (fixed locally `4ff9852`); GHSA-2464-fhr4-w9xw (critical),
   GHSA-p3m5-59mp-jv5r (high), GHSA-mrhx-c7xc-m3w5 (high) until `352182c` (frontend) and the functions deploy (zod) ship.
2. Production Auth (read 2026-10-26): `site_url` localhost + empty allow-list → sign-up confirmation AND recovery links
   both point to localhost; minimum password 6; leaked-password check off; built-in SMTP (team addresses only, 2/h).
   Proposal, rollback and checks: `ROLLOUT_PLAN_V18_LOOP.md` §0b (not executed).
3. Deploy order if ever shipped: `ROLLOUT_PLAN_V18_LOOP.md` (38 migrations in file order → functions by name → frontend).
4. OD-3 off in production: nobody verified → nobody eligible there. Notices and account closure/export ship without a
   flag (OD-8 still OPEN in `07-decisions-index.md`).
5. Defaults needing owner sign-off before any remote use: T-111, T-128, T-86, retention of finished pack copies, free-text
   `description`/`arrival`, directory T9/T44/T-150 and `parked/directory-employer-block`.

## Blocked on the owner

Push of `352182c` (H1); §0b Auth PATCH (needs a token with Auth Config read-write); a Crew_Flex-only read token to
replace the current one (then revoke it); custom SMTP; every other push/deploy; STG option (F5); D-07 P3 + scanner; OD-3;
Q6 vs SCOPE-2; the `14-decision-pack.md` §2 rows; the T-xx sign-offs above.

## Next step (one)

F1c: per-function matrix of the other 8 advisor DEFINER functions (grant → `auth.uid()` check → tenancy → test) in
`docs/architecture/AUTHORIZATION.md`, revoking only what a test proves unused → F2 (v2-16, then P01). Never push or deploy.
