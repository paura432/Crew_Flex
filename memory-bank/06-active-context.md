# 06 · Active context

_Last updated 2026-10-16 after publishing `f158308` to production. Keep under
~60 lines; replace, don't append history (history lives in Git and `docs/audit/`)._

## Current task

Production rollout **done** on 2026-10-16: 10 migrations, 8 functions, frontend `f158308` published
(Vercel deployment `7126243506`, success). Anonymous smoke passed. Post-publish memory-bank commit is local only.

## Commits published (`4f98e67..f158308`)

`72fbb64` · `a7fd5a7` · `2f68190` · `076ef15` · `738aac6` · `92c6fde` · `76c004c` · `f158308`.

## Risks

1. **Never run `functions deploy` without names**: it deploys `qualification-reviews` too.
2. `src/types/database.generated.ts` lags the migrations; `pnpm db:types` targets production (now in sync to regenerate).
3. No authenticated flow verified in production yet.

## Blocked on the owner

- Approval of stage C (fast-forward + `git push origin main`), then Vercel deploy confirmation.
- Guarded remote E2E (`E2E_WRITE_CONFIRM` typed by the owner).
- OD-3 / D-01 / R-D1, then D-06, D-07, D-10. Accept or amend ADR-002.

## Next step (one)

Owner: run the guarded authenticated E2E (Vercel flag absence confirmed 2026-10-16)
against production. Rollback target if needed: Vercel deployment `6993757331` (`4f98e67`), DB stays (compatible).
