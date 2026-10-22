# 06 · Active context

_Last updated 2026-10-22 CEST. Keep under ~60 lines; replace, don't append history._

## Current task

2026-10-22 (backend, worktree branch off `feat/v18-html-parity` 984112f): **M07 opportunities (D-12) + M08
applications (D-06) + M05 edit**, LOCAL ONLY, committed on the worktree branch, nothing applied or deployed:
`supabase/migrations/20261022130200_opportunities.sql`, `supabase/migrations/20261022130300_applications.sql`,
functions `opportunities` / `applications` + `work-requirements` PUT, CFA01…CFA12 → 409 `reason`. PGlite 154/154
(suites U/V/W), Deno 98. NOT RUN: `scripts/local/db-race-check.sh applications`, E2E via `functions serve` (need the
migrations applied to the local stack, then restart `functions serve`). Frontend wiring is the frontend engineer's.

2026-10-22: **D-13** (owner) — platform admins get the four v1.8 views through a «Ver como» switcher over their
OWN account (`src/components/layout/views.ts`, `ViewSwitcher.tsx`; `/app/admin` home, `/app/recruiter`
placeholder; sidebar shows the active view's menu; seed gives `platform.admin` the org «CrewFlex Operaciones»).
Review fix: requirement detail/matches are 404 for another organization (platform admins read every tenant).
**Uncommitted** on `feat/v18-html-parity`. Gates: `pnpm check` 0 (488 pass, 32 SKIPPED), build 0, E2E local 42/42,
ui-smoke **110/110** — first smoke run on this branch: fixed W1-10 (confirm step), W5-01 (12c via RPC) drift; run
`cleanup-test-rows.sh` before the smoke (the requirements list pages at 20 since W5-02). Local DB has the
`20261021120000` migration and the D-13 seed rows applied in place (no reset).

Previous loop (2026-10-21): element-by-element diff of the v1.8 HTML bundle (`CrewFlex_v1.8.html`,
sha256 `0c4875ee…`) against `51c835a`, then its decision-free backlog, one task per commit, on the local branch
**`feat/v18-html-parity`** (40 commits ahead of `main`, not pushed). Status, SHAs, gates and iteration log:
`docs/integration/crewflex-v13/16-html-v18-diff.md` (37 VERIFIED, W2-10/W2-12 BLOCKED on AB-34/AB-28; Q-01…Q-03 are
owner questions). The earlier autonomous backlog (`15-autonomous-migration-backlog.md`, AB-01…AB-39) stays closed.
Local gotchas: `pkill -f "next …"` kills the calling shell — kill the PID from `ss -ltnp`; run `ui-smoke` on
`next build && next start`; Playwright's `page.evaluate` trips the report-only CSP (eval) — the smoke has an
uninstrumented pass (17c) for the real answer; after `release-compat/run.sh` or `release2.sh` re-insert the `qualification_review`
flag and restart `functions serve` (the wallet E2E fails 2/42 until the restart). No Docker in this WSL today: E2E,
ui-smoke and `functions serve` were BLOCKED for the whole v1.8 HTML loop (PGlite, Vitest and Deno ran); Docker is back on 2026-10-22.

## State

| Item         | State                                                                                                                                                                                                                             |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production   | frontend `origin/main` `51c835a` (pushed 2026-10-20, Vercel success) on the release-1 backend (15 migrations, 8 functions): org dashboard focus 400 and close 405, latent with 0 orgs                                             |
| Local `main` | = `origin/main` `51c835a`; backend not deployed: migrations `1602xx`, `20261020120000`, `20261020120100`; `work-requirements` fn changed                                                                                          |
| Gates        | `main`: `pnpm check` 0 (418 pass, 32 SKIPPED = E2E without env), build 0, E2E 42/42, ui-smoke 105/105, RLS 115/115, release-2 drill 23/23                                                                                         |
| Branch       | `feat/v18-html-parity` (local): `pnpm check` 0 (481 pass, 32 SKIPPED; RLS 116/116; Deno 75), build 0; E2E/ui-smoke not run (no Docker). Adds migration `20261021120000`; changes `work-requirements`, `professional-availability` |

## Risks

1. `main` is already live as `51c835a` on the release-1 backend: deploy the release-2 backend or roll Vercel back (owner). Never push again without that decision.
2. T22: production Auth accepts a password change from any session until «require current password» is on (owner).
3. CSP is report-only: flip to enforcing only after a clean production report window (deploy plan).
4. `feat/v18-html-parity` deploy order (if merged): `work-requirements` before the frontend (W5-01/W5-02), migration `20261021120000` before `professional-availability` (W5-03). Its migration is not in the release-2 plan or drill.
5. Release 2 has its own plan and drill (`docs/qa/ROLLOUT_PLAN_RELEASE2.md`, `release2.sh` 23/23); the release-1 harness (`run.sh`) stays for history. R2-core needs the close migrations renamed in a release checkout (not done).

## Blocked on the owner — only `14-decision-pack.md` §2

D-06 Q2–**Q7** ratification, D-07 P1–P4 (+ P3 period), D-12 visibility, requirement lifecycle, C-10/D-02/D-03,
OD-6, OD-7, account/wallet retention, AOG opt-in (NEXT vs LATER), audit view, LATER scheduling (+ Candidate Pack
NEXT/LATER conflict), C-12, T22, OD-3 activation. Production E2E and demo users: paused by the owner.

## Next step (one)

Owner reviews `feat/v18-html-parity` (local; push and PR need approval) together with the open production decision
(release-2 backend or Vercel rollback) and Q-01…Q-03 of `16-html-v18-diff.md`; then §2 of the pack → M07 (D-12) /
M08 (D-06) / M09 (D-07) with the test design in `APPLICATIONS_STATE_MACHINE.md` §4.2.
