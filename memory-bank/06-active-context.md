# 06 · Active context

_Last updated 2026-10-20 (evening) CEST. Keep under ~60 lines; replace, don't append history._

## Current task

V1.8 → Next.js migration, LOCAL only, run as an autonomous loop (INVESTIGATE → SPEC → PLAN → IMPLEMENT → VERIFY →
AUDIT → RECORD → NEXT). **Single source of tasks: `docs/integration/crewflex-v13/15-autonomous-migration-backlog.md`**
(rows AB-01…AB-39, iteration log, last QA block). Target = v1.8 (`tmp/CrewFlex_v1.8.zip`, sha256 `53ee5b61…`).
Done today after the second audit: batches 13 (visual P2), 14 (TD-44 review list + BR-12 chip), 15 (cross-module
junctions), 16 (M07–M09 docs: Q7, audit names, test design T1–T13), 17 (report-only nonce CSP, zod `jitless`), plus
the independent review of 13–14 (2 Medium fixed). `/fable-loop`, `/fable-method`, `/fable-judge` are **not installed**;
the loop runs by hand with explorer/reviewer subagents. Master loop (2026-10-20, later brief): batch 18 = release-2
publication readiness (drill + plan, AB-39); P0 hiring circuit stays BLOCKED_DECISION (§4.1 of `APPLICATIONS_STATE_MACHINE.md`).
Local gotchas: `pkill -f "next …"` kills the calling shell — kill the PID from `ss -ltnp`; run `ui-smoke` on
`next build && next start`; Playwright's `page.evaluate` trips the report-only CSP (eval) — the smoke has an
uninstrumented pass (17c) for the real answer; after `release-compat/run.sh` or `release2.sh` re-insert the `qualification_review`
flag and restart `functions serve` (the wallet E2E fails 2/42 until the restart).

## State

| Item         | State                                                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production   | frontend `origin/main` `51c835a` (pushed 2026-10-20, Vercel success) on the release-1 backend (15 migrations, 8 functions): org dashboard focus 400 and close 405, latent with 0 orgs |
| Local `main` | = `origin/main` `51c835a`; backend not deployed: migrations `1602xx`, `20261020120000`, `20261020120100`; `work-requirements` fn changed                                              |
| Gates        | HEAD: `pnpm check` 0 (418 pass, 32 SKIPPED = E2E without env), build 0, E2E 42/42, ui-smoke 105/105, RLS 115/115, release-2 drill 23/23                                               |

## Risks

1. `main` is already live as `51c835a` on the release-1 backend: deploy the release-2 backend or roll Vercel back (owner). Never push again without that decision.
2. T22: production Auth accepts a password change from any session until «require current password» is on (owner).
3. CSP is report-only: flip to enforcing only after a clean production report window (deploy plan).
4. Release 2 has its own plan and drill (`docs/qa/ROLLOUT_PLAN_RELEASE2.md`, `release2.sh` 23/23); the release-1 harness (`run.sh`) stays for history. R2-core needs the close migrations renamed in a release checkout (not done).

## Blocked on the owner — only `14-decision-pack.md` §2

D-06 Q2–**Q7** ratification, D-07 P1–P4 (+ P3 period), D-12 visibility, requirement lifecycle, C-10/D-02/D-03,
OD-6, OD-7, account/wallet retention, AOG opt-in (NEXT vs LATER), audit view, LATER scheduling (+ Candidate Pack
NEXT/LATER conflict), C-12, T22, OD-3 activation. Production E2E and demo users: paused by the owner.

## Next step (one)

Decision-free work is exhausted (backlog: every row is VERIFIED, NOT_A_GAP, DEFERRED with a technical reason, or
BLOCKED on a decision; AB-39 added the publication plan). Next: the owner answers §2 of the pack and picks the release-2
composition (`ROLLOUT_PLAN_RELEASE2.md` §1) → M07 (D-12) / M08 (D-06) / M09 (D-07) with the test design in
`APPLICATIONS_STATE_MACHINE.md` §4.2, and the publication steps 0–5 one approval at a time.
