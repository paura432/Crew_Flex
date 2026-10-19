# 06 · Active context

_Last updated 2026-10-19 CEST. Keep under ~60 lines; replace, don't append history (history lives in
Git and `docs/audit/`)._

## Current task

Parity migration from the prototypes (owner brief of 2026-10-19: V1.3 + V1.8 → Next.js), batch by
batch, local only. Batch 1 = availability **work/rest cycle generator** (V1.8 `planning.js`).

## State

| Item               | State                                                                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1.8 audit         | Done: `docs/integration/crewflex-v13/09-v18-delta.md` (46 rows, cycle table, tools formulas, tokens, 11 "do not copy")                                          |
| Cycle generator    | Implemented + verified LOCAL: `rotation.ts`, `CyclePlanner.tsx`, migration `20261019120000` (RPC `replace_availability_days`), `PUT /professional-availability` |
| Gates (2026-10-19) | `pnpm check` PASS · local E2E 26/26 (functions served) · browser check 17/17 at 1440/1024/768/390/360                                                           |
| Production E2E     | NOT RUN (unchanged; `docs/qa/PRODUCTION_E2E_RUNBOOK.md`)                                                                                                        |
| Local commits      | Earlier E2E-preparation commits + this batch: **not pushed**                                                                                                    |

## Risks

1. **Never run `functions deploy` without names**: it deploys `qualification-reviews` too.
2. **Deploy order for batch 1**: migration `20261019120000` → `functions deploy professional-availability`
   (shared `_shared/http.ts` gained `PUT`) → only then push `main`. Frontend first = the generator's
   save and day edits on longer windows fail (405).
3. BR-4.6 changed: editing a day inside a longer window now cuts that day out (was: refused). Owner review.
4. `src/types/database.generated.ts` lags the migrations; regenerate with `pnpm db:types`.

## Blocked on the owner

- Approvals: seed synthetic users → `pnpm e2e:production` → cleanup; push of local commits; apply
  `20261019120000` + deploy `professional-availability`.
- OD-3 / D-01 / R-D1, then D-06, D-07, D-10, D-11 (tools scope), D-12 (recruiter), C-8 (`aog_only`).

## Next step (one)

Batch 2 candidate: tools hub units/torque/durations (D-11 recommended default, pure client, V1.8
tools-engine formulas in `docs/integration/crewflex-v13/09-v18-delta.md` §3) — needs the owner to confirm D-11 first.
