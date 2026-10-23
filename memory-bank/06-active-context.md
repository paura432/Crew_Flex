# 06 · Active context

_Last updated 2026-10-23 CEST (paused by the owner: «para por ahora»). Keep under ~60 lines; replace, don't append history._

## Current task

Owner 2026-10-22: «copiarlo todo» — SCOPE-2 (NOW+NEXT+LATER locally, OUT out) and DEFAULTS (open decisions → v1.8
behaviour as a documented T-xx), recorded in `08-product-decisions.md`. Owner 2026-10-23: every subagent runs on Fable
at extra-high effort. Branch `feat/v18-html-parity` (local, NOT pushed): X-01…X-22, M05/M07/M08/M09, the exhaustive
**diff v2** (`C:\Users\perfo\Downloads\CrewFlex_DIFF_HTML_v18_vs_Next_2026-10-22-v2\`, 1 587 rows, parity 56,1 %) and
its implementation packages, one worktree each, merged one by one with the full gate (table and gate numbers in
`15-autonomous-migration-backlog.md` §6.3):
MERGED (15) learning, calendar, logbook, passport, admin-org, notices, requirement-builder, account, wallet-extras
(+N-26), hiring-polish, pack-view, matching-v18, outreach, shell-visual, recruiter · directory: agent STOPPED at the
owner's pause with 4 commits in worktree `.claude/worktrees/agent-a233810a77af48968` (branch
`worktree-agent-a233810a77af48968`, tip `d20d278`, based on `6df3bca`, gates NOT finished, not reviewed, not merged).
Last full gate (HEAD `c093523`, db reset in file order): `pnpm check` 0 (1123 Vitest, 188 Deno), E2E 48/48,
`db-race-check.sh all` 19/19, ui-smoke **259/259** on `next build && next start`.
Real defects found by the smoke this loop and fixed: sign-up enumeration (`4ff9852`), archive notice lost on
re-render (`51d1292`). Local DB: all 57 migrations applied (reset in file order after every package whose files sort
before an applied one); after ANY reset: pipe the flag inserts to `db-owner-sql.sh` (STDIN!) and restart
`functions serve` (wait for the NEW edge_runtime container). Local Auth now has e-mail confirmations ON + 12 h timebox
(account package): an auth config change needs `sb-local.sh stop` + `start`.

## State

| Item         | State                                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production   | frontend `origin/main` `51c835a` on the release-1 backend; landing «Iniciar sesión» invisible (X-01); **Next 16.4.0 with 2 published advisories** |
| Local `main` | = `origin/main` `51c835a`                                                                                                                         |
| Branch       | `feat/v18-html-parity` ≈ 160 commits over `main`: 53 migrations, 23 functions, T-01…T-129, BR-1…BR-26; deployed nowhere but the local Docker DB   |
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
   finished pack copies, free-text `description`/`arrival` visible to every professional (T-11 said no free text).

## Blocked on the owner

Pushes/deploys (hotfix X-01 included), Next upgrade go/no-go, D-07 P3 + scanner, OD-3 activation, Q6 vs SCOPE-2
(partial coverage), the `14-decision-pack.md` §2 rows not answered on 2026-10-22, the T-xx sign-offs above.

## Next step (one)

Resume the directory package: in its worktree run the gates (`pnpm check`, build), an independent security review
(Fable xhigh; focus: requirement-less search as an oracle, pseudonym linkability), then integrate with the usual
procedure (rebase onto the tip → file-order db reset + flags (STDIN) + types → `functions serve` → check/E2E/race →
smoke). Then the final pass: whole-branch adversarial security review, `10-master-matrix.md` rows,
`ROLLOUT_PLAN_V18_LOOP.md` with every migration/function, `01-current-state.md`, blockers report. Never push or deploy.
