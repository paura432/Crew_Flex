# Document wallet (D-10)

**Status: IMPLEMENTED — LOCAL ONLY (2026-10-19).** Backend: migrations `20261019160000_document_wallet.sql`, `20261019160100_document_wallet_hardening.sql`
(security review fixes) and `20261019160200_document_wallet_gate_and_cleanup.sql` (activation gate, M-3 cleanup),
Edge Function `professional-documents`, contract in `src/types/api.ts` / `src/lib/validation/documents.ts` /
`src/domain/documents.ts`. Not applied or deployed to the remote project; the UI is built separately on this
contract. Third-party sharing does **not** exist and must not be added before an approved file-scanning
mechanism (owner decision D-10, `memory-bank/07-decisions-index.md`).

## 1. Owner rules (D-10, 2026-10-19) and where each one is enforced

| Rule                                         | Enforced by                                                                                                                                                                                                                       |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Private bucket, never public URLs            | `storage.buckets.public = false` (the migration fails if a pre-existing bucket is not private); only signed URLs valid **60 s**, generated per request with the caller's JWT and never stored                                     |
| RLS, owner access only                       | `professional_documents` policies `*_own` (select/insert/update/delete, `owner_id = auth.uid()`); `storage.objects` policies on the bucket: first folder = `auth.uid()`. **No organization, manager or platform-admin policy**    |
| Type and size validation                     | Function: magic bytes (`sniffDocumentMime`: `%PDF-`, PNG signature, `FF D8 FF`), Content-Length **and** actual bytes ≤ 5 MiB. Bucket: `file_size_limit = 5242880`, `allowed_mime_types` = pdf/png/jpeg. Table CHECKs on both      |
| Protection against manipulated names / paths | The object path is server-derived `<uid>/<idempotency key>-<16 hex of sha256>`: no user text. Table CHECK + Storage insert policy accept only that shape. Titles are display text, sanitised (`sanitizeDocumentTitle`)            |
| Third-party access only when authorised      | No such path exists. `canShareWithThirdParties` is true only for `scan_status = 'clean'`, which nothing can write (`authenticated` has no column grant; no scanner exists)                                                        |
| Log relevant accesses                        | Audit rows `document.uploaded` / `document.updated` / `document.deleted` (DEFINER trigger; ids, kind, mime, size, sha256 — never title, path or bytes). Each signed URL issued logs a structured `document_url_issued` (ids only) |
| No sharing without approved scanning         | `scan_status` defaults to `not_scanned`; there is no sharing table, policy or endpoint                                                                                                                                            |

## 2. Architecture

```
browser ──multipart──▶ Next.js server action ──invokeEdgeFunction(FormData)──▶ professional-documents (user JWT)
                                                                                  │ 1. requireActor, Idempotency-Key (required), requireTechnician
                                                                                  │ 2. size cap (header + bytes), sniff mime, sanitise title, sha256
                                                                                  │ 3. Storage upload, upsert=false (user client → Storage RLS)
                                                                                  │ 4. RPC create_professional_document (INVOKER, idempotent)
                                                                                  ▼
                                                   public.professional_documents (RLS)  +  storage.objects in bucket professional-documents
```

- **Endpoints** (`docs/architecture/EDGE_FUNCTIONS.md`): `GET` list · `GET ?id=&url=1` signed URL · `POST`
  multipart (`file`, `kind`, `title`, `expiresAt`, `qualificationId`; `Idempotency-Key` required; 201 / 200 replay
  / 409) · `PATCH ?id=` (`kind`, `title`, `expiresAt`, `qualificationId`, all required) · `DELETE ?id=`.
- **No service role.** Every query, upload, signed URL and removal runs with the caller's JWT; RLS and Storage
  policies are the authorization. A signed URL for another user's document is a 404 (row invisible) and Storage
  refuses it anyway (object invisible).
- **Idempotency.** The path contains the key and a hash prefix: a retry of the same file reuses its object
  ("already exists" is fine) and the RPC replays the original row (200). A different file under the same key gets
  another path and the RPC answers `CF409` (409); the object that request uploaded is removed again
  (compensation). The RPC refuses (`22023`) any path not derived from (JWT subject, key, sha256).
- **Database backstops** (hold for direct PostgREST calls too): owner = JWT subject (RLS), path shape and owner
  folder (CHECK), object must exist with the declared size (insert trigger), linked qualification must be the
  owner's (trigger; missing and foreign look the same), mime/size/sha/title CHECKs, `scan_status` / path / hash /
  mime / size / owner not updatable (column grants). Storage objects are immutable (no UPDATE policy) and cannot
  be deleted while a row points at them.

## 3. Threat model (additions to `SECURITY_PRIVACY.md`)

