-- Crew Flex — LOCAL seed. 100 % synthetic data (NATO-alphabet names, *.crewflex.test emails).
-- Never run against production. Password for every seed user (local only): crewflex-local-only
--
-- Scenario = the product example (docs/product/PRODUCT.md):
--   MAD · 18–21 OCT 2026 · NIGHT · 2 × B1.1 + TR-A320, EWIS + HF + FTS hard, SMS soft
--   internal: Alpha (eligible), Bravo (FTS expired), Charlie (member, no ratings)
--   external: Delta, Echo, Foxtrot eligible · Golf B1.1 pending · Hotel private · India partial
--             availability · Juliett missing TR-A320
--   → required 2 · internally eligible 1 · gap 1 · external eligible 3

create function pg_temp.seed_user(p_id uuid, p_email text, p_meta jsonb)
returns void
language sql
as $$
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('crewflex-local-only', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, p_meta, now(), now(), '', '', '', ''
  );
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (p_id::text, p_id, jsonb_build_object('sub', p_id::text, 'email', p_email), 'email', now(), now(), now());
$$;

create function pg_temp.seed_qualification(p_tech uuid, p_code text, p_verification text, p_expires date)
returns void
language sql
as $$
  insert into public.technician_qualifications
    (technician_profile_id, qualification_type_id, issued_at, expires_at, verification_status)
  select p_tech, id, date '2020-01-15', p_expires, p_verification::public.verification_status
  from public.qualification_types where code = p_code;
$$;

create function pg_temp.seed_full_set(p_tech uuid)
returns void
language sql
as $$
  select pg_temp.seed_qualification(p_tech, 'B1.1', 'verified', date '2029-06-30');
  select pg_temp.seed_qualification(p_tech, 'TR-A320', 'verified', null);
  select pg_temp.seed_qualification(p_tech, 'EWIS', 'verified', date '2027-03-31');
  select pg_temp.seed_qualification(p_tech, 'HF', 'verified', date '2027-05-31');
  select pg_temp.seed_qualification(p_tech, 'FTS', 'verified', date '2027-04-30');
$$;

-- Organizations are created by the sign-up trigger from metadata.
select pg_temp.seed_user('00000000-0000-4000-8000-000000000001', 'admin.mro@crewflex.test',
  '{"account_type":"organization","display_name":"Admin Demo MRO","organization_name":"Demo MRO Madrid","organization_type":"mro","country":"ES"}');
select pg_temp.seed_user('00000000-0000-4000-8000-000000000002', 'admin.other@crewflex.test',
  '{"account_type":"organization","display_name":"Admin Other Aero","organization_name":"Demo Aero Services Lisbon","organization_type":"mro","country":"PT"}');

select pg_temp.seed_user('00000000-0000-4000-8000-000000000011', 'alpha@crewflex.test', '{"account_type":"professional","display_name":"Technician Alpha"}');
select pg_temp.seed_user('00000000-0000-4000-8000-000000000012', 'bravo@crewflex.test', '{"account_type":"professional","display_name":"Technician Bravo"}');
select pg_temp.seed_user('00000000-0000-4000-8000-000000000013', 'charlie@crewflex.test', '{"account_type":"professional","display_name":"Technician Charlie"}');
select pg_temp.seed_user('00000000-0000-4000-8000-000000000021', 'delta@crewflex.test', '{"account_type":"professional","display_name":"Technician Delta"}');
select pg_temp.seed_user('00000000-0000-4000-8000-000000000022', 'echo@crewflex.test', '{"account_type":"professional","display_name":"Technician Echo"}');
select pg_temp.seed_user('00000000-0000-4000-8000-000000000023', 'foxtrot@crewflex.test', '{"account_type":"professional","display_name":"Technician Foxtrot"}');
select pg_temp.seed_user('00000000-0000-4000-8000-000000000024', 'golf@crewflex.test', '{"account_type":"professional","display_name":"Technician Golf"}');
select pg_temp.seed_user('00000000-0000-4000-8000-000000000025', 'hotel@crewflex.test', '{"account_type":"professional","display_name":"Technician Hotel"}');
select pg_temp.seed_user('00000000-0000-4000-8000-000000000026', 'india@crewflex.test', '{"account_type":"professional","display_name":"Technician India"}');
select pg_temp.seed_user('00000000-0000-4000-8000-000000000027', 'juliett@crewflex.test', '{"account_type":"professional","display_name":"Technician Juliett"}');
select pg_temp.seed_user('00000000-0000-4000-8000-000000000031', 'platform.admin@crewflex.test', '{"account_type":"professional","display_name":"Platform Admin"}');

