# 06 · Active context

_Last updated 2026-10-26 11:20 CET (isolated migration plan, batch F0+F1a closed). Keep under ~60 lines; replace, don't append history._

## Current task

Owner 2026-10-26: isolated plan to finish the v1.8 migration (briefs `tmp/CLAUDE_CREWFLEX_100_2026-10-26.md` and
`tmp/CrewFlex_migration_audit_2026-10-26.md`, git-ignored; ponytail ultra + caveman wenyan-ultra). Both briefs were written
outside the repo on the `02963e5` ZIP and are stale (directory is merged search-only; local = 57 migrations / 23 functions).
Phases: F0 baseline → F1 P0 security (local) → F2 integrate v2-16 and P01 → F3 parity P02…P14 (17-parity-matrix-v18 is the
only matrix; % = closed rows with a test / applicable rows, none before) → F4 local release candidate → F5 STG (owner) →
F6 production, one approval per step. Isolation: one worktree and short branch per batch, ff-merge here after gate +
independent review, zero remote writes. SCOPE-2 and DEFAULTS (`08-product-decisions.md`) stand; every subagent: Fable, xhigh.
Done 2026-10-26: F0 (v1.8 ZIP sha256 `53ee5b61…` = `tmp/references/crewflex-v18`; remote recount BLOCKED, 403) and F1a
(`fix/next-16.4.3` `dc1b421` merged at `d027183`; production candidate `hotfix/x01-deps` `352182c`).
Gate at `d027183` (db reset in file order, 57 migrations, flags, fresh `functions serve`): `pnpm check` 0 (Vitest 1154,
Deno 194), build 0 first run, E2E 48/48, race 19/19, ui-smoke 274/274 on `next build && next start`.
After ANY local reset: flags via STDIN to `db-owner-sql.sh`, restart `functions serve` (wait for the NEW edge_runtime
container); copy the git-ignored `.env.local`, `supabase/functions/.env` and `.env.e2e` into a worktree before serve/E2E.

## State

| Item         | State                                                                                                                         |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Production   | frontend `origin/main` `51c835a` on the release-1 backend; X-01 live; Next 16.4.0 + zod 4.6.5 with 3 published advisories     |
| Local `main` | = `origin/main` `51c835a`                                                                                                     |
| Branch       | `feat/v18-html-parity` = `d027183` + this docs commit: 57 migrations, 23 functions, T-01…T-158, BR-1…BR-29; deployed nowhere  |
| Hotfix       | `hotfix/x01-deps` = `352182c` (X-01 + Next 16.4.3 + zod 4.6.7 on `51c835a`, verified), waits for the owner (step H1)          |
| In flight    | `feat/v216-professional-block` `99db95e` (5 commits), `feat/p01-professional-home` `2daaa5f` (3); p02/p07/p08 have no commits |

## Risks

1. Production: X-01 P1 live; sign-up enumeration live (fixed locally `4ff9852`); GHSA-2464-fhr4-w9xw (critical),
   GHSA-p3m5-59mp-jv5r (high), GHSA-mrhx-c7xc-m3w5 (high) until `352182c` (frontend) and the functions deploy (zod) ship.
2. Deploy order if ever shipped: `docs/qa/ROLLOUT_PLAN_V18_LOOP.md` (migrations in file order → functions by name →
   frontend); several packages need owner Auth settings (confirmation on, redirect URLs, template, session limits).
3. OD-3 off in production: nobody verified → nobody eligible there. Notices and account closure/export ship without a
   flag (OD-8 still OPEN in `07-decisions-index.md`).
4. Defaults needing owner sign-off before any remote use: T-111 (rate + restriction texts in the pack copy), T-128
   (outreach k=5 / 10 per day), T-86 (profile rule columns seed-only until the builder exposes them), retention of
   finished pack copies, free-text `description`/`arrival` visible to every professional (T-11 said no free text);
   directory: gate to `reviewed` organizations or daily budget (T9), window-probe residual (T44), notify professionals
   of the visibility-copy change (T-150), revive or discard `parked/directory-employer-block`.
5. Claude cannot read the remote project (CLI 403, MCP refused): every remote count comes from the owner.

## Blocked on the owner

Push of `352182c` (H1), every other push/deploy, STG option (F5: second free project recommended), D-07 P3 + scanner,
OD-3 activation, Q6 vs SCOPE-2 (partial coverage), the `14-decision-pack.md` §2 rows not answered on 2026-10-22, the
T-xx sign-offs above, production Auth settings (leaked-password protection included).

## Next step (one)

F1b: additive migration revoking EXECUTE on the trigger-only `handle_new_user`, `audit_requirement_created` and
`audit_qualification_verified` from `public`, `anon` and `authenticated`, with PGlite tests (sign-up still creates the profile
and membership, audit rows still written, direct RPC refused) → F1c DEFINER matrix in `AUTHORIZATION.md` → F2. Never
push or deploy.
