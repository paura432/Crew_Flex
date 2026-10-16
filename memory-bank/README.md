# Memory Bank — Crew Flex

A thin, dated **operational context layer** for agents and engineers. It tells you where things
are, what is true _now_, what is risky and what is waiting on a human. It does **not** restate
specifications: every fact links to its canonical source, and when the two disagree **the canonical
source (or the code) wins** and the memory-bank file is the one to fix.

## Read order

1. `AGENTS.md` (contract, rules, roles)
2. [`01-current-state.md`](01-current-state.md) — what exists, where, verified when (SHA + date)
3. [`06-active-context.md`](06-active-context.md) — what is in flight, next step, human blockers
4. The file for your task:

| Task touches…                            | Read                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| Any code                                 | [`02-architecture-map.md`](02-architecture-map.md)                        |
| Rules, matching, capacity, data model    | [`03-domain-map.md`](03-domain-map.md) → `docs/product/BUSINESS_RULES.md` |
| Migrations, RLS, functions, auth, data   | [`04-security-invariants.md`](04-security-invariants.md)                  |
| Planning, handoffs, reviews, subagents   | [`05-agent-workflows.md`](05-agent-workflows.md)                          |
| "Is this decided?"                       | [`07-decisions-index.md`](07-decisions-index.md)                          |
| Tests, PASS/SKIPPED, deploy, prod safety | [`08-validation-gates.md`](08-validation-gates.md)                        |
| Why the product exists / what it is not  | [`00-project-context.md`](00-project-context.md)                          |

Then the real code and its tests. Documentation never replaces reading the code you change.

## Canonical sources (one owner per fact)

| Fact                                       | Canonical source                                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Scope and per-item status (NOW/NEXT/LATER) | `docs/product/V1_SCOPE.md`                                                                |
| Business rules (BR-x.y)                    | `docs/product/BUSINESS_RULES.md` + `src/domain/**` (code wins)                            |
| Schema, RLS, grants, RPCs                  | `supabase/migrations/*.sql` (docs: `DATA_MODEL.md`, `AUTHORIZATION.md`)                   |
| Edge Function contracts                    | `supabase/functions/<name>/index.ts` + `src/types/api.ts` (docs: `EDGE_FUNCTIONS.md`)     |
| Open / resolved decisions                  | `docs/product/OPEN_DECISIONS.md`, `docs/integration/crewflex-v13/08-product-decisions.md` |
| Architecture decisions                     | `docs/architecture/ADR-*.md`                                                              |
| Environments, what production is           | `docs/architecture/ENVIRONMENTS.md`, `docs/audit/DEPLOYMENT_PLAN.md` (execution log)      |
| Local stack                                | `docs/qa/LOCAL_ENVIRONMENT.md`                                                            |
| Gates and test inventory                   | `docs/qa/QUALITY_GATES.md`                                                                |
| Completeness by module                     | `docs/audit/CREWFLEX_COMPLETENESS_AUDIT.md` (dated snapshot)                              |
| Diff GitHub ↔ local                        | `docs/audit/CREWFLEX_DIFF_CURRENT.md` (dated snapshot)                                    |

Audit reports under `docs/audit/` are **dated snapshots**. Never promote a sentence from an old report
to "current state" without re-checking it.

## When to update

| Event                                                        | Update                                                                 |
| ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Session ends with a meaningful change, block or handoff      | `06-active-context.md` (keep it under ~60 lines)                       |
| Commit / push / deploy / migration applied anywhere          | `01-current-state.md` (date + SHA + where verified)                    |
| A layer, boundary or directory convention changes            | `02-architecture-map.md` and the ADR that justifies it                 |
| A new entity, state, invariant or engine                     | `03-domain-map.md` (link the BR id; rule text stays in BUSINESS_RULES) |
| New policy, grant, definer function, secret, sensitive field | `04-security-invariants.md`                                            |
| A decision is opened, taken or superseded                    | the canonical decision doc first, then `07-decisions-index.md`         |
| A gate, suite or environment changes                         | `QUALITY_GATES.md` first, then `08-validation-gates.md`                |

Trivial changes (copy, styling, a test added to an existing suite) need **no** memory-bank update.

## Rules

- Every state claim carries a **date and a SHA** (or "uncommitted on `<branch>`") and says **where** it
  was verified: `PGlite`, `local Docker`, `production (read-only probe)`, `production (authorized write)`.
- Local ≠ production. "Implemented" never means "deployed".
- No secrets, keys, tokens, real e-mails or real professional data — ever. Seed accounts are synthetic.
- No invented decisions: if it is not in a decision doc, it is open.
- `pnpm check` runs `tests/docs/memory-bank.test.ts`: links resolve, required files exist, statuses use
  the vocabulary below, referenced decision ids exist, no secret-looking strings.

Status vocabulary (completeness audit and current state): `VERIFIED_PRODUCTION`, `VERIFIED_LOCAL`,
`IMPLEMENTED_UNVERIFIED`, `PARTIAL`, `PLANNED`, `BLOCKED`, `OUT_OF_SCOPE`, `NEEDS_DECISION`.