update public.profiles set platform_role = 'platform_admin' where id = '00000000-0000-4000-8000-000000000031';

-- Internal workforce of Demo MRO Madrid
insert into public.organization_members (organization_id, profile_id, role)
select o.id, m.profile_id::uuid, 'member'
from public.organizations o,
  (values ('00000000-0000-4000-8000-000000000011'), ('00000000-0000-4000-8000-000000000012'),
          ('00000000-0000-4000-8000-000000000013')) as m(profile_id)
where o.name = 'Demo MRO Madrid';

update public.technician_profiles set base_location = 'Madrid (MAD)', years_experience = 9, current_status = 'employed'
where profile_id in ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000013');

update public.technician_profiles set visibility = 'anonymous', current_status = 'contractor', mobility = 'international'
where profile_id in ('00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000023',
                     '00000000-0000-4000-8000-000000000024', '00000000-0000-4000-8000-000000000026');
update public.technician_profiles set visibility = 'open', current_status = 'contractor'
where profile_id in ('00000000-0000-4000-8000-000000000022', '00000000-0000-4000-8000-000000000027');
update public.technician_profiles set base_location = 'Barcelona (BCN)', years_experience = 12 where profile_id = '00000000-0000-4000-8000-000000000021';
update public.technician_profiles set base_location = 'Madrid (MAD)', years_experience = 6 where profile_id = '00000000-0000-4000-8000-000000000022';
update public.technician_profiles set base_location = 'Lisboa (LIS)', years_experience = 15 where profile_id = '00000000-0000-4000-8000-000000000023';
update public.technician_profiles set base_location = 'Madrid (MAD)', years_experience = 4 where profile_id in ('00000000-0000-4000-8000-000000000024', '00000000-0000-4000-8000-000000000025', '00000000-0000-4000-8000-000000000026', '00000000-0000-4000-8000-000000000027');

-- Qualifications
select pg_temp.seed_full_set('00000000-0000-4000-8000-000000000011');
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000012', 'B1.1', 'verified', date '2029-06-30');
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000012', 'TR-A320', 'verified', null);
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000012', 'EWIS', 'verified', date '2027-03-31');
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000012', 'HF', 'verified', date '2027-05-31');
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000012', 'FTS', 'verified', date '2026-09-30');

select pg_temp.seed_full_set(id) from (values
  ('00000000-0000-4000-8000-000000000021'::uuid), ('00000000-0000-4000-8000-000000000022'::uuid),
  ('00000000-0000-4000-8000-000000000023'::uuid), ('00000000-0000-4000-8000-000000000025'::uuid),
  ('00000000-0000-4000-8000-000000000026'::uuid)) as t(id);
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000023', 'SMS', 'verified', date '2027-12-31');
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000022', 'SMS', 'pending', date '2027-12-31');

select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000024', 'B1.1', 'pending', date '2029-06-30');
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000024', 'TR-A320', 'verified', null);
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000024', 'EWIS', 'verified', date '2027-03-31');
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000024', 'HF', 'verified', date '2027-05-31');
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000024', 'FTS', 'verified', date '2027-04-30');

select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000027', 'B1.1', 'verified', date '2029-06-30');
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000027', 'TR-B737', 'verified', null);
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000027', 'EWIS', 'verified', date '2027-03-31');
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000027', 'HF', 'verified', date '2027-05-31');
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000027', 'FTS', 'verified', date '2027-04-30');

