# Security & Privacy

Priority order: **security > domain correctness > data integrity > product clarity >
maintainability > UI polish > feature count.**

## Structural rules

1. `SECRET ≠ PUBLIC ENV`. Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   exist in the frontend. Backend secrets live in **Supabase Edge Function Secrets**
   (`supabase secrets set NAME=value`) and are read at runtime with `Deno.env.get`.
2. `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` must never exist. A repo test fails if `service_role`,
   `SERVICE_ROLE` or `sb_secret_` appear under `src/`.
3. Default execution context is **user JWT + RLS**. Service role is not used anywhere in V0.
4. Identity comes from the verified JWT (`auth.getClaims`). Payload schemas are `.strict()`, so a
   body `userId` / `role` is rejected, never trusted.
5. Errors returned to clients are normalized (`code` + safe message + `requestId`). No stack
   traces, SQL, Supabase internals, tokens.
6. Logs: function, requestId, actorId, duration, result. Never Authorization headers, passwords,
   tokens, documents, secrets or full payloads.

## Matchable vs shareable data

`get_requirement_candidate_pool()` returns, for external candidates, only: a per-requirement
pseudonymous reference, base location, years of experience, the qualifications **relevant to the
requirement** (type, status, verification, expiry) and availability windows **overlapping the
requirement**. Display name only if visibility = `open`. No email, phone, documents, employer, rates.

## Threat model

| #   | Threat                                          | Asset                     | Impact                | Mitigation                                                                                                                                                                                                            | Status                                  |
| --- | ----------------------------------------------- | ------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| T1  | **IDOR** (guess another requirement/profile id) | Requirements, profiles    | Data leak             | RLS on every table; functions query with user JWT; candidate pool checks org role                                                                                                                                     | IMPLEMENTED (tested)                    |
| T2  | **Broken RLS**                                  | All private tables        | Data leak / tampering | RLS enabled in the same migration that creates each table; explicit per-command policies; `anon` has no table grants; PGlite RLS tests                                                                                | IMPLEMENTED (tested)                    |
| T3  | **Cross-org access**                            | Requirements, workforce   | Competitive leak      | `is_org_member` / `has_org_role` helpers in every org policy                                                                                                                                                          | IMPLEMENTED (tested)                    |
| T4  | **User impersonation**                          | Actor identity            | Acting as others      | Actor from JWT only; strict schemas reject `userId`; `created_by` forced by RLS `with check (created_by = auth.uid())`                                                                                                | IMPLEMENTED (tested)                    |
| T5  | **Role escalation**                             | `platform_role`, org role | Privilege gain        | Column grants: users can update only `profiles.display_name`; `platform_role` never read from sign-up metadata; only org admins manage memberships                                                                    | IMPLEMENTED (tested)                    |
| T6  | **Document leakage**                            | CVs, licences             | Severe privacy breach | Private bucket + signed URLs ≤ 60 s + path-only in DB                                                                                                                                                                 | PLANNED (no storage yet)                |
| T7  | **Service-role leakage**                        | Full DB access            | Total compromise      | Not used in V0; repo scan test; never `NEXT_PUBLIC_*`                                                                                                                                                                 | IMPLEMENTED                             |
| T8  | **Secret leakage**                              | API keys                  | Abuse, cost           | Supabase Secrets only; `.env*` gitignored except `.env.example`; manual scan before commit                                                                                                                            | IMPLEMENTED                             |
| T9  | **Candidate enumeration**                       | Professional network      | Poaching, privacy     | `technician_profiles` not selectable by orgs; pool only via definer function per requirement, role-checked, prefiltered by relevant qualifications, capped at 100, pseudonymous refs not linkable across requirements | IMPLEMENTED (OD-5 for org verification) |
| T10 | **Verification tampering**                      | `verification_status`     | False eligibility     | No update grant on `verification_status`; insert check forces `pending`; trigger resets verification when evidence fields change                                                                                      | IMPLEMENTED (tested)                    |
| T11 | **Audit tampering**                             | `audit_events`            | Loss of traceability  | No insert/update/delete grants; written by definer triggers only                                                                                                                                                      | IMPLEMENTED (tested)                    |
| T12 | **Unsafe uploads**                              | Storage                   | Malware, XSS          | Type/size allowlist, private bucket, no inline rendering                                                                                                                                                              | PLANNED                                 |
| T13 | **XSS**                                         | Session                   | Account takeover      | React escaping, no `dangerouslySetInnerHTML`, security headers in `next.config.ts`                                                                                                                                    | IMPLEMENTED                             |
| T14 | **CSRF**                                        | Mutations                 | Unwanted actions      | Next.js Server Actions (origin check); Edge Functions require bearer token (not cookies) and CORS allowlist                                                                                                           | IMPLEMENTED                             |
| T15 | **Dependency supply chain**                     | Build                     | Compromise            | Lockfile, exact critical versions, `onlyBuiltDependencies` allowlist in pnpm, minimal deps                                                                                                                            | IMPLEMENTED                             |
| T16 | **Edge Function authorization bypass**          | Business ops              | Unauthorized ops      | Every protected handler: authenticate → actor → authorize (DB role) → validate → act; RLS as second layer                                                                                                             | IMPLEMENTED                             |
| T17 | **Payload abuse**                               | Availability              | DoS / cost            | Body size limit (32 KB), array limits, string limits, pagination limits                                                                                                                                               | IMPLEMENTED                             |

## Privacy by design

- Default visibility `private`. The profile never becomes a public directory automatically.
- Internal workforce data visible to own organization admins/managers only (OD-4).
- Audit metadata contains ids and counts, not personal data.
