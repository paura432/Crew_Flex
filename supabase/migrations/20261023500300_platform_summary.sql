-- Crew Flex — platform figures for `/app/admin` (v2 diff 10 #15 = ADM-02 #6-#11, #13; default v1.8
-- connected `server/connected.mjs` operationsSummary / `Operations.jsx` «Tu plataforma, en cifras.»;
-- T-53). Counts only: no money (commissions, plans and invoices are SCOPE OUT), no names, no ids.
-- NON-DESTRUCTIVE: one SECURITY DEFINER function and its EXECUTE grant.
--
-- Definitions (v1.8 → this model):
--   technicians          professional accounts (`profiles.account_type`), like v1.8's technician users
--   organizations        organizations (v1.8 counted company + recruiter users; here the organization)
--   active_requirements  `open` or `covered` and not ended — v1.8 «published && end > now»: a covered
--                        need is still published there; paused, draft, closed and cancelled do not count
--   working_now          distinct professionals with a `confirmed` application whose period contains now()
--   aog_with_vacancies   active, `urgency = 'aog'`, headcount − confirmed > 0 — including the ones
--                        already started (v1.8 dropped them by accident, C §4-3)
--   demand               seats still to fill (headcount − confirmed) of active needs, grouped by each
--                        hard LICENSE code of the need (null = no licence required); one need can count in
--                        several codes. v1.8 counted «plazas-jornada»; there is one period per need here (Q6)
-- The caller must be a platform admin (checked in the body; 42501 otherwise).

create function public.get_platform_summary()
returns table (
  technicians integer,
  organizations integer,
  active_requirements integer,
  working_now integer,
  aog_with_vacancies integer,
  demand jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.is_platform_admin() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  return query
  with active as (
    select wr.id, wr.urgency,
           greatest(wr.headcount - (select count(*) from public.applications a
                                    where a.requirement_id = wr.id and a.status = 'confirmed'),
                    0)::integer as vacancies
    from public.work_requirements wr
    where wr.status in ('open', 'covered') and wr.ends_at > now()
  ),
  demand_rows as (
    select l.code, sum(ac.vacancies)::integer as seats
    from active ac
    left join lateral (
      select qt.code
      from public.work_requirement_qualifications wrq
      join public.qualification_types qt on qt.id = wrq.qualification_type_id
      where wrq.work_requirement_id = ac.id
        and wrq.requirement_level = 'hard'
        and qt.category = 'LICENSE'
    ) l on true
    where ac.vacancies > 0
    group by l.code
  )
  select
    (select count(*)::integer from public.profiles p where p.account_type = 'professional'),
    (select count(*)::integer from public.organizations),
    (select count(*)::integer from active),
    (select count(distinct a.technician_profile_id)::integer
     from public.applications a
     join public.work_requirements wr on wr.id = a.requirement_id
     where a.status = 'confirmed' and wr.starts_at <= now() and wr.ends_at > now()),
    (select count(*)::integer from active ac where ac.urgency = 'aog' and ac.vacancies > 0),
    coalesce((select jsonb_agg(jsonb_build_object('code', d.code, 'seats', d.seats)
                               order by d.seats desc, d.code nulls last)
              from demand_rows d), '[]'::jsonb);
end;
$$;

revoke execute on function public.get_platform_summary() from public, anon;
grant execute on function public.get_platform_summary() to authenticated;
