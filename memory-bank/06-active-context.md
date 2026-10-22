# 06 · Active context

_Last updated 2026-10-22 CEST. Keep under ~60 lines; replace, don't append history._

## Current task

2026-10-22 loop (owner brief «DESBLOQUEAR MIGRACIÓN V1.8»): the xhigh diff backlog X-01…X-22 and the decisions
the owner ratified that day (D-12 visibility, D-06 Q2–Q7, M05 lifecycle, D-07 P1/P2/P4 direction with P3 open,
Q-01 password 12 — `docs/integration/crewflex-v13/08-product-decisions.md` §2026-10-22, defaults T-08…T-14).
Backlog and evidence: `docs/integration/crewflex-v13/15-autonomous-migration-backlog.md` §6. Branch
`feat/v18-html-parity` (local, not pushed). Source diff (outside the repo):
`C:\Users\perfo\Downloads\CrewFlex_DIFF_HTML_v18_vs_Next_2026-10-22-xhigh\`.

- X-01…X-22: done (X-21 NOT_A_GAP), independent review R-X fixed (`f37a231`). Gates at `b8258d9`: check 0,
  build 0, E2E 42/42, ui-smoke 113 PASS (the 2 FAIL were the smoke itself / an in-progress edit; fixed).
- X-01 is a P1 LIVE in production: hotfix candidate branch `hotfix/x01-landing-signin` `15eb913` (3 files,
  verified on `next start`) — **push needs the owner**.
- M05 pause/resume done (`9868253`, migrations `20261022130000/130100`, applied to the local DB in place).
- M07/M08: contract committed (`984112f`); backend (migrations `20261022130200/130300`, RPCs, the `opportunities`
  and `applications` functions, PGlite suites U/V/W) in progress on an agent worktree branch; UI written against
  the contract (uncommitted until the backend is merged and E2E runs). M09: rules prepared, switched off
  (`a1e1223`).

## State

| Item         | State                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Production   | frontend `origin/main` `51c835a` on the release-1 backend; landing «Iniciar sesión» invisible (X-01) until the owner ships the hotfix |
| Local `main` | = `origin/main` `51c835a`                                                                                                             |
| Branch       | `feat/v18-html-parity`: everything above; new migrations not deployed anywhere but the local Docker DB                                |

## Risks

1. Production: X-01 P1 live; release-2 backend vs Vercel rollback still undecided (owner).
2. Deploy order for this branch (if ever shipped): migrations `20261022130000` → `130100` → functions that know `paused`
   (old ones answer 500: `toWorkRequirement` parses status with `z.enum`) → frontend. Then `130200/130300` →
   `opportunities`, `applications`, `work-requirements` → frontend.
3. OD-3 off in production: nobody is verified, so nobody is eligible to apply or be confirmed there.
4. Next `signOut()` is now `scope: "local"` (X-12); the password reset stays global.

## Blocked on the owner

Pushes/deploys (hotfix X-01 included), D-07 P3 + scanner (Candidate Pack activation), OD-3 activation, the
remaining `14-decision-pack.md` §2 rows not answered on 2026-10-22.

## Next step (one)

Merge the backend branch, apply its migrations locally (`sb-local.sh migration up`), restart `functions serve`, run
the hiring E2E + ui-smoke on `next build`, independent security review, then commit the M07/M08 UI.
