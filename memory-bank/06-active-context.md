# 06 · Active context

_Last updated 2026-10-19 CEST. Keep under ~60 lines; replace, don't append history (history lives in
Git and `docs/audit/`)._

## Current task

Prototype parity migration (owner brief + decisions of 2026-10-19), local only. Done locally:
cycle generator, review fixes, tools (D-11), «AOG only» (C-8/D-05), document wallet owner-only
(D-10, gated). Design docs for owner review: D-06 `docs/product/APPLICATIONS_STATE_MACHINE.md`,
D-07 `CANDIDATE_PACK.md`, D-12 `RECRUITER_MODEL.md`.

## State

| Item               | State                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| Local commits      | `727d8ab`…`969adb2` + docs commit: **not pushed**. Wave-1 release commit = `65df3b9` (verified standalone) |
| Local migrations   | `20261019120000`…`160100` applied to the local Docker DB only                                              |
| Gates (2026-10-19) | `pnpm check` PASS (Vitest 352, Deno 63), build PASS, local E2E 27/27, race checks 6/6, browser checks PASS |
| Production         | Unchanged (`ddf5c4b`). Plan for approval: `docs/qa/ROLLOUT_PLAN_2026-10-19.md`                             |

## Risks

1. **Deploy order (review HIGH-1):** functions `matching-evaluate`, `capacity-evaluate`,
   `work-requirements` BEFORE `db push`; `professional-availability` after; frontend last.
2. **Never run `functions deploy` without names** (it would deploy `qualification-reviews`).
3. `db push` must run from a checkout of `65df3b9` for wave 1 (otherwise the wallet migrations go too).
4. Wallet before remote: file cleanup on account deletion (M-3). `STORAGE_PUBLIC_URL` is local only.
5. `pnpm db:types` targets production — use `pnpm db:types:local`.

## Blocked on the owner

- Approve wave 1 (each remote step separately) and the production E2E (runbook).
- D-06 contract questions (R-08 re-proposal, Q2–Q6); D-07 P1–P3; M-3 design for the wallet.
- OD-3 stays closed in production (owner, 2026-10-19).

## Next step (one)

Owner review of `docs/qa/ROLLOUT_PLAN_2026-10-19.md` and of the D-06 contract; meanwhile local work
that needs no decision.
