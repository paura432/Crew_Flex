-- Crew Flex — the Candidate Pack copy («Ver expediente», v2 diff v2-15 + v2-04: HIRE-05 #1, #4, #5, #7, #9, #14;
-- MKT-05 #8). LOCAL ONLY. Technical defaults T-110…T-116 (docs/integration/crewflex-v13/08-product-decisions.md),
-- BUSINESS_RULES BR-25.
--
-- v1.8 copies the professional's profile into the application when they apply (connected `server/app.mjs:110`
-- `pack`, demo `business.js` `buildPack`) and shows it as «Candidate Pack» (`Workflow.jsx:17-33`) with «Copia del
-- perfil: {fecha}». Ported here WITHOUT the D-07 fields (P3 open): never the real name, e-mail, phone, current
-- employer, blocked organizations, documents, file names or their metadata (`PACK_ACTIVATION` stays false in
-- src/domain/candidate-pack.ts). And without v1.8's two ✗ (MKT-05 #14, HIRE-05 #17): the copy is NOT a column of
-- the application row, and it does not outlive a withdrawal.
--
-- NON-DESTRUCTIVE: one table (RLS on in this file, no grant to any API role), one private builder, two triggers on
-- public.applications and three read RPCs. No existing function, table, grant or row is changed — in particular
-- apply_to_requirement() and transition_application() (20261022130300) are untouched: the copy is written by an
-- AFTER INSERT trigger in the same transaction as the application, so every path that creates an application
-- (applying, and applying again after `withdrawn`, which inserts a new row) freezes its own copy. No backfill:
-- the applications that exist before this migration were sent without the professional seeing this content
-- (T-113), so they have no copy.
--
-- What the copy holds (T-110, T-111, T-112) — the professional's own data at the moment of applying:
--   technician_profiles   main category, categories, years, English, base (free text + country), aircraft,
--                         engines, capabilities, work permits, general restrictions (text)
--   technician_private_details   the minimum rate and its unit ONLY (never phone or employer)
--   technician_type_ratings      aircraft, licence category, validity, restrictions (text)
--   technician_qualifications    the ACTIVE ones: catalog code, name, category, verification state, expiry
--                                (no review note, reviewer or dates of review)
--   logbook_entries              the entries marked «Seleccionable para expediente» (`cv_relevant`) and not
--                                archived, the newest 20: date, aircraft, ATA, hours, category, environment,
--                                description (no id)
-- The apply panel shows the professional exactly this, from the SAME builder (get_my_candidate_pack_preview),
-- before the consent (T-111: the rate and the restriction texts are owner-only elsewhere, BR-18).
--
-- Who reads it (T-113): only through get_application_pack(), SECURITY DEFINER: the applicant (their own copy) and
-- the admins/managers of the requirement's organization at the moment of reading. Plain members, other
-- organizations, other technicians and platform admins get the same P0002 as a missing id; anon has no EXECUTE.
-- The table itself has no grant (the notices pattern, 20261023800000); the owner-only policy is a second layer.
-- Reads are not audited (T-114): the copy carries no identity, contact or document; access logs for those wait
-- for D-07 P3.
--
-- The professional also reads all their own copies through get_my_application_packs() («Exportar mis datos»,
-- T-43).
--
-- Lifecycle: immutable once written (UPDATE refused); deleted with its application (cascade: requirement or
-- organization deletion), when the application is withdrawn and when the professional's account closes — the
-- application then stays without its technician (20261023400100, T-42) but its copy goes (T-113; rejected,
-- cancelled and finished applications of a live account keep theirs).
-- Consistency: the builder is one STABLE SQL statement, so a copy never mixes two passport saves
-- (save_professional_passport writes all its tables in one transaction). No lock and no race check: there is no
-- cross-row invariant to protect.

