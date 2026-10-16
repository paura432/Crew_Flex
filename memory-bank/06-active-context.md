# 06 · Active context

_Last updated 2026-10-16 ~21:30 CEST. Keep under ~60 lines; replace, don't append history (history lives in
Git and `docs/audit/`)._

## Current task

Production E2E **preparation** (not execution). Rollout itself is done: 10 migrations, 8 functions,
frontend published (`ddf5c4b`, code `f158308`).

## State

| Item            | State                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local E2E       | 25/25 passed, 0 skipped, after starting `functions serve` (the earlier 24 × 503 was local, not prod)                                                          |
| Production E2E  | NOT RUN. `.env.e2e.production` prepared (git-ignored, 600, 3 synthetic identities, generated passwords)                                                       |
| Synthetic users | Not created in production                                                                                                                                     |
| Guards          | Refuse a stored confirmation in any `.env.e2e*`; seed rejects weak/JSON-breaking passwords; secret key via fd, not argv; cleanup compares e-mails lower-cased |
| Local commits   | Vercel-flag confirmation + E2E preparation: **not pushed**                                                                                                    |

## Risks

1. **Never run `functions deploy` without names**: it deploys `qualification-reviews` too.
2. Production check 14 passes without asserting while OD-3 is open (no verified FTS possible).
3. `src/types/database.generated.ts` lags the migrations; regenerate with `pnpm db:types`.

## Blocked on the owner

- Three separate approvals: seed synthetic users → `pnpm e2e:production` → cleanup
  (`docs/qa/PRODUCTION_E2E_RUNBOOK.md`).
- Push of the local commits (production deploy, docs/tests/scripts only).
- OD-3 / D-01 / R-D1, then D-06, D-07, D-10. Accept or amend ADR-002.

## Next step (one)

On approval 1: preflight dry-run (expect all 0), then `scripts/e2e/seed-users.sh` with the secret key read
via `read -rs` (runbook step 1).
