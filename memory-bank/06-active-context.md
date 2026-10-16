# 06 · Active context

_Last updated 2026-10-16, branch `fix/remediation-2026-10-15` (tip = commit carrying this file). Keep under
~60 lines; replace, don't append history (history lives in Git and `docs/audit/`)._

## Current task

Production rollout of the locally verified work (main-only demo environment, OD-9; no staging exists).
Stages A (migrations) and B (functions) **done**; stage C (fast-forward `main` + push = Vercel deploy)
**waiting for owner approval**.

## State

| Item      | State                                                                                                    |
| --------- | -------------------------------------------------------------------------------------------------------- |
| Database  | 10/10 migrations remote; OD-3 flag row absent                                                            |
| Functions | 8 deployed; `qualification-reviews` deleted after an accidental deploy (bare `functions deploy`)         |
| Frontend  | Vercel still on `4f98e67`; new UI not published                                                          |
| Code fix  | OD-3 server flag: nav entry hidden, `/app/admin/verifications` 404, action refused while disabled        |
| Gates     | `pnpm check`, `pnpm build`, `git diff --check` re-run 2026-10-16 on the branch tip before the checkpoint |

## Commits that stage C would publish (`origin/main..branch`)

`72fbb64` chore(local) · `a7fd5a7` feat(professional) phase 1 · `2f68190` feat(db) · `076ef15` feat(app) ·
`738aac6` chore(scripts) · `92c6fde` docs · OD-3 flag fix · this memory-bank update.

## Risks

1. Old UI on new backend until the push: server validation messages arrive as i18n keys (`v.*`) — cosmetic.
2. **Never run `functions deploy` without names**: it deploys `qualification-reviews` too.
3. `src/types/database.generated.ts` lags the migrations; `pnpm db:types` targets production (now in sync to regenerate).
4. No authenticated flow verified in production yet.

## Blocked on the owner

- Approval of stage C (fast-forward + `git push origin main`), then Vercel deploy confirmation.
- Guarded remote E2E (`E2E_WRITE_CONFIRM` typed by the owner).
- OD-3 / D-01 / R-D1, then D-06, D-07, D-10. Accept or amend ADR-002.

## Next step (one)

On approval: `git checkout main && git merge --ff-only fix/remediation-2026-10-15 && git push origin main`,
wait for Vercel, probe `/login` 200 and `/app` → `/login`, then mark the frontend published in `01-current-state.md`.
