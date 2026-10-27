# Recruiter model (D-12) · PROVISIONAL model, implemented locally as a technical default

> Owner direction of 2026-10-19 (D-12, provisional): a recruiter is an **agency organization that
> represents clients** — not a global administrator and not a separate authentication system.
> Permissions are per organization and per represented client; representation is explicit,
> revocable and verifiable. Since SCOPE-2 (2026-10-22) the LATER «recruiter with clients» is implementable
> locally: package recruiter (2026-10-23, migrations `20261024500000`/`500100`, function `represented-clients`,
> BUSINESS_RULES BR-27, technical defaults T-130…T-135 in `docs/integration/crewflex-v13/08-product-decisions.md`)
> implements this model **locally only, not deployed**. The model itself stays provisional: every default below is
> cheap to change.

## 1. Model

| Concept                           | Representation                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agency                            | An ordinary `organizations` row with `organization_type = 'staffing_agency'`. Its people are ordinary members with organization roles (`admin`/`manager`/`member`)                                                                                                                                                                                                                            |
| Represented client                | `represented_clients` (agency_id, name, optional contact e-mail, status `pending` / `active` / `revoked`, created_by, activated_at, revoked_at). IMPLEMENTED: name + e-mail as v1.8 («Nuevo cliente», «Correo del cliente»); the e-mail for the agency's admins/managers and platform admins only; no country and no link to a client organization with a Crew Flex account yet (T-131)       |
| Verifiable representation         | `active` only after a platform admin records the evidence (`activate_represented_client`, evidence in `represented_client_reviews`, platform admins only, audited; never for an agency the admin belongs, belonged to or acted for). Never self-declared by the agency alone (T-130). The client organization's own confirmation waits (§4)                                                   |
| Requirement on behalf of a client | `work_requirements.on_behalf_of_client_id` (nullable) referencing an **active** representation of the creating agency; checked by BEFORE triggers on every write path; changes only on a draft (the published client is the recipient); re-checked on publish, resume, apply and every forward application step; the organization type cannot flip around these rules (T-132, T-133, BR-27.7) |

## 2. Permission rules

- An agency member has exactly the rights of its organization role **inside its own organization**;
  there is no cross-organization or platform role. `platform_role` is never touched.
- Acting for a client requires an `active` representation at the moment of the action; revocation
  stops new actions at once (existing applications keep their history; the agency decides what
  happens to open requirements — nothing is paused or closed automatically, T-133).
- Professionals, documents and requirements of other organizations stay invisible: the same RLS as
  any organization (pseudonymous pool, D-07 consents). Consent text names **both** the agency and the
  represented client (the technician must know who receives the data): «Autorizo compartir con {org}, para su
  cliente {cliente}, estos datos para esta necesidad.» (T-134).
- Every representation change and every action on behalf of a client is audited: `client.added` / `client.revoked`
  and `requirement.client_changed` with `organization_id = agency` and `metadata.client_id`; `client.activated`
  without an organization id (the platform admin's act, as the organization review, T-52).

## 3. What exists (local only)

- `/app/recruiter` «Espacio recruiter»: the organization dashboard's KPIs and the «Cartera de clientes» (add, revoke,
  states); an agency's «Resumen» and `/app` land there. `/app/admin/representations`: the platform admin's activation.
- Builder: «Cliente destinatario del expediente» (active clients only), «Selecciona un cliente.» to publish, the
  recruiter note of v1.8 shown to the agency only (v1.8 showed it to the client company too, ORG-03 #13 ✗).
- Professionals: «Publicada por {org} para el cliente {cliente}» on the opportunity card and detail, and in
  «Ofertas en la red»; the client's contact never leaves the agency. The application screens of both parties name the
  client the Candidate Pack copy was received for («… recibió {org}, para su cliente {cliente} …»), as recorded, also
  after a revocation (`requirement_cards`, `20261027200000`, T-169). For an agency, «Buscar candidatos» is «Red recruiter».
- No commercial terms (fees, commissions) are modelled: OD-7 / OUT. The Candidate Pack's «Preparar presentación para
  cliente» export stays off with the pack (D-07 P3).

## 4. Open points

Who may confirm a representation when the client has a Crew Flex account (client-organization confirmation);
whether a client may see the agency's pipeline for its requirements; KYB of agencies (C-14 / OD-5); whether the
API's proposal terms should repeat the client's name (the database freezes it with each version and «Mis candidaturas» and
the agency's «Candidaturas» name it since T-169; the client is frozen once applied to, so the consent stays true).
