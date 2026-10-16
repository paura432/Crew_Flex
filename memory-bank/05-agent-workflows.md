# 05 · Agent workflows

Canonical: `AGENTS.md` (roles and rules). Project subagents live in `.claude/agents/*.md` (Claude Code
loads them by name; other tools can read them as plain role briefs). This file defines **how work moves
between roles** and when to stop.

## Roles → subagent files

| Role                         | File                                           | Owns                                                                 | Never does                                           |
| ---------------------------- | ---------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------- |
| Product guardian             | `.claude/agents/product-guardian.md`           | Scope (V0/V1/V1.3), decision status, docs truthfulness               | Writes code; takes a product decision                |
| Frontend architect           | `.claude/agents/frontend-architect.md`         | `src/app`, `src/features/*/components`, `src/components`, i18n, a11y | Puts rules in JSX; adds client data fetching         |
| Backend / Supabase architect | `.claude/agents/backend-supabase-architect.md` | `supabase/migrations`, `supabase/functions`, RPCs, contracts         | Edits applied migrations; runs remote commands       |
| Security reviewer            | `.claude/agents/security-reviewer.md`          | RLS, grants, DEFINER, privacy, secrets — **review only**             | Authors the change it reviews                        |
| Domain / matching engineer   | `.claude/agents/domain-matching-engineer.md`   | `src/domain`, BR-1…BR-11, SQL ↔ TS parity                            | Adds a second engine; uses an LLM for eligibility    |
| QA / release engineer        | `.claude/agents/qa-release-engineer.md`        | Gates, E2E, evidence, rollout/rollback plans                         | Marks SKIPPED as PASS; deploys without authorization |

The **coordinator** (the main session) splits the task, assigns one owner per file set, merges results,
and checks the agents' outputs against each other (e.g. a backend change and the domain docs it implies).

## Mandatory reading per task

| Always                                                                               |
| ------------------------------------------------------------------------------------ |
| `AGENTS.md` → `memory-bank/01-current-state.md` → `memory-bank/06-active-context.md` |

| Task type         | Plus                                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| Database / RLS    | `04-security-invariants.md`, `AUTHORIZATION.md`, `DATA_MODEL.md`, the latest migrations, `tests/db/rls.test.ts` |
| Edge Function     | `EDGE_FUNCTIONS.md`, `_shared/*`, the function's `index_test.ts`, `src/types/api.ts`                            |
| Matching/capacity | `03-domain-map.md`, `BUSINESS_RULES.md`, `src/domain/*.test.ts`, rls section M                                  |
| Frontend          | `DESIGN_SYSTEM.md`, `I18N_STRATEGY.md`, `node_modules/next/dist/docs/` for the installed Next 16                |
| Deploy / remote   | `ENVIRONMENTS.md`, `DEPLOYMENT_PLAN.md`, `08-validation-gates.md` — and an explicit owner authorization         |
| Scope question    | `V1_SCOPE.md`, `07-decisions-index.md`                                                                          |

## Handoffs

```
Product guardian ──(scope OK + decision ids)──▶ Domain engineer ──(rule + pure tests)──▶ Backend architect
     ▲                                                                                  │ (migration + RLS + function + tests)
     │                                                                                  ▼
     └──(docs/status updated)◀── QA/release ◀──(UI + i18n + a11y)── Frontend architect ◀┘
                                     │
                         Security reviewer reviews every DB/auth/privacy diff before QA signs off
```

A handoff note states: what changed (files), which invariant/BR it touches, which tests prove it, what
is **not** done, and the next owner. Put it in `06-active-context.md` if the session ends.

## Scope of a change

- One concern per change; no drive-by refactors; no unrelated formatting.
- New dependency only with a written reason (security, size, maintenance) in the PR/commit.
- File ownership is exclusive while a task runs: two agents never edit the same file concurrently.
- A migration, its RLS/grants and its tests travel together; docs and code in the same commit.

## Independent review

Required (author ≠ reviewer) for: new/changed RLS policy, grant, DEFINER function, auth flow, anything
touching sensitive data (04), and any change to BR-2/3/4/6 or the SQL prefilter. The reviewer gets the
diff and the invariants, not the author's reasoning.

## STOP conditions — halt and ask the owner

1. The task needs a remote write: push to `main`, `db push`, `functions deploy`, `secrets set`, Auth or
   Vercel settings, remote E2E writes.
2. The task needs a product decision listed as open in `07-decisions-index.md`, or invents one.
3. A test fails and the only "fix" is weakening it, skipping it or widening a grant.
4. The working tree contains changes you did not make and the task would overwrite them.
5. A target (URL, DB, project ref) cannot be proven local.
6. A secret or real personal data would end up in the repo, a log or memory.
7. The change contradicts `BUSINESS_RULES.md` or an accepted ADR.

## Evidence required to call a task done

- Commands actually run, with results: `pnpm check`, `pnpm build`, `git diff --check`; plus local E2E /
  race / smoke when the change touches those paths (`08-validation-gates.md`).
- For a bug: a regression test that fails without the fix.
- Status words from the vocabulary (`README.md`); local vs production stated explicitly.
- Memory bank updated per the table in `README.md`.
