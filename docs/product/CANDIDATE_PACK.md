# Candidate Pack and contact consent (D-07) · DESIGN, not implemented

> Owner direction of 2026-10-19 (D-07): no private document or contact datum is ever shared because a
> match exists. The technician grants **explicit** consent, **scoped to one requirement and one
> organization**, revocable for future access, audited; short-lived signed URLs where files are
> involved. **No real sharing is implemented until every privacy control below exists and is
> tested.** Depends on D-06 (application states, `APPLICATIONS_STATE_MACHINE.md`) and D-10
> (document storage and scanning, `DOCUMENT_WALLET.md`).

## 1. Two independent permissions

| Permission    | Unlocks (for that organization, for that requirement only)       | Requires — all at the moment of each access, checked by the server                                                                                                                         |
| ------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Contact**   | display name, e-mail, phone (when modelled)                      | contact consent active (not revoked) **and** application state ∈ {`proposed`, `accepted`, `confirmed`} (proposal: open question P1)                                                        |
| **Documents** | the documents the technician selected for the pack, nothing else | pack consent active **and** application `accepted` or `confirmed` **and** each document: owned by the technician, not deleted, scan status `clean` (D-10), not expired if it has an expiry |

Neither permission implies the other. Before both conditions hold, the organization keeps seeing the
per-requirement pseudonym (`CF-…`, T-04) and the match explanation only.

## 2. Model (sketch)

- `application_consents` (application_id, kind `contact` | `documents`, granted_at, revoked_at,
  granted_by = technician, scope = the application's requirement + organization, both immutable).
  Grant and revoke are separate audited events; a revoke never deletes the grant row.
- `candidate_pack_items` (application_id, document_id) chosen by the technician; frozen per
  application; removing a document from the wallet removes it from future access, never rewrites
  history.
- Access never through table SELECT by the organization: one `SECURITY DEFINER` function per
  permission (`get_application_contact`, `issue_pack_document_url`) that checks the table above,
  writes an audit row (`pack.contact_viewed`, `pack.document_url_issued` with document id, actor,
  organization, requirement — never the URL or the content) and returns data or a signed URL valid
  **≤ 60 s** (Edge Function, service role justified in `EDGE_FUNCTIONS.md` only for signing).
- Revocation: consent `revoked_at` set → every later call fails; URLs already issued expire within
  60 s (accepted residual risk, stated to the technician).

## 3. Privacy rules carried from the prototype review (do not copy)

- V1.8 sent `pack.documents` inside the application row and returned real user ids in the directory:
  both rejected here (S-rows in `docs/integration/crewflex-v13/09-v18-delta.md`).
- Contact consent in V1.8 was a checkbox at application time with no scope or revocation: here it is
  scoped, revocable and audited.

## 4. Open questions for the owner

| #   | Question                                                     | Recommendation                                                                                                  |
| --- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| P1  | Is `proposed` enough for contact, or only from `accepted`?   | From `accepted` (the technician has accepted terms), unless the owner wants earlier contact                     |
| P2  | May an organization download (not only view) pack documents? | View via signed URL with `Content-Disposition: inline`; download is the same risk, so allow both but audit each |
| P3  | Retention of access logs                                     | Keep audit rows indefinitely (append-only), like other `audit_events`                                           |