create table public.application_packs (
  application_id uuid primary key references public.applications (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary_category text,
  categories text[] not null default '{}',
  years_experience integer,
  english_level text,
  base_location text,
  base_country text,
  aircraft text[] not null default '{}',
  engines text[] not null default '{}',
  skills text[] not null default '{}',
  work_permits text[] not null default '{}',
  general_restrictions text,
  min_rate numeric(10, 2),
  rate_unit text check (rate_unit is null or rate_unit in ('hour', 'day')),
  type_ratings jsonb not null default '[]' check (jsonb_typeof(type_ratings) = 'array'),
  qualifications jsonb not null default '[]' check (jsonb_typeof(qualifications) = 'array'),
  experience jsonb not null default '[]'
    check (jsonb_typeof(experience) = 'array' and jsonb_array_length(experience) <= 20),
  constraint application_packs_rate_unit check ((min_rate is null) = (rate_unit is null))
);
alter table public.application_packs enable row level security;
comment on table public.application_packs is
  'Candidate Pack copy frozen when the application was created (v2-15). No API grant: get_application_pack() only.';

-- Supabase grants ALL to the API roles by default: revoke everything (reads go through the RPC below).
revoke all on table public.application_packs from anon, authenticated;

-- Second layer only (no grant uses it today): the applicant's own copies.
create policy application_packs_select_own on public.application_packs for select to authenticated
  using (exists (
    select 1 from public.applications a
    where a.id = application_packs.application_id
      and a.technician_profile_id = (select auth.uid())));

-- Frozen: nobody rewrites a copy (the owner included). Same refusal as proposals and events (55000).
create trigger application_packs_immutable before update on public.application_packs
  for each row execute function public.refuse_application_history_update();

-- ---------------------------------------------------------------------------------------------
-- The builder: what a copy of `p_profile_id` contains NOW. One statement (consistent snapshot). Private: no
-- grant; called as their owner by the trigger and the preview below. The jsonb keys are the API's (camelCase).
-- ---------------------------------------------------------------------------------------------
create function app_private.candidate_pack_content(p_profile_id uuid)
returns table (
  primary_category text,
  categories text[],
  years_experience integer,
  english_level text,
  base_location text,
  base_country text,
  aircraft text[],
  engines text[],
  skills text[],
  work_permits text[],
  general_restrictions text,
  min_rate numeric,
  rate_unit text,
  type_ratings jsonb,
  qualifications jsonb,
  experience jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    tp.primary_category, tp.categories, tp.years_experience, tp.english_level,
    tp.base_location, tp.base_country, tp.aircraft, tp.engines, tp.skills,
    tp.work_permits, tp.general_restrictions,
    d.min_rate,
    case when d.min_rate is not null then d.rate_unit end,
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'aircraft', r.aircraft,
               'category', r.category,
               'expiresAt', r.expires_at,
               'restrictions', r.restrictions
             ) order by r.aircraft, r.category)
      from public.technician_type_ratings r
      where r.technician_profile_id = tp.profile_id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'code', qt.code,
               'name', qt.name,
               'category', qt.category,
               'verificationStatus', tq.verification_status,
               'expiresAt', tq.expires_at
             ) order by qt.category, qt.code)
      from public.technician_qualifications tq
      join public.qualification_types qt on qt.id = tq.qualification_type_id
      where tq.technician_profile_id = tp.profile_id
        and tq.status = 'active'
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'date', e.entry_date,
               'aircraft', e.aircraft,
               'ata', e.ata,
               'hours', e.hours,
               'category', e.category,
               'environment', e.environment,
               'description', e.description
             ) order by e.entry_date desc, e.created_at desc, e.id)
      from (
        select l.* from public.logbook_entries l
        where l.technician_profile_id = tp.profile_id
          and l.cv_relevant
          and not l.archived
        order by l.entry_date desc, l.created_at desc, l.id
        limit 20
      ) e
    ), '[]'::jsonb)
  from public.technician_profiles tp
  left join public.technician_private_details d on d.profile_id = tp.profile_id
  where tp.profile_id = p_profile_id;
