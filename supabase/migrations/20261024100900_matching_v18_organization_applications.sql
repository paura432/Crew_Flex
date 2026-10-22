-- Crew Flex — package matching-v18 on top of hiring-polish: the organization-wide «Candidaturas» rows
-- (get_organization_applications, 20261024100100) carry what the shared engine needs to judge them with the
-- v1.8 profile requirements (BR-3.7–3.13): the applicant's `candidate_declarations` (from
-- get_requirement_applications, which this function already calls, so the same minimisation T-85 applies) and
-- the requirement's six rule columns (the job's country is in the card). Without them the Edge Function would
-- evaluate those applicants without the rules.
-- Named after hiring-polish's file so it runs after it (a later definition of the same function); the
-- package's own migrations are 20261023900000…200.
-- NON-DESTRUCTIVE: drop + create of get_organization_applications with the same arguments and body, the
-- return type grows by seven columns (PostgreSQL only allows that through drop + create); same grants
-- re-applied in this transaction. No table, column, policy or data changes.

drop function public.get_organization_applications(uuid, uuid, public.application_status, integer, integer);
create function public.get_organization_applications(
  p_organization_id uuid,
  p_requirement_id uuid default null,
  p_status public.application_status default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  application_id uuid,
  requirement_id uuid,
  status public.application_status,
  created_at timestamptz,
  updated_at timestamptz,
  reason text,
  current_proposal jsonb,
  accepted_proposal_id uuid,
  history jsonb,
  candidate_ref text,
  candidate_pool text,
  candidate_display_name text,
  candidate_base_location text,
  candidate_years_experience integer,
  candidate_qualifications jsonb,
  candidate_availability jsonb,
  candidate_declarations jsonb,
  requirement jsonb,
  category text,
  aircraft text[],
  requires_type_rating boolean,
  engines text[],
  min_years integer,
  required_skills text[],
  total bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.has_org_role(p_organization_id, array['admin', 'manager']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  return query
  with page as (
    select a.id, a.requirement_id, a.created_at, count(*) over () as total
    from public.applications a
    join public.work_requirements wr on wr.id = a.requirement_id
    where wr.organization_id = p_organization_id
      and (p_requirement_id is null or a.requirement_id = p_requirement_id)
      and (p_status is null or a.status = p_status)
    order by a.created_at desc, a.id
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
    offset least(greatest(coalesce(p_offset, 0), 0), 10000)
  ),
  -- The pool-rule projection, once per requirement on the page (same role check inside).
  shown as (
    select r.requirement_id as req_id, ra.*
    from (select distinct p.requirement_id from page p) r
    cross join lateral public.get_requirement_applications(r.requirement_id) ra
  )
  select a.id, a.requirement_id, a.status, a.created_at, a.updated_at, a.reason,
         app_private.proposal_json(a.current_proposal_id), a.accepted_proposal_id,
         app_private.application_history(a.id),
         s.candidate_ref, s.candidate_pool, s.candidate_display_name, s.candidate_base_location,
         s.candidate_years_experience, s.candidate_qualifications, s.candidate_availability,
         s.candidate_declarations,
         c.card,
         wr.category, wr.aircraft, wr.requires_type_rating, wr.engines, wr.min_years, wr.required_skills,
         p.total
  from page p
  join public.applications a on a.id = p.id
  -- A closed account (no technician) is absent from the pool projection: listed without an applicant.
  left join shown s on s.application_id = p.id and s.req_id = p.requirement_id
  join app_private.requirement_cards c on c.id = p.requirement_id
  join public.work_requirements wr on wr.id = p.requirement_id
  order by p.created_at desc, p.id;
end;
$$;

revoke execute on function
  public.get_organization_applications(uuid, uuid, public.application_status, integer, integer)
from public, anon;
grant execute on function
  public.get_organization_applications(uuid, uuid, public.application_status, integer, integer)
to authenticated;