-- Availability (whole October for most; India only until 20 Oct)
insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
select id, timestamptz '2026-10-01 00:00Z', timestamptz '2026-11-01 00:00Z', 'available'
from (values
  ('00000000-0000-4000-8000-000000000011'::uuid), ('00000000-0000-4000-8000-000000000012'::uuid),
  ('00000000-0000-4000-8000-000000000013'::uuid), ('00000000-0000-4000-8000-000000000021'::uuid),
  ('00000000-0000-4000-8000-000000000022'::uuid), ('00000000-0000-4000-8000-000000000023'::uuid),
  ('00000000-0000-4000-8000-000000000024'::uuid), ('00000000-0000-4000-8000-000000000025'::uuid),
  ('00000000-0000-4000-8000-000000000027'::uuid)) as t(id);
insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status) values
  ('00000000-0000-4000-8000-000000000026', '2026-10-01 00:00Z', '2026-10-20 12:00Z', 'available');

-- Requirements
insert into public.work_requirements
  (organization_id, title, location, starts_at, ends_at, shift, headcount, urgency, status, created_by)
select id, 'B1.1 · A320 line maintenance reinforcement', 'Madrid (MAD)',
  '2026-10-18 20:00Z', '2026-10-22 06:00Z', 'night', 2, 'urgent', 'open',
  '00000000-0000-4000-8000-000000000001'
from public.organizations where name = 'Demo MRO Madrid';

insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
select wr.id, qt.id, case when qt.code = 'SMS' then 'soft' else 'hard' end::public.requirement_level
from public.work_requirements wr
cross join public.qualification_types qt
where wr.title = 'B1.1 · A320 line maintenance reinforcement'
  and qt.code in ('B1.1', 'TR-A320', 'EWIS', 'HF', 'FTS', 'SMS');

insert into public.work_requirements
  (organization_id, title, location, starts_at, ends_at, shift, headcount, urgency, status, created_by)
select id, 'B2 · A330 avionics check support', 'Lisboa (LIS)',
  '2026-11-02 07:00Z', '2026-11-06 19:00Z', 'day', 1, 'planned', 'open',
  '00000000-0000-4000-8000-000000000002'
from public.organizations where name = 'Demo Aero Services Lisbon';

insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
select wr.id, qt.id, 'hard'
from public.work_requirements wr
cross join public.qualification_types qt
where wr.title = 'B2 · A330 avionics check support' and qt.code in ('B2', 'TR-A330');

-- =============================================================================================
-- Local-dev extension (2026-10-10): more explainable cases. Same conventions, same password.
--   Demo MRO Madrid        +14 Ops Manager (role manager, no ratings)
--                          cancelled requirement 'CAT-A · line support (cancelled)'
--   Demo Aero Services LIS +42 Lima (internal B2 + TR-A330 → covers the LIS need: gap 0)
--   Demo Airline Ops BCN   new organization (airline) · admin 03 · AOG need B1.1 + TR-B737
--   External network       41 Kilo    full set, UNAVAILABLE 19–21 Oct      → PARTIAL_AVAILABILITY
--                          43 Mike    B2 expires 2026-11-04 (LIS 2–6 Nov)  → EXPIRES_DURING
--                          44 Nov.    B2 + TR-A350, no TR-A330, open       → MISSING_HARD
--                          45 Oscar   B1.1 REJECTED                        → NOT_VERIFIED
--                          46 Papa    B1.1 WITHDRAWN                       → treated as missing
--                          47 Quebec  B1.1 + TR-B737, open, NO windows     → NOT_AVAILABLE (BCN)
-- =============================================================================================

select pg_temp.seed_user('00000000-0000-4000-8000-000000000003', 'admin.airline@crewflex.test',
  '{"account_type":"organization","display_name":"Admin Demo Airline","organization_name":"Demo Airline Ops Barcelona","organization_type":"airline","country":"ES"}');
