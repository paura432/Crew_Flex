# 12 · Completion roadmap — remaining v1.8 migration

Written 2026-10-20 from `11-independent-parity-audit.md`. Target = **v1.8** (connected app for contracts,
demo for screens). No dates: order and size only. Effort: S (≤ ½ day), M (1–2 days), L (> 2 days).
Everything is LOCAL until the owner approves a separate publication plan.

## 1. Order

| #     | Batch                                                                   | Module              | Content                                                                                                       | Depends on        | Decision                    | Effort | Acceptance                                                   |
| ----- | ----------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------- | ------ | ------------------------------------------------------------ |
| 5 ✓   | Second-audit fixes                                                      | M01/M06             | reset gate, compare persistence, BR-11/12                                                                     | —                 | —                           | S      | `password-reset-check` 19/19, smoke 11k–11m                  |
| 6 ✓   | Close requirement                                                       | M05                 | V1.8 `job.status` closed, terminal, audited                                                                   | —                 | —                           | S      | RLS suite M, E2E close, smoke 12b                            |
| 7 ✓   | Calendar visual parity                                                  | M04/M17             | AOG day orange (v1.8 `#fff3e6/#bd752b`), hatched partial day (v18.css:1)                                      | —                 | —                           | S      | smoke checks computed colours; ES/EN legend unchanged        |
| 8 ✓   | Small security debts                                                    | M01/M06             | `redirectTo` from the configured site URL (S-4); cap `compare` params (S-5)                                   | —                 | —                           | S      | unit tests; reset check still 19/19                          |
| 9 ✓   | Offer derived state                                                     | M05                 | «Vencida» (all days past) and the list badge, display only (CO-96)                                            | —                 | —                           | S      | domain test at the day boundary (BR-10 UTC)                  |
| 10 ✓  | Touch targets + feedback                                                | M17                 | 44 px controls (v12.css:2); danger button variant                                                             | —                 | —                           | S      | smoke at 390/360 px, no overflow                             |
| 11 ◐  | Applications contract (design only)                                     | M08                 | pure transition table (done) + test design §4.2 (done); **SQL schema/RLS only after ratification (§4.1)**     | —                 | D-06 Q2–Q7 ratification     | M      | §4.2 scenarios T1–T13 red-green on PGlite; nothing reachable |
| 12    | Opportunities                                                           | M07                 | published needs visible to professionals, eligibility explained, filters TD-94                                | 11                | D-06, D-12 visibility       | L      | cross-org/visibility RLS tests                               |
| 13    | Applications → assignment                                               | M08                 | apply, shortlist, propose (version), accept snapshot, confirm gates, cancel, finish; assigned days (TD-56/64) | 11, 12            | D-06 Q2–Q6                  | L      | full journey E2E, concurrency on capacity                    |
| 14    | Requirement lifecycle                                                   | M05                 | pause/reopen (`paused`), close blocked by active assignments                                                  | 13                | lifecycle decision          | M      | RLS + E2E                                                    |
| 15    | Candidate Pack                                                          | M09                 | consent, snapshot, unlock, revocation                                                                         | 13, M10 release 2 | D-07 P1–P4, D-10 scanner    | L      | privacy tests                                                |
| 16    | Notifications (internal)                                                | M12                 | list, unread, mark read; on transitions                                                                       | 13                | C-11                        | M      | —                                                            |
| 17    | AOG opt-in + outreach                                                   | M03/M04             | `aogOptIn`, quiet hours, mobilisation; TD-65                                                                  | —                 | resolve NEXT/LATER conflict | M      | BR-4.8 parity tests                                          |
| 18    | Passport fields                                                         | M03                 | restrictions → ineligible, English, engines, permits                                                          | —                 | C-10/D-02/D-03, OD-6        | M–L    | matching parity tests                                        |
| later | Recruiter, admin ops, logbook, learning, fuel, glossary, service worker | M11/M13/M14/M16/M15 | —                                                                                                             | —                 | D-12, OD-3/5/8, scope, D-11 | —      | —                                                            |

Autonomous loop (2026-10-20, `15-autonomous-migration-backlog.md`): batches 13 (visual P2), 14 (TD-44), 15 (integration junctions), 16 (M07–M09 docs) done. Second pass (2026-10-20): 7–10 done; visual batch 11 of the owner brief = `14bd7c4`; the pure
application table of row 11 is done (`src/domain/applications.ts`) — its SQL schema/RLS stays for after
D-06 ratification (§4.1 forbids migrations before it). S-4 closed by evidence (allowlist), not by code.

## 2. Risks

- Applications touch capacity under concurrency: use one transaction per transition with row locks (v1.8
  serialised everything with `BEGIN IMMEDIATE`, A:43).
- Visual batches must not reintroduce v1.8 security shortcuts (directory owner id, `admin/admin`, raw tokens).
- Production carries release 1 only; every local migration since `20261019160000` needs the publication plan.

## 3. QA strategy

Per batch: `pnpm check`, `pnpm build`, `git diff --check`; PGlite RLS cases for every new policy/trigger;
local E2E (`node --env-file=.env.e2e node_modules/vitest/vitest.mjs run tests/e2e`); `scripts/local/ui-smoke.mjs`
on the local stack; independent review agent after each commit. `SKIPPED` is reported as such.