| Threat                                              | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Another user / organization reads a document        | Owner-only RLS on rows and objects; no org/manager/admin policy; 404 without existence oracle. Tested: `tests/db/rls.test.ts` Q, local E2E                                                                                                                                                                                                                                                                                                            |
| Leaked or persisted URL                             | Signed URLs live 60 s and are issued per request; the bucket's public URL serves nothing. Never store a signed URL                                                                                                                                                                                                                                                                                                                                    |
| Executable or script disguised as a PDF/image       | Through the function: type from magic bytes, not from name or declared type; served with the sniffed `Content-Type`. Renamed `.exe` and text-as-PDF are rejected (unit + E2E). **Gap (review M-1):** a caller using Storage + PostgREST directly can store any bytes under an allowed declared type and assert `mime_type`/`sha256` for them — own files only; the database cannot see bytes, so a future scanner must re-derive type and hash itself |
| Path traversal / overwriting another object         | Server-derived path, strict CHECK + Storage insert regex, folder = `auth.uid()`, `upsert = false`, no UPDATE policy                                                                                                                                                                                                                                                                                                                                   |
| Spoofed titles (RTL override, control chars, `../`) | `sanitizeDocumentTitle`: NFC, strips Cc/Cf, separators, quotes; max 180; titles are never used as names, paths or headers                                                                                                                                                                                                                                                                                                                             |
| Oversized uploads / memory exhaustion               | 413 on Content-Length > 5 MiB + 64 KiB, body read with a hard cap, file ≤ 5 MiB, bucket limit 5 MiB, CHECK 1..5242880                                                                                                                                                                                                                                                                                                                                 |
| Direct Storage upload bypassing the function        | Only into the caller's own folder, only for accounts with a technician profile (`20261019160100`, review M-2), only with the bucket's mime list; reaches nobody else and is never shared (sharing needs `clean`, i.e. a scanner pass). No per-owner quota yet                                                                                                                                                                                         |
| Malicious content inside a valid PDF/PNG/JPEG       | **Not mitigated by inspection** — hence no third-party access until an approved scanner exists (D-10). Today only the owner can open their own file                                                                                                                                                                                                                                                                                                   |
| Audit leaking personal data                         | Metadata: ids, kind, mime, size, sha256 only. Rows have no organization, so only platform admins read them (`audit_events_select`). **Owner to confirm (review L-4):** platform admins thereby learn that a document exists and could confirm a known file by its hash; drop `sha256` from the metadata if that conflicts with "owner access only"                                                                                                    |
| Owner access outside the function not logged        | The owner can also download or sign URLs straight through the Storage API; only the function logs `document_url_issued` (review L-3). Owner-only today; any third-party access must be audited in the database                                                                                                                                                                                                                                        |
| Signed-URL origin misconfigured                     | `STORAGE_PUBLIC_URL` must stay unset remotely (§5); signed URLs are served inline — `download: true` would force `Content-Disposition: attachment` if previews are not needed (review L-5)                                                                                                                                                                                                                                                            |

## 4. Why there is no third-party sharing yet

The owner rule is explicit: without an approved file-scanning mechanism, no sharing with third parties.
Sharing would expose files of unknown content to organizations (and later recruiters, `CANDIDATE_PACK.md`). The
schema is ready for the gate — `scan_status` exists, only `clean` is shareable (`canShareWithThirdParties`), and
nothing can set it — but adding any reader other than the owner is a separate decision, migration and review:
a scanner (who runs it, with which credentials, how it writes `scan_status`; it must re-derive the type and the
hash from the stored bytes and never trust `mime_type`/`sha256`, which are client-asserted at the database
boundary), a sharing
model (consent, scope, revocation, expiry) and an audited access path.

## 5. Signed URLs locally

Inside the local runtime `SUPABASE_URL` is `http://kong:8000`, which a browser cannot open. The function
rewrites the signed URL's origin to `STORAGE_PUBLIC_URL` when that variable is a bare origin (local
`supabase/functions/.env`, template `.env.example`). It is not a secret and must stay **unset** remotely, where
`SUPABASE_URL` is already the public URL.

## 6. Deletion, retention and orphan cleanup (review M-3 — RESOLVED LOCALLY, `20261019160200`)

The row is the source of truth. Delete removes the row first (the Storage policy refuses to remove an object a
row still points at), then the object; if that removal fails the user still gets 200 and the function logs a
`warn` event `orphan_object` (server-derived path only).

**Tombstones.** Every deleted row, whatever the cause, leaves a tombstone in
`app_private.document_object_tombstones` (AFTER DELETE trigger, DEFINER): `owner_delete` (the owner deleted it;
purge-eligible at once), `account_deleted` (the technician profile is gone — account-deletion cascade; purge
after the grace period), `operator_delete` (anyone else, e.g. SQL by an operator; same grace), and
`orphan_upload` (created by reconciliation, below). So the licence scans of a deleted account no longer stay in
the bucket forever: they become due after the grace period.

**«Cerrar cuenta» (PKG account, LOCAL `20261023400100`, T-42).** The person's own closure deletes their document rows
**as the owner** before the account (tombstones `owner_delete`, due at once — the person asked for the erasure), and
the `account` function then removes those objects with the person's own token (own folder, no row points at them).
Whatever Storage leaves is purged by the next `documents-maintenance` run. Only a deletion that skips the button
(operator, Auth Admin API) takes the `account_deleted` grace.

