# Recruiter model (D-12) · PROVISIONAL, documentation only

> Owner direction of 2026-10-19 (D-12, provisional): a recruiter is an **agency organization that
> represents clients** — not a global administrator and not a separate authentication system.
> Permissions are per organization and per represented client; representation is explicit,
> revocable and verifiable. Full implementation is a later phase; this document records the model
> and its implications so other work does not contradict it.

## 1. Model

| Concept                           | Representation                                                                                                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Agency                            | An ordinary `organizations` row with `organization_type = 'staffing_agency'` (value already exists). Its people are ordinary members with organization roles (`admin`/`manager`/`member`)                                |
| Represented client                | `represented_clients` (agency_id, client_organization_id **or** client name + country when the client has no account, status `pending` / `active` / `revoked`, evidence reference, created_by, activated_by, revoked_at) |
| Verifiable representation         | `active` only after the client organization's admin confirms in Crew Flex, or a platform admin records the evidence (audited). Never self-declared by the agency alone                                                   |
| Requirement on behalf of a client | `work_requirements.on_behalf_of_client_id` (nullable) referencing an **active** representation of the creating agency; checked by trigger/RPC, re-checked on publish and confirm                                         |

## 2. Permission rules

- An agency member has exactly the rights of its organization role **inside its own organization**;
  there is no cross-organization or platform role. `platform_role` is never touched.
- Acting for a client requires an `active` representation at the moment of the action; revocation
  stops new actions at once (existing applications keep their history; the client decides what
  happens to open requirements).
- Professionals, documents and requirements of other organizations stay invisible: the same RLS as
  any organization (pseudonymous pool, D-07 consents). Consent text names **both** the agency and the
  represented client (the technician must know who receives the data — D-12 recommendation in
  `docs/integration/crewflex-v13/08-product-decisions.md`).
- Every representation change and every action on behalf of a client is audited with
  `organization_id = agency` and `metadata.client_id`.

## 3. Implications for current work

- No code may assume "one organization = the employer" for a requirement: keep `organization_id` as
  the owner of the requirement and add the client reference later.
- No commercial terms (fees, commissions) are modelled: OD-7 / OUT.
- Recruiter-specific screens of the prototype (pipeline for clients, client publication) wait for
  this phase; no UI is added now.

## 4. Open points (later phase)

Who may confirm a representation when the client has no Crew Flex account; whether a client may see
the agency's pipeline for its requirements; KYB of agencies (C-14 / OD-5).
