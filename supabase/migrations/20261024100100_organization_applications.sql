-- Crew Flex — package hiring-polish (v2 diff area 30: v2-05 «Candidaturas» of the organization, v2-08
-- confirmed coverage per requirement). NON-DESTRUCTIVE: two new DEFINER read functions; no table,
-- column, policy or existing function changes. Organizations still never read `applications` directly.
--
-- get_organization_applications(org, requirement?, status?, limit, offset)
--   One page of the applications to an organization's requirements (admin/manager of THAT organization;
--   anyone else 42501), newest first, with the filtered `total`. The applicant columns are exactly those
--   get_requirement_applications() returns for its requirement — it is CALLED, not copied, so the pool's
--   rules hold unchanged (pseudonym `CF-…` per requirement unless internal; name only for internal or
--   `open`; relevant qualifications and overlapping windows; no contact, no documents); the application
--   columns are read with the same private helpers; plus the requirement card
--   (app_private.requirement_cards, the projection professionals see). An application whose technician
--   closed the account (technician_profile_id NULL, 20261023400100) is still listed — its seat and
--   history stay true — with every applicant column NULL and no reason (the reject/cancel text may be the
--   technician's own words: it does not outlive the account here; security review LOW-1). A requirement of
--   another organization
--   filters to nothing (no oracle).
-- get_requirement_application_counts(org)
--   Applications per status of each of the organization's requirements that has any, with the
--   requirement's headcount, period and number of shifts (20261023600000; NULL = one continuous period) —
--   the organization reads those through RLS anyway: the tabs of «Candidaturas», the dashboard counters
--   and the confirmed coverage (confirmed + finished seats, BR-23). Counts only: no person, no id but the
--   requirement's.

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
  requirement jsonb,
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
  select a.id, a.requirement_id, a.status, a.created_at, a.updated_at,
         case when s.application_id is null then null else a.reason end,
         app_private.proposal_json(a.current_proposal_id), a.accepted_proposal_id,
         app_private.application_history(a.id),
         s.candidate_ref, s.candidate_pool, s.candidate_display_name, s.candidate_base_location,
         s.candidate_years_experience, s.candidate_qualifications, s.candidate_availability,
         c.card, p.total
  from page p
  join public.applications a on a.id = p.id
  -- A closed account (no technician) is absent from the pool projection: listed without an applicant.
  left join shown s on s.application_id = p.id and s.req_id = p.requirement_id
  join app_private.requirement_cards c on c.id = p.requirement_id
  order by p.created_at desc, p.id;
end;
$$;

create function public.get_requirement_application_counts(p_organization_id uuid)
returns table (
  requirement_id uuid,
  headcount integer,
  starts_at timestamptz,
  ends_at timestamptz,
  shift_count integer,
  counts jsonb
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
  select wr.id, wr.headcount, wr.starts_at, wr.ends_at,
         case when wr.shifts is null then null else jsonb_array_length(wr.shifts) end,
         jsonb_object_agg(s.status::text, s.total)
  from public.work_requirements wr
  cross join lateral (
    select a.status, count(*)::integer as total
    from public.applications a
    where a.requirement_id = wr.id
    group by a.status
  ) s
  where wr.organization_id = p_organization_id
  group by wr.id, wr.headcount, wr.starts_at, wr.ends_at, wr.shifts
  order by wr.id;
end;
$$;

revoke execute on function
  public.get_organization_applications(uuid, uuid, public.application_status, integer, integer),
  public.get_requirement_application_counts(uuid)
from public, anon;
grant execute on function
  public.get_organization_applications(uuid, uuid, public.application_status, integer, integer),
  public.get_requirement_application_counts(uuid)
to authenticated;