**Reconciliation.** `document_maintenance_batch` lists objects of the bucket that **no row and no open
tombstone** reference and that are older than the orphan grace (24 h — a POST may still be committing its row,
review L-1). Dry-run lists them; apply records `orphan_upload` tombstones. An object that a row references is
never listed (tested).

**Purge.** `documents-maintenance` (platform admin, not deployed, not scheduled; `docs/architecture/EDGE_FUNCTIONS.md`)
takes at most 100 due tombstones, re-checks each right before deleting (`document_purge_recheck`, row lock: no
row references the path, no legal hold, due, not purged), deletes that one object through the Storage API, and
records `purged` / `absent` / `failed` (`document_purge_record`, audit `document.purged`: tombstone id, owner id,
reason — no title, no path). Re-runs are idempotent; failures count `attempts` and stop after 10.

**Proposals for the owner (defaults in `app_private.document_retention_settings`, changed in SQL only):**

| Setting / rule               | Proposed                                                           | Why                                                                         |
| ---------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Grace after account deletion | 30 days (`account_deletion_grace`, 0–3650 days)                    | Time to undo a mistaken deletion or answer a dispute; erasure still happens |
| Orphan grace                 | 24 h (`orphan_upload_grace`, 1 h–30 days)                          | Never delete bytes a concurrent request may still register                  |
| Owner delete                 | immediate                                                          | The person asked for it                                                     |
| Legal hold                   | set/released **only by the database owner in SQL**, no API surface | Rare, high-impact; avoids another DEFINER endpoint. Held = never purged     |

```sql
update app_private.document_retention_settings set account_deletion_grace = interval '30 days';
update app_private.document_object_tombstones set legal_hold = true  where owner_id = '<uuid>' and purged_at is null;
update app_private.document_object_tombstones set legal_hold = false where owner_id = '<uuid>' and purged_at is null;
```

Still open: the purge is manual (not scheduled — scheduling is an owner decision), and holds apply to
tombstones, i.e. after deletion (a hold on live documents is not needed while only the owner can delete).

## 7. Before any remote apply (owner approval required, nothing done)

Ordered rollout: (1) migrations `20261019160000`, `20261019160100`, `20261019160200` (`db push`, creates the bucket and
policies — check the hosted project has no pre-existing `professional-documents` bucket; the migration fails
closed if one exists with other settings). Without the flag row the wallet stays OFF (§8); (2) deploy
`professional-documents` (`verify_jwt = false`, `supabase/config.toml`); (3) leave `STORAGE_PUBLIC_URL` unset;
(4) only when purging is approved: deploy `documents-maintenance` and set `DOCUMENTS_MAINTENANCE_ENABLED=true`
(it uses the service role for Storage deletes only); (5) the owner inserts the flag row; (6) remote smoke with
synthetic files only. Open items: a per-owner quota (none today), scheduling the purge, the retention proposals
(§6), the audit `sha256` question (§3, L-4), and the scanner decision (§4).

## 8. Activation gate (owner decision 2026-10-19: Supabase, not Vercel)

`app_private.feature_flags('document_wallet', true)` — no row = OFF; only the database owner can write it:

```sql
insert into app_private.feature_flags (name, enabled) values ('document_wallet', true);   -- on
delete from app_private.feature_flags where name = 'document_wallet';                     -- off
```

While OFF, every **new** document is refused in the database: `create_professional_document` → `0A000` (404
"service not available"), the table INSERT policy and the bucket's Storage INSERT policy both require the flag
(direct PostgREST inserts and direct Storage uploads are closed too), and the Edge Function answers 404 before
reading the upload. **Reads, metadata edits and deletes stay open** when the flag is switched off later:
turning a feature off must never take a person's own data hostage (they can still list, open and delete it).
The Next.js server reads the flag through `public.is_feature_enabled('document_wallet')` (DEFINER, whitelist,
signed-in users only; fails closed) to hide the nav entry and 404 the page — a convenience, not the barrier.
Known UI consequence: while OFF, the page is hidden, so a professional who already stored files deletes them
only through the API; if the flag is ever switched off with data in it, a read-only page should be added.

## UI and rollout (added with the wallet UI, 2026-10-19)

- `/app/professional/documents` (`src/features/documents`): upload, list, open through a 60-second
  signed link, edit metadata, delete with confirmation. Copy states that uploading does not certify
  a licence and that no organization can see the files.
- **Upload goes from the browser straight to the Edge Function** (`src/features/documents/upload.ts`,
  user JWT + publishable key, no secret). Routing the bytes through a Next.js Server Action would hit
  Vercel's 4.5 MB request-body limit, below the 5 MiB document limit, and would make Next.js carry
  backend traffic. List, URL, edit and delete use the usual server-side `invokeEdgeFunction`.
- **Rollout gate:** the Supabase flag of §8 (no Vercel variable): hides the nav entry and 404s the page
  while off. Production keeps it off until the wallet wave is approved (`docs/qa/ROLLOUT_PLAN_2026-10-19.md`).
  Access control never depends on the UI: the database and the Edge Function enforce the same flag.
- Deliberate difference from V1.8: the owner may open their own unscanned file (V1.8 allowed downloads
  only after a clean scan, even for the owner). The bytes are the owner's own upload; third parties
  still have no path to them.
