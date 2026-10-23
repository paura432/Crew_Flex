# 06 · Active context

_Last updated 2026-10-23 17:50 CEST (parity loop running). Keep under ~60 lines; replace, don't append history._

## Current task

Owner 2026-10-23 pm: «PARIDAD TOTAL CON V1.8» brief (SPEC → PLAN → TASKS → IMPLEMENT → VERIFY, screen by screen P01…P14,
visual compare at 1440/1024/768/390/360, matrix 17-parity-matrix-v18 (in `docs/integration/crewflex-v13/`, created by P01), local only,
caveman wenyan-ultra + ponytail ultra). SCOPE-2 «copiarlo todo» and DEFAULTS (open decisions → v1.8 behaviour as a T-xx)
stand (`08-product-decisions.md`). Every subagent: Fable, effort xhigh. Branch `feat/v18-html-parity` (local, NOT
pushed) = `47b467e`: X-01…X-22, M05/M07/M08/M09, 16 packages MERGED (learning, calendar, logbook, passport, admin-org,
notices, requirement-builder, account, wallet-extras, hiring-polish, pack-view, matching-v18, outreach, shell-visual,
recruiter, **directory search-only** `42745f8`…`47b467e`). Directory: the organization-side «employer block» the
package first carried is NOT v1.8 (v1.8 `blockEmployer` = the professional's preference) and an independent security
review BLOCKED it (linkage / watch-list oracles) → removed; full version parked as tag `parked/directory-employer-block`
(= `881c587`) for the owner; delta review APPROVE WITH LOW FIXES (fixed in `47b467e`).
Last full gate (HEAD `47b467e`, db reset in file order, 57 migrations): `pnpm check` 0 except the worktree-path docs
test artefact (Vitest 1153, Deno 194), build 0 (Next nudge once, retry), E2E 48/48, race 19/19, ui-smoke **274/274** on
`next build && next start`.
In flight (one worktree each, all based on `02963e5`, to be rebased on integration): **v2-16 professional block**
(`feat/v216-professional-block`, migration `20261024800000`, `list_opportunities` + `apply_to_requirement` refuse
blocked organizations), **P01 professional home** (`feat/p01-professional-home`, T-161…), **P02 passport**
(`feat/p02-passport`, T-171…). After ANY local reset: flags via STDIN to `db-owner-sql.sh`, restart `functions serve`
(wait for the NEW edge_runtime container); copy the git-ignored `supabase/functions/.env` and `.env.e2e` into a worktree
before serve/E2E there. Husky pre-commit fails inside a worktree on `tests/docs/memory-bank.test.ts` (this file quoted a
worktree path): run the gate by hand, commit `--no-verify`, say so in the body.

## State

| Item         | State                                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production   | frontend `origin/main` `51c835a` on the release-1 backend; landing «Iniciar sesión» invisible (X-01); **Next 16.4.0 with 2 published advisories** |
| Local `main` | = `origin/main` `51c835a`                                                                                                                         |
| Branch       | `feat/v18-html-parity` = `47b467e` ≈ 185 commits over `main`: 57 migrations, 23 functions, T-01…T-158, BR-1…BR-29; deployed nowhere but local     |
| Hotfix       | `hotfix/x01-landing-signin` = `15eb913` on `51c835a` (3 files, verified), waits for the owner                                                     |

## Risks

1. Production: X-01 P1 live; sign-up enumeration live (fixed locally `4ff9852`); Next 16.4.0 advisories
   GHSA-2464-fhr4-w9xw (critical, image optimisation SVG RCE — `next/image` unused but the endpoint exists) and
   GHSA-p3m5-59mp-jv5r (high, Server Actions DoS). `next build` stops once with Next's nudge; retry passes. Upgrade =
   owner decision (asked 2026-10-23, no answer yet).
2. Deploy order if ever shipped: `docs/qa/ROLLOUT_PLAN_V18_LOOP.md` (migrations in file order → functions by name →
   frontend); several packages need owner Auth settings (confirmation on, redirect URLs, template, session limits).
3. OD-3 off in production: nobody verified → nobody eligible there. Notices and account closure/export ship without a
   flag (OD-8 still OPEN in `07-decisions-index.md`).
4. Defaults needing owner sign-off before any remote use: T-111 (rate + restriction texts in the pack copy), T-128
   (outreach k=5 / 10 per day), T-86 (profile rule columns seed-only until the builder exposes them), retention of
   finished pack copies, free-text `description`/`arrival` visible to every professional (T-11 said no free text);
   directory: gate to `reviewed` organizations or daily budget (T9), window-probe residual (T44), notify professionals
   of the visibility-copy change (T-150), revive or discard `parked/directory-employer-block`.

## Blocked on the owner

Pushes/deploys (hotfix X-01 included), Next upgrade go/no-go, D-07 P3 + scanner, OD-3 activation, Q6 vs SCOPE-2
(partial coverage), the `14-decision-pack.md` §2 rows not answered on 2026-10-22, the T-xx sign-offs above.

## Next step (one)

Integrate v2-16, P01, P02 as they land (rebase onto the tip → file-order db reset + flags (STDIN) + types →
`functions serve` → check/build/E2E/race → smoke → independent review → ff-merge → this file + `01-current-state.md`),
merge each package's matrix section into the 17-parity-matrix-v18 file, then continue P03…P14 in the brief's order
(calendar, opportunities, applications, wallet, logbook, tools, company dashboard, needs/matching, recruiter, admin,
messaging/notices, shell). Never push or deploy.
