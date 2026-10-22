-- Crew Flex — published requirements for professionals (M07, owner decision D-12 of 2026-10-22).
-- NON-DESTRUCTIVE: adds one private view, two RPCs and one partial index. No table, column, policy or
-- existing privilege changes; work_requirements / organizations / work_requirement_qualifications stay
-- unreadable to professionals who are not members (S-7: no new direct read path).
--
-- D-12 (ratified for local implementation): every authenticated professional — `private` visibility
-- included — may list and read the requirements that are published and current: status `open` and
-- `ends_at > now()` (draft, paused, covered, closed, legacy cancelled and ended ones are excluded).
-- What they see is ONE fixed projection (`app_private.requirement_cards`): the organization NAME only,
-- never `created_by`, `organization_id`, people's ids or counts of other applicants. Eligibility is
-- computed by the Edge Function with the shared engine on the caller's OWN data
-- (`own_candidate_profile`), so publication never makes anyone eligible and visibility never changes it.
--
-- Why a DEFINER RPC and not a policy: a professional SELECT policy on work_requirements would expose
-- every granted column (`created_by`, `organization_id`, …) and the joins behind it; column grants apply to
-- the whole `authenticated` role. A fixed projection behind a role-checked DEFINER function follows the
-- candidate-pool precedent (foundation_v0, S-7/S-10).

-- The one projection of a requirement that professionals may see (also the proposal terms, M08).
-- `card` is the camelCase JSON the API returns (OpportunityRequirement + status), with ISO UTC instants.
create view app_private.requirement_cards as
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
    'qualifications', q.qualifications
  ) as card
from public.work_requirements wr
join public.organizations o on o.id = wr.organization_id
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

revoke all on app_private.requirement_cards from public, anon, authenticated;

-- Published, current requirements for professional accounts (a technician profile exists for the
-- caller); anything else is 42501. Filters: one id, urgency, a literal text search (title, base or
-- organization name; no LIKE wildcards). Deterministic order (soonest first, then id). `total` counts
-- the matches before the cap.
-- ponytail: at most 200 rows per call (the Edge Function evaluates eligibility in TypeScript on each
-- one); paginate in SQL when the network publishes more than that at once.
create function public.list_opportunities(
  p_id uuid default null,
  p_urgency public.requirement_urgency default null,
  p_q text default null,
  p_limit integer default 200
)
returns table (
  id uuid,
  organization_name text,
  title text,
  location text,
  starts_at timestamptz,
  ends_at timestamptz,
  shift public.shift_type,
  headcount integer,
  urgency public.requirement_urgency,
  created_at timestamptz,
  qualifications jsonb,
  total bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_q text := lower(left(nullif(btrim(coalesce(p_q, '')), ''), 80));
begin
  if not exists (select 1 from public.technician_profiles tp where tp.profile_id = (select auth.uid())) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  return query
  select c.id, c.organization_name, c.title, c.location, c.starts_at, c.ends_at, c.shift, c.headcount,
         c.urgency, c.created_at, c.qualifications, count(*) over ()
  from app_private.requirement_cards c
  where c.status = 'open'
    and c.ends_at > now()
    and (p_id is null or c.id = p_id)
    and (p_urgency is null or c.urgency = p_urgency)
    and (v_q is null
         or strpos(lower(c.title), v_q) > 0
         or strpos(lower(c.location), v_q) > 0
         or strpos(lower(c.organization_name), v_q) > 0)
  order by c.starts_at, c.id
  limit least(greatest(coalesce(p_limit, 200), 1), 200);
end;
$$;

-- The caller's own matchable data, in the column shape of get_requirement_candidate_pool so the
-- shared parser (src/lib/candidate-pool.ts toCandidate) and engine (evaluateMatch) read it: every own
-- qualification, and the own windows overlapping [p_from, p_to) (NULL bound = unbounded).
-- SECURITY INVOKER: own rows under RLS, and the explicit `= auth.uid()` keeps an admin/manager from
-- reading a colleague through this function. No technician profile → no row.
create function public.own_candidate_profile(p_from timestamptz default null, p_to timestamptz default null)
returns table (
  candidate_ref text,
  candidate_pool text,
  candidate_display_name text,
  candidate_base_location text,
  candidate_years_experience integer,
  candidate_qualifications jsonb,
  candidate_availability jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    tp.profile_id::text,
    'internal'::text, -- own profile: named, like an internal candidate
    pr.display_name,
    tp.base_location,
    tp.years_experience,
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'qualificationTypeId', tq.qualification_type_id,
               'code', qt.code,
               'status', tq.status,
               'verificationStatus', tq.verification_status,
               'expiresAt', tq.expires_at
             ) order by qt.code)
      from public.technician_qualifications tq
      join public.qualification_types qt on qt.id = tq.qualification_type_id
      where tq.technician_profile_id = tp.profile_id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'startsAt', aw.starts_at,
               'endsAt', aw.ends_at,
               'status', aw.status
             ) order by aw.starts_at)
      from public.availability_windows aw
      where aw.technician_profile_id = tp.profile_id
        and (p_to is null or aw.starts_at < p_to)
        and (p_from is null or aw.ends_at > p_from)
    ), '[]'::jsonb)
  from public.technician_profiles tp
  join public.profiles pr on pr.id = tp.profile_id
  where tp.profile_id = (select auth.uid());
$$;

-- The opportunities list reads open requirements by start date.
create index work_requirements_open_starts_idx on public.work_requirements (starts_at, id)
  where status = 'open';

revoke execute on function
  public.list_opportunities(uuid, public.requirement_urgency, text, integer),
  public.own_candidate_profile(timestamptz, timestamptz)
from public, anon;
grant execute on function
  public.list_opportunities(uuid, public.requirement_urgency, text, integer),
  public.own_candidate_profile(timestamptz, timestamptz)
to authenticated;
