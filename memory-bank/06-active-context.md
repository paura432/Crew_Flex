# 06 · Active context

_Last updated 2026-10-20 (evening) CEST. Keep under ~60 lines; replace, don't append history._

## Current task

V1.8 → Next.js migration, LOCAL only, run as an autonomous loop (INVESTIGATE → SPEC → PLAN → IMPLEMENT → VERIFY →
AUDIT → RECORD → NEXT). **Single source of tasks: `docs/integration/crewflex-v13/15-autonomous-migration-backlog.md`**
(rows AB-01…AB-29, iteration log, last QA block). Target = v1.8 (`tmp/CrewFlex_v1.8.zip`, sha256 `53ee5b61…`).
Done today after the second audit: batches 13 (visual P2), 14 (TD-44 review list + BR-12 chip), 15 (cross-module
junctions), 16 (M07–M09 docs: Q7, audit names, test design T1–T13), 17 (report-only nonce CSP, zod `jitless`), plus
the independent review of 13–14 (2 Medium fixed). `/fable-loop`, `/fable-method`, `/fable-judge` are **not installed**;
the loop runs by hand with explorer/reviewer subagents.
Local gotchas: `pkill -f "next …"` kills the calling shell — kill the PID from `ss -ltnp`; run `ui-smoke` on
`next build && next start`; Playwright's `page.evaluate` trips the report-only CSP (eval) — the smoke has an
uninstrumented pass (17c) for the real answer; after `release-compat/run.sh` re-insert the `qualification_review`
flag and restart `functions serve`.

## State

| Item         | State                                                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Production   | `origin/main` `65df3b9` (release 1), unchanged; 15 migrations; 8 functions; Auth untouched                                         |
| Local `main` | ahead of `65df3b9`, not pushed; local-only migrations `1602xx`, `20261020120000`, `20261020120100`; `work-requirements` fn changed |
| Gates        | HEAD: `pnpm check` 0 (414 pass, 32 SKIPPED = E2E without env), build 0, E2E 42/42, ui-smoke 105/105, RLS 115/115                   |

## Risks

1. Never `git push origin main`: it would publish the wallet and every local batch.
2. T22: production Auth accepts a password change from any session until «require current password» is on (owner).
3. CSP is report-only: flip to enforcing only after a clean production report window (deploy plan).
4. `release-compat` expectations are hard-coded for release 1; a release-2 plan needs its own.

## Blocked on the owner — only `14-decision-pack.md` §2

D-06 Q2–**Q7** ratification, D-07 P1–P4 (+ P3 period), D-12 visibility, requirement lifecycle, C-10/D-02/D-03,
OD-6, OD-7, account/wallet retention, AOG opt-in (NEXT vs LATER), audit view, LATER scheduling (+ Candidate Pack
NEXT/LATER conflict), C-12, T22, OD-3 activation. Production E2E and demo users: paused by the owner.

## Next step (one)

Decision-free work is exhausted (backlog: every TODO is VERIFIED, NOT_A_GAP, DEFERRED with a technical reason, or
BLOCKED on a decision). Next: owner answers §2 of the pack → M07 (D-12) / M08 (D-06) / M09 (D-07) with the test
design in `APPLICATIONS_STATE_MACHINE.md` §4.2; or a publication plan for the local batches (owner authorisation).