select pg_temp.seed_user('00000000-0000-4000-8000-000000000014', 'manager.mro@crewflex.test', '{"account_type":"professional","display_name":"Ops Manager Demo MRO"}');
select pg_temp.seed_user('00000000-0000-4000-8000-000000000041', 'kilo@crewflex.test', '{"account_type":"professional","display_name":"Technician Kilo"}');
select pg_temp.seed_user('00000000-0000-4000-8000-000000000042', 'lima@crewflex.test', '{"account_type":"professional","display_name":"Technician Lima"}');
select pg_temp.seed_user('00000000-0000-4000-8000-000000000043', 'mike@crewflex.test', '{"account_type":"professional","display_name":"Technician Mike"}');
select pg_temp.seed_user('00000000-0000-4000-8000-000000000044', 'november@crewflex.test', '{"account_type":"professional","display_name":"Technician November"}');
select pg_temp.seed_user('00000000-0000-4000-8000-000000000045', 'oscar@crewflex.test', '{"account_type":"professional","display_name":"Technician Oscar"}');
select pg_temp.seed_user('00000000-0000-4000-8000-000000000046', 'papa@crewflex.test', '{"account_type":"professional","display_name":"Technician Papa"}');
select pg_temp.seed_user('00000000-0000-4000-8000-000000000047', 'quebec@crewflex.test', '{"account_type":"professional","display_name":"Technician Quebec"}');

-- Roles: a manager (not admin) inside Demo MRO Madrid; Lima is internal workforce of the Lisbon MRO
insert into public.organization_members (organization_id, profile_id, role)
select id, '00000000-0000-4000-8000-000000000014', 'manager' from public.organizations where name = 'Demo MRO Madrid';
insert into public.organization_members (organization_id, profile_id, role)
select id, '00000000-0000-4000-8000-000000000042', 'member' from public.organizations where name = 'Demo Aero Services Lisbon';

update public.technician_profiles set base_location = 'Madrid (MAD)', years_experience = 14, current_status = 'employed'
where profile_id = '00000000-0000-4000-8000-000000000014';
update public.technician_profiles set base_location = 'Lisboa (LIS)', years_experience = 8, current_status = 'employed'
where profile_id = '00000000-0000-4000-8000-000000000042';
update public.technician_profiles set visibility = 'anonymous', current_status = 'contractor', mobility = 'international'
where profile_id in ('00000000-0000-4000-8000-000000000041', '00000000-0000-4000-8000-000000000043',
                     '00000000-0000-4000-8000-000000000045', '00000000-0000-4000-8000-000000000046');
update public.technician_profiles set visibility = 'open', current_status = 'between_contracts', mobility = 'national'
where profile_id in ('00000000-0000-4000-8000-000000000044', '00000000-0000-4000-8000-000000000047');
update public.technician_profiles set base_location = 'Sevilla (SVQ)', years_experience = 7 where profile_id = '00000000-0000-4000-8000-000000000041';
update public.technician_profiles set base_location = 'Porto (OPO)', years_experience = 11 where profile_id = '00000000-0000-4000-8000-000000000043';
update public.technician_profiles set base_location = 'Lisboa (LIS)', years_experience = 5 where profile_id = '00000000-0000-4000-8000-000000000044';
update public.technician_profiles set base_location = 'Valencia (VLC)', years_experience = 3 where profile_id = '00000000-0000-4000-8000-000000000045';
update public.technician_profiles set base_location = 'Madrid (MAD)', years_experience = 20 where profile_id = '00000000-0000-4000-8000-000000000046';
update public.technician_profiles set base_location = 'Barcelona (BCN)', years_experience = 10 where profile_id = '00000000-0000-4000-8000-000000000047';

