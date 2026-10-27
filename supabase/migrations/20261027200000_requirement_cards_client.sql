-- Crew Flex — the requirement card names the represented client (P11 Recruiter, ORG-08 #7 / HIRE-05 #13; BR-27.6, T-169)
--
-- v1.8 `Workflow.jsx:28` Candidate Pack: «Alcance y destinatario: {empresa} para {cliente}». The copy a professional
-- shares when applying to a staffing agency's requirement is received by the agency FOR its client (the consent names
-- both, T-134), so the two parties' application screens must say the same: «Mis candidaturas» → «Ver expediente» and
-- the agency's «Candidaturas». Both read the requirement through the private projection `app_private.requirement_cards`
-- (`get_my_applications`, `get_organization_applications`, `get_requirement_applications`, 20261022130300 /
-- 20261024100100 / 20261024100900), which did not carry the client (T-134 note: «requirement_cards untouched»).
--
-- Change (additive): the view gains the client's NAME — one key `clientName` inside `card` and one trailing column
-- `client_name` (CREATE OR REPLACE VIEW appends columns only; nothing is renamed or dropped). It names the client as
-- RECORDED on the requirement, whatever the representation's status now: an application made for that client stays an
-- application made for that client after a revocation (the history stays true, BR-27.5; T-169). `list_opportunities`
-- keeps its own rule (T-134: an inactive representation's requirement is not listed at all).
--
-- Privacy: the name only, as every professional reads it already on the card and in the consent (BR-27.6). Never
-- `contact_email`, never ids. Who reads the view: nobody directly (no grant, as before); only the SECURITY DEFINER
-- RPCs above, whose own checks (the application's two parties, the organization's admins/managers) are unchanged.
-- No table, column, policy, grant or data changes. Safe to re-run (the view is replaced in place).

create or replace view app_private.requirement_cards as
select
  wr.id,
  wr.status,
  o.name as organization_name,
  wr.title,
  wr.location,
  wr.starts_at,
  wr.ends_at,
  wr.shift,
  wr.headcount,
  wr.urgency,
  wr.created_at,
  q.qualifications,
  jsonb_build_object(
    'id', wr.id,
    'organizationName', o.name,
    'title', wr.title,
    'location', wr.location,
    'startsAt', to_char(wr.starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'endsAt', to_char(wr.ends_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'shift', wr.shift,
    'headcount', wr.headcount,
    'urgency', wr.urgency,
    'createdAt', to_char(wr.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'status', wr.status,
    'qualifications', q.qualifications,
    'country', wr.country,
    'timeZone', wr.timezone,
    'description', wr.description,
    'shifts', wr.shifts,
    'conditions', wr.conditions,
    -- Recruiter (BR-27.6, T-169): the represented client's name as recorded on the requirement; null = no client.
    'clientName', rc.name
  ) as card,
  wr.country,
  wr.timezone,
  wr.description,
  wr.shifts,
  wr.conditions,
  rc.name as client_name
from public.work_requirements wr
join public.organizations o on o.id = wr.organization_id
left join public.represented_clients rc on rc.id = wr.on_behalf_of_client_id
cross join lateral (
  select coalesce(jsonb_agg(jsonb_build_object(
           'qualificationTypeId', qt.id,
           'code', qt.code,
           'name', qt.name,
           'level', wrq.requirement_level
         ) order by wrq.requirement_level, qt.code), '[]'::jsonb) as qualifications
  from public.work_requirement_qualifications wrq
  join public.qualification_types qt on qt.id = wrq.qualification_type_id
  where wrq.work_requirement_id = wr.id
) q;

-- As before (20261022130200, 20261023600000): no direct reader; the DEFINER RPCs read it.
revoke all on app_private.requirement_cards from public, anon, authenticated;
