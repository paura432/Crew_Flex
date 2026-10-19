# 06 · Active context

_Last updated 2026-10-19 (evening) CEST. Keep under ~60 lines; replace, don't append history._

## Current task

**Release 1 (`65df3b9`) is in production since 2026-10-19 18:57 CEST** — steps 1–5 of
`docs/qa/ROLLOUT_PLAN_2026-10-19.md` executed with owner authorization, every check PASS. Stopped: step 6
(production E2E with writes) not authorized.

## State

| Item         | State                                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| Production   | `origin/main` `65df3b9`, Vercel `7179643776` success; 15 migrations; 8 functions (matching/capacity/availability v3) |
| Data         | unchanged: 3 users, 0 organizations, 0 windows, 0 `aog_only`; no flags, 0 buckets, no wallet object                  |
| Local `main` | ahead of `65df3b9`, not pushed: wallet (release 2, not approved), designs, rollout docs                              |
| Worktrees    | `../cf-r1` (`65df3b9`), `../cf-r1a` (`2216d38`) — can be removed when the owner wants                                |

## Risks

1. Enum has `aog_only` (Q12 true): never reinstall `ddf5c4b` matching/capacity/availability; forward fix only; never convert `aog_only` rows.
2. Never `git push origin main` while local `main` carries the wallet; publish only reviewed commits explicitly.
3. Authenticated flows never verified in production (no session, 0 organizations).
4. `pnpm db:types` targets production — use `pnpm db:types:local`.

## Blocked on the owner

- Step 6: production E2E (3 approvals: seed synthetic users, run, cleanup).
- D-06 Q2–Q6 and D-07 P1–P4: owner **proposals** recorded 2026-10-19 in the contracts; ratification
  needed before any sensitive implementation (§4.1 of each doc). P3 period needs legal criterion.
- Wallet release 2: retention periods, legal-hold procedure, maintenance mechanism (not approved).

## Next step (one)

Owner approval of step 6a (seed synthetic users, `docs/qa/PRODUCTION_E2E_RUNBOOK.md`) to verify authenticated flows.
