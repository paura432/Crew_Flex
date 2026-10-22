# Publication plan — `feat/v18-html-parity` (v1.8 loop of 2026-10-21/22) · FOR OWNER APPROVAL · NOT EXECUTED

> Written 2026-10-22. **Nothing here has been run against production.** Every step needs its own explicit owner
> approval (AGENTS.md «STOP»; OD-9 main-only: a push to `main` is a production deploy). This plan is SEPARATE from
> `ROLLOUT_PLAN_RELEASE2.md` (release 2 = `65df3b9..51c835a`, still undecided: deploy its backend or roll Vercel back).
> Living document: the SCOPE-2 packages still being merged add migrations/functions; §2 lists the state at the last
> update and must be re-read from `git log origin/main..<release-sha>` before any step.

## 0. Production today and the first, separate step: the X-01 hotfix

- Production frontend: `origin/main` = `51c835a` (Vercel), backend = release 1 (15 migrations, 8 functions). The
  landing «Iniciar sesión» is **white on white** there (X-01, P1, read-only GET confirmed 2026-10-22).
- **Hotfix candidate:** local branch `hotfix/x01-landing-signin` = `15eb913` on top of `51c835a` — 3 source files
  (`src/app/page.tsx`, `src/components/ui/Button.tsx`, `src/features/preferences/components/LocaleSwitcher.tsx`), no
  backend change, compatible with the release-1 backend. Verified locally: typecheck, lint, 418 tests, `next build`,
  `next start` with computed colours at 1440/390 es/en.
- Step H1 (owner): `git push origin 15eb913:main` (fast-forward of `51c835a`). Step H2: open https://crew-flex.vercel.app/
  and read the «Iniciar sesión» button. Rollback: Vercel «Promote» of the previous deployment.
- If release 2 is pushed first, cherry-pick `ef4d9b7` (same fix on the branch) instead.

## 1. What the branch adds (state at this update)

| Group            | Content                                                                                          | Backend                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| X                | xhigh diff X-01…X-22 + review R-X (UI, a11y, i18n, proxy 404, sign-out local scope, password 12) | `work-requirements` (X-04 out-of-range page)                                                                                                      |
| W5               | past start refused, paginated list, availability version check                                   | `work-requirements`, `professional-availability`, migration `20261021120000`                                                                      |
| M05              | pause/resume, edit without applications, close refused with commitments                          | migrations `20261022130000`, `20261022130100`, `20261022130300` (guards), `work-requirements` PATCH/PUT, `capacity-evaluate`, `matching-evaluate` |
| M07              | opportunities for professionals                                                                  | migration `20261022130200`, new function `opportunities`                                                                                          |
| M08              | applications and hiring circuit                                                                  | migration `20261022130300`, new function `applications`                                                                                           |
| M09              | Candidate Pack rules, switched off                                                               | none                                                                                                                                              |
| learning         | English/acronyms, translator, daily challenge (client only)                                      | none                                                                                                                                              |
| SCOPE-2 packages | passport, logbook, calendar, account, admin-org, requirement builder, notices, …                 | see `15-autonomous-migration-backlog.md` §6.3 (each adds migrations `2026102310…`–`2026102380…` and functions)                                    |

## 2. Preconditions (owner decisions, before any step)

1. Release 2 resolved (pushed with its backend, or rolled back): this branch sits on top of it.
2. **OD-3 in production.** With the review off nobody is `verified`, so in production nobody is eligible to apply or
   to be confirmed: M07/M08 ship «empty» until OD-3 is activated (verifier list + evidence procedure).
3. Auth settings that the branch assumes (production Auth is the owner's): minimum password 12 (Q-01: the app already
   refuses < 12), e-mail confirmation redirect `/auth/confirm**` (release-2 step 3), and whatever the account package
   adds (12 h session, invitation flag OFF by default).
4. D-07 P3 + D-10 stay closed: nothing in the branch shares contact or documents with organizations.

## 3. Order (each line = one approval; stop on any deviation)

| Step | Action                                                                                                                                                                                                              | Why here                                                                                                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 0    | Preflight read-only: remote `main` SHA, `migration list --linked`, deployed function versions; `git merge-base --is-ancestor` of the release SHA                                                                    | know the starting point                                                                                                   |
| 1    | `db push` of the pending migrations **in file order** (`20261021120000` → `20261022130000` → `130100` → `130200` → `130300` → package files) — `--dry-run` first, exact list compared with §1                       | `20261022130000` (enum value) must commit before `130100` uses it; the functions of step 2 parse the new statuses         |
| 2    | Deploy, BY NAME, never bare: `work-requirements professional-availability capacity-evaluate matching-evaluate opportunities applications` (+ package functions) with `--use-api --project-ref sbjkzrkmcekokkqiuvvh` | the old functions answer 500 on `paused` (`toWorkRequirement` parses status with `z.enum`) and 400 on the new list params |
| 3    | `git push origin <release-sha>:main`                                                                                                                                                                                | frontend last: it calls routes that must exist                                                                            |
| 4    | Owner checks signed in: dashboards render, Oportunidades/Mis candidaturas render (empty while OD-3 is off), requirement pause/resume/close, no CSP report in DevTools                                               | smoke of the critical paths                                                                                               |

Compatibility already proven locally: the old frontend (`51c835a`) on the new functions and schema sends a subset of
the new API (no `paused`, no PUT); new functions on the old schema are NOT supported — hence step 1 before 2.

## 4. Local evidence to attach to each approval

`pnpm check` 0 · `pnpm build` 0 · local E2E (48 at the M07/M08 merge) · `scripts/local/db-race-check.sh all` PASS ·
`scripts/local/ui-smoke.mjs` on `next build && next start` (130 steps at the learning merge; re-run on the release SHA) ·
PGlite RLS suites. Record the numbers of the release SHA in `memory-bank/01-current-state.md` before step 1.

## 5. Rollback

- Frontend: Vercel «Promote» of the previous production deployment.
- Functions: redeploy the previous versions by name (the old functions read the new schema except `paused`/new
  statuses: pause nothing in production before rolling back, or roll the functions forward again).
- Migrations: forward-only, never dropped; additive tables/columns stay empty.
