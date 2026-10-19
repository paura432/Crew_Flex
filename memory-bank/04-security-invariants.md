# 04 · Security invariants

Canonical: `docs/architecture/AUTHORIZATION.md` (roles, RLS matrix, function checklist),
`docs/product/SECURITY_PRIVACY.md` (threat model T1–T21), `supabase/migrations/*.sql` (truth).
This file is the **checklist an agent runs before and after touching security-relevant code**.

## Invariants (must hold after every change)

| #    | Invariant                                                                                                                                                                                                   | Enforced by                                                          | Regression proof                             |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------- |
| S-1  | Every public table has RLS enabled in the migration that creates it; `anon` has no table privileges                                                                                                         | migrations                                                           | `tests/db/rls.test.ts` A–B                   |
| S-2  | Identity = verified JWT subject (`auth.getClaims`). Payload schemas are `.strict()`; `userId`/`role`/`organizationRole` from a request are rejected                                                         | `_shared/auth.ts`, `src/lib/validation/*`                            | validation tests, `*_test.ts`                |
| S-3  | Organization role is read from the DB (`requireOrganizationRole`, `has_org_role`), never from the token or the client                                                                                       | `_shared/auth.ts`, RLS helpers                                       | rls C–E                                      |
| S-4  | `platform_role` is never set from sign-up metadata and is not updatable by users                                                                                                                            | `handle_new_user`, column grants                                     | rls (sign-up trigger)                        |
| S-5  | A professional can never write `verification_status`, `reviewed_*`, `review_note`; inserts are `pending`; re-dating resets review                                                                           | column grants, insert check, `reset_verification_on_change`          | rls F, N                                     |
| S-6  | Organizations cannot read `reviewed_by` / `review_note` (column-level SELECT)                                                                                                                               | `20261015130400`                                                     | rls N                                        |
| S-7  | External candidates are reachable **only** through the per-requirement DEFINER pool function, role-checked, minimised, pseudonymous unless `open`; `private` never appears                                  | `get_requirement_candidate_pool`, `ranked_external_pool`             | rls (enumeration), M                         |
| S-8  | No service role / secret key in `src/` or functions (single written exception: `documents-maintenance`, Storage deletes only, LOCAL ONLY); only `NEXT_PUBLIC_SUPABASE_URL` + `…_PUBLISHABLE_KEY` are public | `tests/security/repo-hygiene.test.ts`, `src/lib/env.ts`              | repo-hygiene                                 |
| S-9  | Audit rows are written only by DEFINER triggers/RPCs; no grants to modify them; metadata holds ids/flags, no free text or personal data                                                                     | migrations                                                           | rls (audit)                                  |
| S-10 | Every DEFINER function: `set search_path = ''`, `revoke execute … from public, anon`, `auth.uid()` + role check **in the body**, minimal output                                                             | migrations (review each new one)                                     | rls N, M                                     |
| S-11 | `app_private` is not an exposed PostgREST schema; its tables have no grants to API roles                                                                                                                    | `supabase/config.toml` `[api] schemas`, migrations                   | check config before any remote apply         |
| S-12 | Flows that need a product decision fail closed in the DB (`app_private.feature_flags`) **and** in the function (secret)                                                                                     | `review_qualification`, `qualification-reviews`                      | `qualification-reviews/index_test.ts`, rls N |
| S-13 | Errors to clients are normalised (`code` + safe message + `requestId`); DB messages never forwarded                                                                                                         | `_shared/errors.ts`, `src/server/edge-functions.ts`                  | `http_test.ts`, `edge-functions.test.ts`     |
| S-14 | Business SQLSTATEs never use `40001` (PostgREST retries it forever) — use custom `CFxxx` codes                                                                                                              | `20261015130100`, `130200`                                           | local E2E                                    |
| S-15 | Local tooling can never write to production: `scripts/local/sb-local.sh` refuses `--linked`/`--project-ref`/remote `--db-url`; remote E2E needs the two-condition guard                                     | `tests/security/local-guard.test.ts`, `e2e-production-guard.test.ts` | those tests                                  |

**RLS does not protect a SECURITY DEFINER function.** Inside one, the function body is the only
authorization. Review every DEFINER for S-10 and test the "other organization" and "other user" cases.

## Roles (summary — matrix in AUTHORIZATION.md)

`profiles.account_type` routes the UI and grants **nothing**. Permissions come from
`technician_profiles` ownership, `organization_members.role` (`member` < `manager` < `admin`) and
`profiles.platform_role` (`platform_admin`). Plain `member`s do not see colleagues' technician data.

## Sensitive data

| Data                                 | Where                                                              | Who may read                                                                    |
| ------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Qualifications, expiry, verification | `technician_qualifications`                                        | owner · own-org admin/manager (OD-4) · platform admin · external pool minimised |
| Availability                         | `availability_windows`                                             | same as above; external pool only overlapping windows                           |
| Review reason                        | `review_note`                                                      | owner (`own_qualification_reviews`) · platform admin                            |
| Contact data                         | **not stored** (D-07)                                              | —                                                                               |
| Documents (D-10, LOCAL ONLY)         | `professional_documents` + private bucket `professional-documents` | owner only (no org/admin policy; no third-party sharing without a scanner)      |

## Multi-tenancy

Every org-scoped policy goes through `is_org_member` / `has_org_role`. A user acts for one organization
in the UI (`requireOrganizationContext` picks the highest role); the database does not assume that.
Cross-org access returns 404 in the UI (evidence `docs/audit/evidence/remediation-2026-10-15/local-09-cross-org-404.jpg`).

## Agent prohibitions

- No `NEXT_PUBLIC_*SERVICE*`, no service role, no `sb_secret_` anywhere in the repo.
- No disabling/weakening RLS, no broad `grant … to authenticated` to make a test pass.
- No `supabase db push`, `db reset --linked`, `functions deploy`, `secrets set`, Auth setting change or
  any remote write without the owner's explicit authorization **for that action**.
- No editing an applied migration; add a new one.
- No real personal data in seed, fixtures, tests, docs, logs or the memory bank.
- No printing `.env*` contents; check targets with `grep` on the URL only.

## Regression scenarios to re-run after security-relevant changes

User B edits user A's passport/qualification/window → 403/404 · member of org X reads org Y's requirement
→ 404 · plain `member` runs matching → 403 · professional sets `verification_status` → rejected ·
organization reads `review_note` → permission denied · platform admin reviews own qualification → 403 ·
review with stale version → 409 · `private` professional appears in external pool → never · same
`Idempotency-Key` with another payload → 409 · direct PostgREST delete of last hard qualification → rejected at commit.
All automated in `tests/db/rls.test.ts`, `tests/e2e/*` and `scripts/local/db-race-check.sh`.
