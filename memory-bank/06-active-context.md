# 06 · Active context

_Last updated 2026-10-15, branch `fix/remediation-2026-10-15` @ `a7fd5a7` + uncommitted. Keep under ~60 lines;
replace, don't append history (history lives in Git and `docs/audit/`)._

## Current task

Architecture & memory-bank foundation: diff GitHub ↔ local, completeness audit (V0/V1/V1.3), ADR-002,
memory bank, project subagents, stale-doc corrections. **Done locally; nothing committed, pushed or deployed.**

## State

| Item               | State                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------- |
| Code               | Unchanged by this task (docs, `.claude/agents/`, `tests/docs/memory-bank.test.ts` only) |
| Gates (2026-10-15) | `pnpm check`, `pnpm build`, `git diff --check` PASS; local E2E 25/25; races 4/4         |
| Local stack        | Running (Docker); functions server stopped; DB back to seed (4 requirements)            |
| Production         | Unchanged since 2026-10-09/10 (`memory-bank/01-current-state.md`)                       |

## Relevant files

`docs/audit/CREWFLEX_DIFF_CURRENT.md` · `docs/audit/CREWFLEX_COMPLETENESS_AUDIT.md` ·
`docs/architecture/ADR-002-modular-domain-architecture.md` · `docs/audit/CREWFLEX_REMEDIATION_2026_10_15.md`

## Risks

1. **Rollout ordering:** `professional-qualifications` needs `20261015130400` objects (`reviewed_at`,
   `own_qualification_reviews`). The older plan "hold 130400 until OD-3" would break the qualifications page.
2. Pushing `main` with this tree before the migrations + functions breaks production pages.
3. ~240 uncommitted files across five change sets; nothing is protected by a commit yet.
4. `src/types/database.generated.ts` lags the local migrations; `pnpm db:types` targets production.

## Blocked on the owner

- Authorization to commit (in the change sets of `CREWFLEX_DIFF_CURRENT.md` §2) and to roll out.
- Choice for `130400` at rollout: (a) apply schema with the review flag off (recommended) or (b) patch the function.
- OD-3 / D-01 / R-D1 (who verifies in production), then D-06, D-07, D-10 for the engagement loop.
- Accept or amend ADR-002.
- Supabase management API returns 403 for the CLI account — re-grant if remote listing is needed.

## Next step (one)

Owner-authorized **production rollout** of the locally verified work, exactly as listed in
`docs/audit/CREWFLEX_DIFF_CURRENT.md` §5 (pre-flight queries → migrations incl. `130400` with the flag off →
seven functions → push `main` → probes + guarded authenticated E2E). Not combined with any new feature.