$$;
revoke execute on function app_private.candidate_pack_content(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Triggers on public.applications.
-- ---------------------------------------------------------------------------------------------

-- Freeze the copy of a NEW application, in its transaction. Only when the professional applied themself (the
-- JWT subject is the applicant) or the owner wrote the row (no JWT: seed, maintenance): an application created by
-- anyone else would carry a copy the professional never saw (T-111). Today apply_to_requirement() is the only
-- API path and its caller is always the applicant.
create function public.freeze_application_pack()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is not null and v_uid is distinct from new.technician_profile_id then
    return null;
  end if;
  insert into public.application_packs (
    application_id, primary_category, categories, years_experience, english_level, base_location,
    base_country, aircraft, engines, skills, work_permits, general_restrictions, min_rate, rate_unit,
    type_ratings, qualifications, experience)
  select
    new.id, c.primary_category, c.categories, c.years_experience, c.english_level, c.base_location,
    c.base_country, c.aircraft, c.engines, c.skills, c.work_permits, c.general_restrictions, c.min_rate,
    c.rate_unit, c.type_ratings, c.qualifications, c.experience
  from app_private.candidate_pack_content(new.technician_profile_id) c;
  return null;
end;
$$;
create trigger applications_freeze_pack
  after insert on public.applications
  for each row execute function public.freeze_application_pack();

-- The copy goes when the sharing ends (T-113):
--   * withdrawing (v1.8 kept it, ✗ MKT-05 #14 / HIRE-05 #17) — re-applying later inserts a new application,
--     hence a new copy of that day's data; closing the account withdraws the applications in progress
--     (20261023400100), so their copies go through this same path;
--   * the professional's account closes (T-42, BR-19): the applications that stay (rejected, cancelled,
--     finished) lose their technician (FK SET NULL, an UPDATE that fires this trigger) and their copy is
--     deleted with it — the organization keeps the application and its history, not the person's dossier.
create function public.drop_application_pack()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.application_packs p where p.application_id = new.id;
  return null;
end;
$$;
create trigger applications_drop_pack
  after update of status, technician_profile_id on public.applications
  for each row
  when ((new.status = 'withdrawn' and old.status is distinct from 'withdrawn')
        or (old.technician_profile_id is not null and new.technician_profile_id is null))
  execute function public.drop_application_pack();

revoke execute on function
  public.freeze_application_pack(),
  public.drop_application_pack()
from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Reads. Fixed column lists (tests/db/pack-view.test.ts asserts them): nothing identifying, no contact, no
-- employer, no blocks, no documents.
-- ---------------------------------------------------------------------------------------------

-- One application's copy, for its two parties. Not a party (or a missing id) → P0002, the same answer
-- (no existence oracle). A party gets zero rows when the application has no copy (withdrawn, or sent before
-- this migration).
create function public.get_application_pack(p_application_id uuid)
returns table (
  application_id uuid,
  copied_at timestamptz,
  primary_category text,
  categories text[],
  years_experience integer,
  english_level text,
  base_location text,
  base_country text,
  aircraft text[],
  engines text[],
  skills text[],
  work_permits text[],
  general_restrictions text,
  min_rate numeric,
  rate_unit text,
  type_ratings jsonb,
  qualifications jsonb,
  experience jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_technician uuid;
  v_organization uuid;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  select a.technician_profile_id, wr.organization_id into v_technician, v_organization
  from public.applications a
  join public.work_requirements wr on wr.id = a.requirement_id
  where a.id = p_application_id;
  -- Null-safe: an application kept after its technician closed the account (technician NULL, 20261023400100)
  -- is readable by the organization side only — and has no copy any more (drop_application_pack).
  if not found
     or not (coalesce(v_technician = v_uid, false)
             or public.has_org_role(v_organization, array['admin', 'manager']::public.organization_role[])) then
    raise exception using errcode = 'P0002', message = 'application not found';
  end if;
  return query
  select p.application_id, p.created_at, p.primary_category, p.categories, p.years_experience,
         p.english_level, p.base_location, p.base_country, p.aircraft, p.engines, p.skills, p.work_permits,
         p.general_restrictions, p.min_rate, p.rate_unit, p.type_ratings, p.qualifications, p.experience
  from public.application_packs p
  where p.application_id = p_application_id;
end;
$$;

-- What a copy of the caller would contain if they applied now (the apply panel's «Qué compartes»). The same
-- builder as the trigger, for auth.uid() only. Professionals only (42501 otherwise).
create function public.get_my_candidate_pack_preview()
returns table (
  copied_at timestamptz,
  primary_category text,
  categories text[],
  years_experience integer,
  english_level text,
  base_location text,
  base_country text,
  aircraft text[],
  engines text[],
  skills text[],
  work_permits text[],
  general_restrictions text,
  min_rate numeric,
  rate_unit text,
  type_ratings jsonb,
  qualifications jsonb,
  experience jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null
     or not exists (select 1 from public.technician_profiles tp where tp.profile_id = v_uid) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  return query
  select now(), c.primary_category, c.categories, c.years_experience, c.english_level, c.base_location,
         c.base_country, c.aircraft, c.engines, c.skills, c.work_permits, c.general_restrictions, c.min_rate,
         c.rate_unit, c.type_ratings, c.qualifications, c.experience
  from app_private.candidate_pack_content(v_uid) c;
end;
$$;

-- Every copy of the caller's own applications, newest first: «Exportar mis datos» (T-43, `account` GET). Own
-- rows only (auth.uid()); an account without applications gets none.
create function public.get_my_application_packs()
returns table (
  application_id uuid,
  copied_at timestamptz,
  primary_category text,
  categories text[],
  years_experience integer,
  english_level text,
  base_location text,
  base_country text,
  aircraft text[],
  engines text[],
  skills text[],
  work_permits text[],
  general_restrictions text,
  min_rate numeric,
  rate_unit text,
  type_ratings jsonb,
  qualifications jsonb,
  experience jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  return query
  select p.application_id, p.created_at, p.primary_category, p.categories, p.years_experience,
         p.english_level, p.base_location, p.base_country, p.aircraft, p.engines, p.skills, p.work_permits,
         p.general_restrictions, p.min_rate, p.rate_unit, p.type_ratings, p.qualifications, p.experience
  from public.application_packs p
  join public.applications a on a.id = p.application_id
  where a.technician_profile_id = v_uid
  order by p.created_at desc, p.application_id;
end;
$$;

revoke execute on function
  public.get_application_pack(uuid),
  public.get_my_candidate_pack_preview(),
  public.get_my_application_packs()
from public, anon;
grant execute on function
  public.get_application_pack(uuid),
  public.get_my_candidate_pack_preview(),
  public.get_my_application_packs()
to authenticated;
