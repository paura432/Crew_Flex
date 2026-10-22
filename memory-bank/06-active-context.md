# 06 · Active context

_Last updated 2026-10-22 CEST. Keep under ~60 lines; replace, don't append history._

## Current task

2026-10-22 (owner): «copiarlo todo» — SCOPE-2 (NOW+NEXT+LATER locally, OUT out) and DEFAULTS (open decisions → v1.8
behaviour as a documented T-xx), recorded in `08-product-decisions.md`. Done today on `feat/v18-html-parity` (local,
not pushed): X-01…X-22 + review, M05 pause/resume/edit, M07 opportunities, M08 applications (agent backend merged),
M09 rules (off), exhaustive **diff v2** (`C:\Users\perfo\Downloads\CrewFlex_DIFF_HTML_v18_vs_Next_2026-10-22-v2\`:
1 587 rows, v1.8 demo + connected in execution, parity 56,1 %, unified backlog by packages).
Implementation packages (one worktree each, merged one by one; table in `15-autonomous-migration-backlog.md` §6.3):
MERGED learning, calendar, logbook; IN_PROGRESS passport, account, admin-org, requirement-builder, notices; queued
matching-v18, directory, pack-view, hiring-polish, outreach, recruiter, shell-visual, wallet-extras, server-floor.
Last full gate (HEAD `7682e92`): check 0 (665), E2E 48/48, race 11/11, ui-smoke 152/152 on `next build`.
Local DB: every migration up to `20261023300000` applied in place (logbook needed `migration up --include-all`
because its file sorts before the calendar one); restart `functions serve` after each migration batch.
X-01 is a P1 LIVE in production: hotfix branch `hotfix/x01-landing-signin` `15eb913` waits for the owner.

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
