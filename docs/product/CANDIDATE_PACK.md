# Candidate Pack and contact consent (D-07) · DESIGN, not implemented

> Owner direction of 2026-10-19 (D-07, restated later the same day): identity, contact and documents stay protected; access depends on a concrete purpose, a valid application state and explicit consent.
> Earlier direction (D-07): no private document or contact datum is ever shared because a
> match exists. The technician grants **explicit** consent, **scoped to one requirement and one
> organization**, revocable for future access, audited; short-lived signed URLs where files are
> involved. **No real sharing is implemented until every privacy control below exists and is
> tested.** Depends on D-06 (application states, `APPLICATIONS_STATE_MACHINE.md`) and D-10
> (document storage and scanning, `DOCUMENT_WALLET.md`).

## 1. Two independent permissions

| Permission               | Unlocks (for that organization, for that requirement only)                                                 | Requires — all at the moment of each access, checked by the server                                                                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Identity and contact** | real name, e-mail, phone (when modelled) — one common informed consent (P4)                                | contact consent active (not revoked) **and** application state ∈ {`accepted`, `confirmed`} (P1: from acceptance, owner proposal)                                                                                            |
| **Documents**            | the documents the technician selected for the pack, nothing else; view **and** download, each audited (P2) | pack consent active **and** application `accepted` or `confirmed` **and** each document: owned by the technician, not deleted, scan status `clean` from an **approved** scanner (D-10, P2), not expired if it has an expiry |

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
- Access logs: append-only, kept for a **limited period** to be fixed with legal counsel, then
  deleted (P3); until the period is fixed, no real sharing is enabled.
- Revocation: consent `revoked_at` set → every later call fails; URLs already issued expire within
  60 s (accepted residual risk, stated to the technician).

## 3. Privacy rules carried from the prototype review (do not copy)

- V1.8 sent `pack.documents` inside the application row and returned real user ids in the directory:
  both rejected here (S-rows in `docs/integration/crewflex-v13/09-v18-delta.md`).
- Contact consent in V1.8 was a checkbox at application time with no scope or revocation: here it is
  scoped, revocable and audited.

## 4. Decisions

Owner proposals of 2026-10-19 for P1–P4; §1 reflects them. Each still needs **ratification** before
any code that shares data (§4.1). Earlier options and recommendations kept for the record.

| #   | Question                                                                       | Options                                                                                                      | Recommendation (earlier)                                                                                                    | Status 2026-10-19                                                                                      |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| P1  | Is `proposed` enough for contact, or only from `accepted`?                     | (a) from `proposed` · (b) from `accepted` · (c) only from `confirmed`                                        | (b) From `accepted` (the technician has accepted terms), unless the owner wants earlier contact                             | **Owner proposal: (b)** — contact from acceptance, with its specific consent                           |
| P2  | May an organization download (not only view) pack documents?                   | (a) view only (inline signed URL) · (b) view and download, each audited · (c) neither until a scanner exists | (b), each audited — and, per D-10, neither until an approved scanner marks the file `clean`                                 | **Owner proposal: (b)**, audited, **only once an approved document scan exists** (until then: neither) |
| P3  | Retention of access logs                                                       | (a) indefinitely (append-only) · (b) a fixed period, then deleted · (c) account lifetime + a fixed period    | (b) — a defined period agreed with legal counsel (data minimisation; access logs are personal data), append-only until then | **Owner proposal: (b)** limited retention; **the period is not fixed** (legal criterion pending)       |
| P4  | Is identity (real name) unlocked together with contact, or by its own consent? | (a) with the contact permission · (b) separate identity consent · (c) only from `confirmed`                  | (a): name and contact serve the same purpose; one consent is easier to understand                                           | **Owner proposal: (a)** — real identity and contact under **one common informed consent**              |

### 4.1 Still to ratify before implementing sensitive operations

- P1–P4 as a whole, together with the consent text the technician sees (it must name the
  organization and, for agencies, the represented client — D-12).
- The access-log retention period (P3): blocks any real sharing until fixed with legal counsel.
- An approved document scanner (D-10): blocks P2 entirely; no document is ever viewable or
  downloadable by an organization before it exists.
- The D-06 states the conditions refer to (`APPLICATIONS_STATE_MACHINE.md` §4.1).

Nothing in this document is implemented; no table, function, policy or UI for sharing exists.
