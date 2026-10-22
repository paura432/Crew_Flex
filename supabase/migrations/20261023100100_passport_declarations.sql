-- Crew Flex — v1.8 passport declarations and the professional's private data (package passport:
-- N-01, N-02, N-05, N-06, N-07, N-08; technical defaults T-30…T-35 in
-- docs/integration/crewflex-v13/08-product-decisions.md).
-- NON-DESTRUCTIVE: adds defaulted/nullable columns with CHECKs to technician_profiles and three new
-- tables, RLS enabled in this file, SELECT-only grants. No drop, no data change: existing rows get
-- empty lists and NULLs, which every CHECK accepts.
--
-- Who reads what (docs/architecture/AUTHORIZATION.md):
--   technician_profiles (new columns)  owner · own-organization admin/manager (OD-4) · platform admin —
--                                      the existing row policy, like the qualifications they describe
--   technician_type_ratings            the same readers as technician_qualifications
--   technician_private_details         OWNER ONLY: phone, current employer (D-07: contact is never shared
--   technician_organization_blocks     without the Candidate Pack consents), minimum rate (OD-7)
-- Writes: NONE directly. Every column and table below is written only by
-- public.save_professional_passport (next migration, SECURITY DEFINER), so the passport version
-- (technician_profiles.updated_at, I-3) moves with every change and the private tables have no
-- PostgREST write path. The CHECKs are the backstop for that function and for the seed.
--
-- The value lists repeat src/domain/passport.ts (tests/db/passport.test.ts proves they agree).
-- Plain expressions only (no helper functions in CHECKs): a CHECK runs with the writer's privileges,
-- and the existing column grants still let the owner update the five V0 columns directly.

alter table public.technician_profiles
  add column primary_category text,
  add column categories text[] not null default '{}',
  add column aircraft text[] not null default '{}',
  add column engines text[] not null default '{}',
  add column skills text[] not null default '{}',
  add column english_level text,
  add column own_tools boolean not null default false,
  add column base_country text,
  add column work_permits text[] not null default '{}',
  add column general_restrictions text;

alter table public.technician_profiles
  add constraint technician_profiles_categories_check check (
    categories <@ array['B1.1', 'B1.2', 'B1.3', 'B1.4', 'B2', 'B3', 'CAT-A', 'CAT-C',
                        'MECHANIC', 'SHEET-METAL', 'NDT', 'HELPER']::text[]
    and cardinality(categories) <= 12),
  -- v1.8 connected: the main category is one of the declared ones (never the empty option).
  add constraint technician_profiles_primary_category_check check (
    primary_category is null or primary_category = any (categories)),
  add constraint technician_profiles_aircraft_check check (
    aircraft <@ array['A320 Family', 'B737 NG', 'B737 MAX', 'ATR 72', 'Embraer E-Jets', 'A330', 'A350',
                      'B787', 'EC135/145', 'Cessna 172', 'Piper PA-28', 'Robinson R44']::text[]
    and cardinality(aircraft) <= 12),
  add constraint technician_profiles_engines_check check (
    engines <@ array['CFM56-5B/7B', 'LEAP-1A', 'LEAP-1B', 'PW1100G', 'PW127', 'Trent 700/1000',
                     'GE90']::text[]
    and cardinality(engines) <= 7),
  add constraint technician_profiles_skills_check check (
    skills <@ array['line_maintenance', 'base_maintenance', 'aog_support', 'troubleshooting',
                    'engine_change', 'sheet_metal', 'ndt', 'borescope', 'cabin_systems']::text[]
    and cardinality(skills) <= 9),
  add constraint technician_profiles_english_level_check check (
    english_level is null or english_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  add constraint technician_profiles_base_country_check check (
    base_country is null or base_country = any (array[
      'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT',
      'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']::text[])),
  add constraint technician_profiles_work_permits_check check (
    work_permits <@ array[
      'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT',
      'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']::text[]
    and cardinality(work_permits) <= 27),
  -- NULL = none declared; never an empty or blank string (so «has restrictions» is `is not null`).
  add constraint technician_profiles_general_restrictions_check check (
    general_restrictions is null
    or (char_length(general_restrictions) <= 2000 and btrim(general_restrictions) <> ''));

-- Declared type ratings: aircraft × licence category (v1.8 `ratings`). Declarations, not the verified
-- TYPE_RATING qualifications that matching reads today (BR-2/BR-3).
create table public.technician_type_ratings (
  id uuid primary key default gen_random_uuid(),
  technician_profile_id uuid not null references public.technician_profiles (profile_id) on delete cascade,
  aircraft text not null check (aircraft = any (array[
    'A320 Family', 'B737 NG', 'B737 MAX', 'ATR 72', 'Embraer E-Jets', 'A330', 'A350', 'B787', 'EC135/145',
    'Cessna 172', 'Piper PA-28', 'Robinson R44']::text[])),
  category text not null check (category = any (array[
    'B1.1', 'B1.2', 'B1.3', 'B1.4', 'B2', 'B3', 'CAT-A', 'CAT-C']::text[])),
  expires_at date,
  restrictions text check (
    restrictions is null or (char_length(restrictions) <= 500 and btrim(restrictions) <> '')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (technician_profile_id, aircraft, category)
);
alter table public.technician_type_ratings enable row level security;

-- Owner-only data. One row per professional, created on the first passport save.
create table public.technician_private_details (
  profile_id uuid primary key references public.technician_profiles (profile_id) on delete cascade,
  phone text check (
    phone is null or (char_length(phone) <= 32 and phone ~ '^\+?[0-9][0-9 ().-]{5,30}$')),
  current_employer_id uuid references public.organizations (id) on delete set null,
  -- OD-7 default: a declared minimum, no money moves (T-33).
  min_rate numeric(10, 2) check (min_rate is null or min_rate between 0.01 and 100000),
  rate_unit text not null default 'day' check (rate_unit in ('hour', 'day')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.technician_private_details enable row level security;
create index technician_private_details_employer_idx
  on public.technician_private_details (current_employer_id);

-- Organizations the professional hides from (v1.8 «Organizaciones bloqueadas»). Owner-only: the
-- organization is not told it was blocked (it may still infer it from its own pool — residual risk,
-- SECURITY_PRIVACY T9). Used server-side by the external candidate pool.
create table public.technician_organization_blocks (
  technician_profile_id uuid not null references public.technician_profiles (profile_id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (technician_profile_id, organization_id)
);
alter table public.technician_organization_blocks enable row level security;
create index technician_organization_blocks_org_idx
  on public.technician_organization_blocks (organization_id);

create trigger technician_type_ratings_set_updated_at before update on public.technician_type_ratings
  for each row execute function public.set_updated_at();
create trigger technician_private_details_set_updated_at before update on public.technician_private_details
  for each row execute function public.set_updated_at();

-- Privileges: read-only for signed-in users (RLS decides the rows); anon nothing; no write grant.
revoke all on table
  public.technician_type_ratings,
  public.technician_private_details,
  public.technician_organization_blocks
from anon, authenticated;
grant select on
  public.technician_type_ratings,
  public.technician_private_details,
  public.technician_organization_blocks
to authenticated;

create policy technician_type_ratings_select on public.technician_type_ratings for select to authenticated
  using (
    technician_profile_id = (select auth.uid())
    or public.can_view_member(technician_profile_id)
    or public.is_platform_admin()
  );
create policy technician_private_details_select_own on public.technician_private_details
  for select to authenticated
  using (profile_id = (select auth.uid()));
create policy technician_organization_blocks_select_own on public.technician_organization_blocks
  for select to authenticated
  using (technician_profile_id = (select auth.uid()));
