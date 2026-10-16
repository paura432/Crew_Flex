# Crew Flex — current diff: GitHub `main` ↔ local working tree

> Snapshot **2026-10-15**. Compares `origin/main` = `4f98e67158cb9ea0558401dbdec95aceb83b5902` (what Vercel
> Production builds) with the local working tree on branch `fix/remediation-2026-10-15` at `a7fd5a7` plus
> uncommitted changes. Regenerate with the commands in §7 — this file is dated evidence, not live state.

## 1. Summary

| Measure                                      | Value                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------ |
| Commits on local `main`/branch not on GitHub | 2 (`72fbb64`, `a7fd5a7`) — **not pushed**                                            |
| Files changed by those commits               | 53 (25 added, 28 modified), +2 599 / −220                                            |
| Uncommitted tracked modifications            | 117 files, +4 187 / −1 419 (vs `HEAD`)                                               |
| Untracked (not ignored) files                | 120 (before this memory-bank task)                                                   |
| **Files vs `origin/main`**                   | **145 added** (25 committed + 120 untracked) · **101 modified** · **0 deleted**      |
| Identical tracked files                      | the rest of the tree (the external comparison counted 135 identical in its snapshot) |

The figures match the external report `CrewFlex_DIFF_AUDITORIA_MEMORYBANK_2026-10-15.md` (145 / 101 / 0); that
report is **not** in the repository, so this file is the in-repo record. The snapshot zip
`tmp/exports/crewflex-20261015-a7fd5a7-dirty.zip` (git-ignored, `scripts/export-zip.sh`) contains exactly this
working tree (381 files, no `.env*` other than examples).

This memory-bank task adds (uncommitted): `memory-bank/` (10 files), `.claude/agents/` (6),
`docs/architecture/ADR-002-modular-domain-architecture.md`, this file, `docs/audit/CREWFLEX_COMPLETENESS_AUDIT.md`,
`tests/docs/memory-bank.test.ts`, and documentation corrections (§6 of the completeness audit).

## 2. Change sets (chronological)

| #   | Change set                                                                                                                                                                       | Where            | Status                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------- |
| 1   | Local tooling: test-row cleanup, `.env.remote.backup` hygiene test, app icon                                                                                                     | commit `72fbb64` | committed, not pushed                               |
| 2   | **Phase 1** — editable passport + real qualifications via `professional-profile` / `professional-qualifications`, BR-11 completeness                                             | commit `a7fd5a7` | committed, not pushed; functions **never deployed** |
| 3   | **Phase 1.5** — bilingual ES/EN (`next-intl`), `/app/settings`, `user-preferences` function, migration `20261011120000_preferred_locale`                                         | uncommitted      | local only                                          |
| 4   | **Phase 0.8** — V1.3 integration audit (`docs/integration/crewflex-v13/`), DB backstops `20261015120000`, pool selection order `20261015120100`, workforce member-role crash fix | uncommitted      | local only                                          |
| 5   | **Remediation 2026-10-15** — E-3, I-1, I-3, E-4, candidate pool exhaustiveness, platform-admin review, UX/i18n fixes (`docs/audit/CREWFLEX_REMEDIATION_2026_10_15.md`)           | uncommitted      | local only; review gated by OD-3                    |
| 6   | `scripts/export-zip.sh`                                                                                                                                                          | uncommitted      | local tool                                          |
| 7   | Architecture & memory bank (this task)                                                                                                                                           | uncommitted      | docs + 1 test                                       |

## 3. Diff by area (vs `origin/main`; C = committed, W = uncommitted tracked, U = untracked)