-- Qualifications
select pg_temp.seed_full_set('00000000-0000-4000-8000-000000000041');                       -- Kilo: all valid
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000042', 'B2', 'verified', date '2030-01-31');       -- Lima
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000042', 'TR-A330', 'verified', null);
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000042', 'HF', 'verified', date '2027-05-31');
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000043', 'B2', 'verified', date '2026-11-04');       -- Mike: expires during LIS need
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000043', 'TR-A330', 'verified', null);
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000044', 'B2', 'verified', date '2030-01-31');       -- November: wrong type rating
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000044', 'TR-A350', 'verified', null);
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000045', 'B1.1', 'rejected', date '2029-06-30');     -- Oscar: licence rejected
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000045', 'TR-A320', 'verified', null);
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000045', 'EWIS', 'verified', date '2027-03-31');
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000045', 'HF', 'verified', date '2027-05-31');
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000045', 'FTS', 'verified', date '2027-04-30');
select pg_temp.seed_full_set('00000000-0000-4000-8000-000000000046');                       -- Papa: licence withdrawn
update public.technician_qualifications set status = 'withdrawn'
where technician_profile_id = '00000000-0000-4000-8000-000000000046'
  and qualification_type_id = (select id from public.qualification_types where code = 'B1.1');
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000047', 'B1.1', 'verified', date '2029-06-30');     -- Quebec: B737, no availability
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000047', 'TR-B737', 'verified', null);
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000047', 'EWIS', 'verified', date '2027-03-31');
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000047', 'HF', 'verified', date '2027-05-31');
select pg_temp.seed_qualification('00000000-0000-4000-8000-000000000047', 'FTS', 'verified', date '2027-04-30');

-- Availability. Kilo: available all October but UNAVAILABLE 19–21 Oct (override, BR-4.2) → partial for MAD.
insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status) values
  ('00000000-0000-4000-8000-000000000041', '2026-10-01 00:00Z', '2026-11-01 00:00Z', 'available'),
  ('00000000-0000-4000-8000-000000000041', '2026-10-19 00:00Z', '2026-10-21 00:00Z', 'unavailable'),
  ('00000000-0000-4000-8000-000000000042', '2026-11-01 00:00Z', '2026-12-01 00:00Z', 'available'),
  ('00000000-0000-4000-8000-000000000043', '2026-11-01 00:00Z', '2026-12-01 00:00Z', 'available'),
  ('00000000-0000-4000-8000-000000000044', '2026-11-01 00:00Z', '2026-12-01 00:00Z', 'available'),
  ('00000000-0000-4000-8000-000000000045', '2026-10-01 00:00Z', '2026-11-01 00:00Z', 'available'),
  ('00000000-0000-4000-8000-000000000046', '2026-10-01 00:00Z', '2026-11-01 00:00Z', 'available');
-- Quebec: no windows at all → NOT_AVAILABLE.

-- Requirements
insert into public.work_requirements
  (organization_id, title, location, starts_at, ends_at, shift, headcount, urgency, status, created_by)
select id, 'B1.1 · B737 AOG recovery', 'Barcelona (BCN)',
  '2026-10-25 06:00Z', '2026-10-26 18:00Z', 'flexible', 1, 'aog', 'open',
  '00000000-0000-4000-8000-000000000003'
from public.organizations where name = 'Demo Airline Ops Barcelona';

insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
select wr.id, qt.id, case when qt.code = 'HF' then 'soft' else 'hard' end::public.requirement_level
from public.work_requirements wr
cross join public.qualification_types qt
where wr.title = 'B1.1 · B737 AOG recovery' and qt.code in ('B1.1', 'TR-B737', 'HF');

insert into public.work_requirements
  (organization_id, title, location, starts_at, ends_at, shift, headcount, urgency, status, created_by)
select id, 'CAT-A · line support (cancelled)', 'Madrid (MAD)',
  '2026-09-01 06:00Z', '2026-09-05 18:00Z', 'day', 1, 'planned', 'cancelled',
  '00000000-0000-4000-8000-000000000001'
from public.organizations where name = 'Demo MRO Madrid';

insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
select wr.id, qt.id, 'hard'
from public.work_requirements wr
cross join public.qualification_types qt
where wr.title = 'CAT-A · line support (cancelled)' and qt.code = 'CAT-A';
