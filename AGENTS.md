# AGENTS.md — Crew Flex

Authoritative rules for any agent or engineer working in this repo. Short on purpose.

## Read first

1. `docs/product/PRODUCT.md`
2. `docs/product/V1_SCOPE.md`
3. `docs/product/BUSINESS_RULES.md`
4. `docs/architecture/ARCHITECTURE.md`
5. `docs/product/SECURITY_PRIVACY.md`
6. The domain doc for your task: `DATA_MODEL.md`, `AUTHORIZATION.md`, `EDGE_FUNCTIONS.md`,
   `DESIGN_SYSTEM.md`, `docs/qa/QUALITY_GATES.md`, `OPEN_DECISIONS.md`.

## Roles

| Role                            | Owns                                                     | Must check                                                                                            |
| ------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Product guardian**            | Scope, docs truthfulness                                 | Change is in `V1_SCOPE.md` NOW; statuses (IMPLEMENTED/PARTIAL/PLANNED/OPEN DECISION) are true         |
| **Frontend engineer**           | `src/app`, `src/features/*/components`, `src/components` | Server Components by default; no business logic in JSX; loading/empty/error/success; a11y; responsive |
| **Backend / Supabase engineer** | `supabase/migrations`, `supabase/functions`              | Versioned, non-destructive migrations; RLS in the same migration; user-context client                 |
| **Security engineer**           | Auth, RLS, secrets, privacy                              | Threat model in `SECURITY_PRIVACY.md` still holds; tests for every new policy                         |
| **Matching engineer**           | `src/domain`                                             | Deterministic, pure, tested; `BUSINESS_RULES.md` updated in the same change                           |
| **QA engineer**                 | Tests, gates                                             | `pnpm check` + `pnpm build` + `git diff --check` actually run and pass                                |
| **Reviewer**                    | Every change                                             | All of the above; small commits; no unrelated changes                                                 |

## Rules

- **No scope creep.** Build what `V1_SCOPE.md` says is NOW. Stop before unrequested expansion.
- **No secrets** in repo, docs, migrations, seed, fixtures, logs or `NEXT_PUBLIC_*`. Backend secrets
  only via `supabase secrets set`. `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` must never exist.
- **No RLS bypass.** Edge Functions act with the caller's JWT. **No service role** without a written
  justification in `EDGE_FUNCTIONS.md`, an explicit authorization check and an audit event.
- **Identity from the JWT only.** Never trust `userId`, `role`, `organizationRole` from a request.
- **No business logic in JSX.** Rules live in `src/domain` (pure) and are shared with Edge Functions.
- **LLM ≠ eligibility engine.** No AI in hard eligibility. Ever.
- **No silent duplication** of algorithms, schemas or types. One implementation, imported.
- **No manual remote schema changes.** Migrations → local verification → review → remote apply.
  Never `DROP`, `TRUNCATE`, reset or delete remote data.
- **No PASS without running it.** Never delete or skip a failing test. A reasonable bug gets a
  regression test.
- **Docs and code stay in sync** in the same commit.
- Commits: small, conventional (`feat:`, `fix:`, `docs:`, `chore:`, `test:`). **Main-only (temporary,
  OD-9, since 2026-10-10):** `main` is the single permanent branch and deploys straight to Vercel
  Production and the single Supabase project; work on `main` (or a short-lived local branch merged
  fast-forward), run the full quality gate before every push, never force-push or rewrite history.
  Remote test writes need the two-condition guard in `docs/architecture/ENVIRONMENTS.md` §3.

## Commands

```bash
pnpm dev          # Next.js
pnpm check        # lint, typecheck, unit + RLS tests, format, deno lint/check/test
pnpm build
bash scripts/local/sb-local.sh db reset   # LOCAL Docker database only (docs/qa/LOCAL_ENVIRONMENT.md)
```

Local database work never uses bare `supabase db …` while the repo is linked to production: go through
`scripts/local/sb-local.sh`, which refuses `--linked`, `--project-ref` and remote `--db-url`.

Skills: none vendored in this repo. The global `ponytail` (YAGNI) principle guides scope; it is
not copied here.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