| Area                                             | C add | C mod | W mod | U add | Highlights                                                                                                                                                                                                                                            |
| ------------------------------------------------ | ----: | ----: | ----: | ----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations`                            |     0 |     0 |     0 |     8 | `20261011120000`, `20261015120000`, `120100`, `130000`–`130400`                                                                                                                                                                                       |
| `supabase/functions`                             |     4 |     0 |    13 |     5 | new `professional-profile`, `professional-qualifications` (C); `user-preferences`, `qualification-reviews` (U); changes to `_shared/{cors,errors,requirements,validation}`, `matching-evaluate`, `professional-availability`, `work-requirements` (W) |
| `src/domain`                                     |     2 |     0 |     2 |     0 | `professional.ts` (BR-11); `capacity.ts` `assertEvaluableRequirement`                                                                                                                                                                                 |
| `src/lib`, `src/server`, `src/types`, `src/i18n` |     2 |     3 |    13 |    15 | i18n runtime, `idempotency.ts`, `candidate-pool.ts`, `validation/{review,preferences,idempotency}.ts`, `api.ts` contracts, `database.generated.ts`                                                                                                    |
| `src/features`                                   |     5 |     4 |    26 |    11 | `reviews/`, `preferences/`, `matching/pool.ts` + `PoolCoverageNote`, `workforce/map.ts`                                                                                                                                                               |
| `src/app`                                        |     1 |     3 |    18 |     2 | `/app/settings`, `/app/admin/verifications`; all pages translated                                                                                                                                                                                     |
| `src/components`                                 |     1 |     0 |     6 |     0 | `Notice`, nav wrapping, metric cards                                                                                                                                                                                                                  |
| `messages/`                                      |     0 |     0 |     0 |     2 | `en.json`, `es.json`                                                                                                                                                                                                                                  |
| `tests`                                          |     0 |     3 |     3 |     2 | rls sections J–N, `e2e/local-remediation`, `i18n/messages`                                                                                                                                                                                            |
| `scripts`                                        |     1 |     1 |     2 |     2 | `db-race-check.sh`, `export-zip.sh`, smoke sections 0/6/7                                                                                                                                                                                             |
| `docs` (text)                                    |     1 |     9 |    12 |    13 | V1.3 integration set, remediation report, i18n strategy, glossary                                                                                                                                                                                     |
| evidence images                                  |     8 |     4 |    16 |    60 | `docs/audit/evidence/**`                                                                                                                                                                                                                              |
| config/other                                     |     0 |     1 |     6 |     0 | `package.json` (+`next-intl` 4.14.9), `next.config.ts`, `.gitignore`, `supabase/config.toml`, lockfile                                                                                                                                                |

Dependencies: one runtime dependency added (`next-intl` 4.14.9). No dependency removed.

## 4. Classification of the significant changes

| Change                                                                         | Problem solved / feature                                              | Contract changed                                                     | Data / permissions                                         | Tests                            | Risk                                                                                                    | Deployed?        | Docs consistent? | Depends on decision              |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------- | ---------------- | -------------------------------- |
| Passport edit (`professional-profile` + RPC `update_professional_profile`)     | Edit passport; I-3 atomic save, optimistic lock                       | `PATCH /professional-profile` with `expectedUpdatedAt`; 409 on stale | `profiles`, `technician_profiles`; INVOKER RPC             | rls K, EF tests, E2E             | Needs `20261015130100` remotely before deploy                                                           | **No**           | Yes              | R-D5 (label only)                |
| Qualifications CRUD (`professional-qualifications`, `declare_qualification`)   | Declare/edit/withdraw/remove; idempotent declare                      | `POST` accepts `Idempotency-Key`; 200 on replay                      | insert forces `pending`; no grant on review columns        | rls F/L, EF tests, E2E           | Needs `20261015120000`, `130200` **and `130400`** (`reviewed_at`, `own_qualification_reviews`) — see §5 | **No**           | Yes              | OD-3 for verification activation |
| i18n + `user-preferences` + `preferred_locale`                                 | ES/EN UI, persisted language                                          | new function                                                         | column grant on `profiles.preferred_locale`                | i18n tests, EF tests, E2E, smoke | Low                                                                                                     | **No**           | Yes              | OD-6 (countries only)            |
| DB backstops `20261015120000`                                                  | Rules enforced only in functions were bypassable via PostgREST (T-05) | none                                                                 | triggers: expiry, type immutability, window ≤ 366 d, audit | rls (phase 0.8)                  | Pre-flight queries needed on remote data                                                                | **No**           | Yes              | —                                |
| E-3 `20261015130000`                                                           | Requirement could lose its last hard qualification                    | errors at commit → 400                                               | deferred constraint trigger                                | rls J, E2E, race                 | Legacy rows: pre-flight query                                                                           | **No**           | Yes              | R-D4 (drafts)                    |
| I-1 `20261015130200`                                                           | Duplicate creates on retry                                            | `Idempotency-Key` header; `CF409` → 409                              | `app_private.idempotency_keys`                             | rls L, E2E, race                 | `app_private` must not be exposed                                                                       | **No**           | Yes              | R-D2 (retention)                 |
| Pool `20261015120100` + `130300`                                               | Eligible candidates cut by the 100 cap                                | `MatchingResponse.summary.pool` (new field the UI **requires**)      | DEFINER pool function re-created, summary RPC              | rls M (parity), pool tests, E2E  | **Deploy order**: UI from this tree crashes against the old `matching-evaluate`                         | **No**           | Yes              | R-D3                             |
| Review `20261015130400` + `qualification-reviews` + `/app/admin/verifications` | No path could verify a qualification                                  | new function, review RPC                                             | column-level SELECT; flag table; DEFINER                   | rls N, EF tests, E2E, race       | Must stay off until OD-3                                                                                | **No** (blocked) | Yes              | **OD-3 / R-D1**                  |
| E-4 `src/server/edge-functions.ts`                                             | Unreachable/timeout functions crashed pages                           | `NETWORK_ERROR` code                                                 | —                                                          | `edge-functions.test.ts`         | Low                                                                                                     | n/a (Next)       | Yes              | —                                |
| UX fixes (nav, metric cards, completeness label, next steps)                   | Mobile clipping, misleading 100 %                                     | —                                                                    | —                                                          | smoke 78/78                      | Low                                                                                                     | No               | Yes              | R-D5                             |

## 5. Deployment dependency (why the local tree cannot be pushed as-is)

Pushing `main` with this tree deploys the Next app immediately (Vercel). The app then calls functions and
RPCs that production does not have. The **complete** ordered set, if the owner authorizes it:

1. Migrations: `20261011120000` → `20261015120000` → `20261015120100` → `20261015130000` → `20261015130100`
   → `20261015130200` → `20261015130300` (pre-flight queries first; check `app_private` is not exposed).
2. Functions (every bundle that changed, directly or through `_shared`/`src`): `work-requirements`,
   `capacity-evaluate`, `matching-evaluate`, `professional-availability` (redeploy) and `professional-profile`,
   `professional-qualifications`, `user-preferences` (first deploy); `health` optionally (CORS header list only).
3. Push `main` (Vercel).
4. **Finding (2026-10-15, verified in code): `20261015130400` cannot simply be held back.**
   `professional-qualifications` selects `reviewed_at` (`index.ts:36`) and calls `own_qualification_reviews()`
   (`index.ts:123`), both created by `130400`. Without it, every qualifications GET fails (the page breaks).
   The remediation report's "130400 waits for OD-3" is therefore incomplete. Options for the owner:
   (a) apply `130400` with the flag row **absent** and without deploying `qualification-reviews` / without
   the `QUALIFICATION_REVIEW_ENABLED` secret — the review stays closed in the DB (`0A000`), nobody can verify
   until OD-3 is approved (recommended: schema ≠ activation);
   (b) keep `130400` back and change `professional-qualifications` to work without it (code change + tests).
   Either way, OD-3 still governs **activation** of the review flow.

## 6. Risks introduced

| Risk                                                                                              | Severity                              | Mitigation                                                                      |
| ------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------- |
| Partial rollout (migrations or functions missing) breaks matches page / passport save             | High                                  | §5 full list; gates; probes after each step                                     |
| `professional-qualifications` needs `130400` objects (`reviewed_at`, `own_qualification_reviews`) | High (if rolled out per the old plan) | §5 item 4: apply `130400` with the flag off (recommended) or patch the function |
| Generated DB types lag local migrations (`pnpm db:types` targets production)                      | Low                                   | regenerate from the local stack                                                 |
| Large uncommitted tree (237 files) — loss or mixing of unrelated work                             | Medium                                | commit in the change sets of §2 (owner authorization)                           |
| Documentation drift (60 stale statements found)                                                   | Medium                                | corrected in this task where verifiable (completeness audit §6)                 |

## 7. Regenerate

```bash
git fetch --dry-run origin   # read-only check that origin/main has not moved
git rev-parse origin/main HEAD
git diff --name-status origin/main HEAD | cut -f1 | sort | uniq -c          # committed
git diff --name-status HEAD | cut -f1 | sort | uniq -c                       # uncommitted tracked
git ls-files --others --exclude-standard | wc -l                              # untracked
git diff --name-status origin/main | cut -f1 | sort | uniq -c                 # tracked vs GitHub
```
