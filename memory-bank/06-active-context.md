# 06 · Active context

_Last updated 2026-10-19 (evening) CEST. Keep under ~60 lines; replace, don't append history._

## Current task

Close production release 1 = commit **`65df3b9`** (availability cycle generator, «AOG only», tools).
Plan for owner approval, step by step: `docs/qa/ROLLOUT_PLAN_2026-10-19.md`. Nothing remote done.

## State

| Item          | State                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release 1     | `65df3b9`: 5 migrations (`20261019120000`…`150100`), functions matching-evaluate + capacity-evaluate (step 1), professional-availability (step 3) |
| Compatibility | `scripts/local/release-compat/run.sh ddf5c4b 65df3b9 20261015130400` → 67/67; old FE vs new backend 5/5; release FE prod-like 9/9                 |
| Local `main`  | ahead to `4170122`+docs: wallet (Supabase flag `document_wallet`, M-3 cleanup) — release 2, NOT in release 1                                      |
| Gates (local) | `pnpm check` (Vitest 359, Deno 74), build, E2E 29/29, race 6/6                                                                                    |

## Risks

1. Order: matching/capacity deploy → `db push` from a `65df3b9` checkout → professional-availability
   deploy → `git push origin 65df3b9:main` (NOT `git push origin main`).
2. Never roll matching/capacity back while `aog_only` rows exist (old parser → 500).
3. Window W (steps 2→3): old availability GET 500 only for users with `aog_only` rows (no UI path).
4. `/app/admin/verifications` with the flag unset renders Not found with HTTP 200 (streaming), same in prod.
5. `pnpm db:types` targets production — use `pnpm db:types:local`.

## Blocked on the owner

- Each release-1 step (§12 of the plan) and production E2E (3 approvals).
- D-06 Q2–Q6 (R-08 decided: new version + explicit acceptance, nothing retroactive); D-07 P1–P4.
- Wallet release 2: retention proposal (30 d / 24 h), legal-hold procedure, maintenance execution model.

## Next step (one)

Owner approval of step 0/1 of the plan; meanwhile local parity audits that need no decision.
