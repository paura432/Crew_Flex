-- Crew Flex — Training («Formación», CrewFlex v1.9; ADR-003; V19-008…037; batch V19-01 «Foundation»).
-- LOCAL ONLY until the owner authorises a release (feature flag `training`, OFF in production).
-- Part 1 of 4: schema. 20261029100200 = write RPCs · 20261029100300 = reads and the private export ·
-- 20261029100400 = notices, the employment ↔ training overlap in transition_application and the
-- account-closure guard.
--
-- NON-DESTRUCTIVE: new enums, nine tables (RLS on in this migration, SELECT policies only, no write
-- grant), one private transition table, private helpers and triggers; `create or replace` of
-- `is_feature_enabled` (same signature; whitelist + `training`); the idempotency operation CHECK is
-- extended from its current definition (as 20261023200000). No table, column, policy, grant or row of
-- the employment model changes.
--
-- Decisions (ADR-003): the provider is an existing organization (`training_providers` 1:1 with
-- `organizations`, managed by its admin/manager members, reviewed by platform admins who never review
-- their own organization); money is bigint cents + currency + price unit (no float, no payment); live
-- sessions are `tstzrange`s with one IANA zone per edition; offers are immutable versioned snapshots
-- (R-08) and the history is append-only; every write goes through SECURITY DEFINER RPCs (actor =
-- auth.uid(), transition table in app_private mirrored by src/domain/training.ts, optimistic
-- `p_expected_updated_at` at ms precision, idempotency keys). Nothing here writes qualifications,
-- documents, badges, Candidate Pack, logbook, commissions or invoices (V19-034).
--
-- Who reads what (RLS, second layer behind the RPCs):
--   * providers: everyone signed in reads a `reviewed` provider (the catalog needs its name); the
--     organization's admin/manager and platform admins read it in any state. `review_note` is never
--     granted directly (column grant): the RPCs return it to the owner and to admins only;
--   * courses, editions, sessions: published ones (course published + provider reviewed; edition
--     published) to everyone signed in; any state to the organization's admin/manager and platform admins;
--   * favourites: the owner;
--   * requests, offers, events: the professional, the provider's admin/manager and platform admins
--     (support, read-only; NEEDS_DECISION N-6: admins read requests, NOT messages);
--   * messages: the two participants only — never platform admins (N-6), never other members.
-- Lock order (deadlock-free, after 20261022130300): edition row → request row → professional advisory
-- lock (`availability:<uuid>`, the key employment confirmations and availability writes already take).

-- ---------------------------------------------------------------------------------------------
-- 0. Enums (v1.9 `trainingModel.js`: FAMILIES, MODES, PRICE_UNITS; `training.mjs`: statuses)
-- ---------------------------------------------------------------------------------------------
create type public.training_provider_status as enum ('pending', 'reviewed', 'rejected', 'suspended');
create type public.training_listing_status as enum (
  'draft', 'submitted', 'published', 'changes', 'rejected', 'suspended', 'cancelled'
);
create type public.training_family as enum (
  'type', 'engines', 'safety', 'specialties', 'systems', 'quality', 'language', 'basic', 'other'
);
create type public.training_scope as enum ('general', 'part147', 'direct');
create type public.training_mode as enum ('onsite', 'live', 'mixed', 'selfpaced');
create type public.training_price_unit as enum ('person', 'engine', 'module', 'quote');
create type public.training_session_element as enum ('theory', 'practical', 'assessment');
create type public.training_request_kind as enum ('inquiry', 'seat');
create type public.training_request_status as enum (
  'received', 'waitlisted', 'offered', 'accepted', 'confirmed', 'finished',
  'withdrawn', 'rejected', 'cancelled', 'closed'
);
create type public.training_outcome as enum ('completed', 'attended', 'no_show');

-- ---------------------------------------------------------------------------------------------
-- 1. Accent-insensitive search (v1.9 `courseMatches`: NFD + strip marks). The `unaccent` extension is
--    shipped by the Supabase image but NOT by the PGlite harness the RLS suite runs on (tests/db,
--    `new PGlite()` loads no contrib), and a migration must run identically in both. `translate()`
--    over the Latin-1 letters the catalog uses is immutable, extension-free and enough for the
--    Spanish/English/Portuguese/French text v1.9 searched; a stored generated column keeps the
--    catalog query a plain `like` over an indexable column.
-- ---------------------------------------------------------------------------------------------
create function app_private.fold_text(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(translate(coalesce(p_text, ''),
    'ÁÀÄÂÃÅÉÈËÊÍÌÏÎÓÒÖÔÕØÚÙÜÛÇÑÝáàäâãåéèëêíìïîóòöôõøúùüûçñýÿ',
    'AAAAAAEEEEIIIIOOOOOOUUUUCNYaaaaaaeeeeiiiioooooouuuucnyy'));
$$;
revoke execute on function app_private.fold_text(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------------------------

-- The provider profile of an organization (V19-008/009). `status` is the admin's decision; the
-- organization saves it again to resubmit (→ pending, v1.9 `provider.save`).
create table public.training_providers (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 200),
  description text not null check (char_length(description) between 1 and 4000),
  website text check (website is null or (char_length(website) <= 500 and website ~* '^https://')),
  status public.training_provider_status not null default 'pending',
  review_note text check (review_note is null or char_length(review_note) between 1 and 2000),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.training_providers enable row level security;
create trigger training_providers_set_updated_at before update on public.training_providers
  for each row execute function public.set_updated_at();

-- A course (V19-010/011). Part-147 / direct-approval scopes are the provider's declaration and need a
-- reference (NEEDS_DECISION N-7). `search_text` = the folded catalog text.
create table public.training_courses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.training_providers (organization_id) on delete cascade,
  title text not null check (char_length(title) between 1 and 180),
  family public.training_family not null,
  description text not null check (char_length(description) between 1 and 6000),
  aircraft text check (aircraft is null or char_length(aircraft) between 1 and 160),
  engine text check (engine is null or char_length(engine) between 1 and 160),
  category text check (category is null or char_length(category) between 1 and 160),
  language text not null check (char_length(language) between 1 and 100),
  prerequisites text check (prerequisites is null or char_length(prerequisites) between 1 and 3000),
  syllabus text check (syllabus is null or char_length(syllabus) between 1 and 5000),
  certificate_info text not null check (char_length(certificate_info) between 1 and 2000),
  issuer text not null check (char_length(issuer) between 1 and 200),
  scope public.training_scope not null default 'general',
  approval_ref text check (approval_ref is null or char_length(approval_ref) between 1 and 300),
  status public.training_listing_status not null default 'draft',
  review_note text check (review_note is null or char_length(review_note) between 1 and 2000),
  reviewed_at timestamptz,
  search_text text generated always as (app_private.fold_text(
    title || ' ' || description || ' ' || coalesce(aircraft, '') || ' ' || coalesce(engine, '') || ' '
    || coalesce(category, '') || ' ' || language)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_courses_scope_reference check (scope = 'general' or approval_ref is not null),
  constraint training_courses_status check (status <> 'cancelled')
);
alter table public.training_courses enable row level security;
create index training_courses_org_idx on public.training_courses (organization_id, status);
create index training_courses_published_idx on public.training_courses (family, status) where status = 'published';
create trigger training_courses_set_updated_at before update on public.training_courses
  for each row execute function public.set_updated_at();

-- An edition / convocatoria (V19-012…017). `organization_id` repeats the course's (set by the RPC,
-- kept by a trigger) so RLS and the seat lock never join. Prices are cents; `quote` has no price.
-- Provisional dates admit inquiries only; self-paced editions have a deadline and no live session.
create table public.training_editions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.training_courses (id) on delete cascade,
  organization_id uuid not null references public.training_providers (organization_id) on delete cascade,
  mode public.training_mode not null,
  provisional boolean not null default false,
  deadline timestamptz,
  capacity integer not null check (capacity between 1 and 500),
  city text check (city is null or char_length(city) between 1 and 180),
  country text check (country is null or char_length(country) between 1 and 100),
  currency text not null default 'EUR' check (currency in ('EUR', 'GBP', 'CHF', 'USD')),
  price_unit public.training_price_unit not null,
  price_cents bigint check (price_cents is null or price_cents between 0 and 10000000),
  price_includes text not null check (char_length(price_includes) between 1 and 2000),
  policy text not null check (char_length(policy) between 1 and 3000),
  time_zone text not null check (char_length(time_zone) between 1 and 64),
  status public.training_listing_status not null default 'draft',
  review_note text check (review_note is null or char_length(review_note) between 1 and 2000),
  reviewed_at timestamptz,
  cancel_reason text check (cancel_reason is null or char_length(cancel_reason) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_editions_price_by_unit check ((price_unit = 'quote') = (price_cents is null)),
  constraint training_editions_selfpaced_deadline
    check (mode <> 'selfpaced' or provisional or deadline is not null),
  constraint training_editions_cancel_reason check ((status = 'cancelled') = (cancel_reason is not null))
);
alter table public.training_editions enable row level security;
create index training_editions_course_idx on public.training_editions (course_id, status);
create index training_editions_org_idx on public.training_editions (organization_id, status);
create trigger training_editions_set_updated_at before update on public.training_editions
  for each row execute function public.set_updated_at();

-- A live session: a half-open instant range of at most 24 h (v1.9 «Divide la formación en sesiones de
-- hasta 24 horas»). No overlap within an edition (trigger below; the RPC replaces the set under the
-- edition lock). Shown in the edition's zone; stored as instants.
create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.training_editions (id) on delete cascade,
  span tstzrange not null,
  location text check (location is null or char_length(location) between 1 and 200),
  element public.training_session_element not null default 'theory',
  created_at timestamptz not null default now(),
  constraint training_sessions_span check (
    not isempty(span) and lower_inc(span) and not upper_inc(span)
    and lower(span) is not null and upper(span) is not null
    and upper(span) - lower(span) <= interval '24 hours')
);
alter table public.training_sessions enable row level security;
create index training_sessions_edition_idx on public.training_sessions (edition_id, span);

-- «Guardar curso» (V19-018): the professional's own list.
create table public.training_favorites (
  profile_id uuid not null references public.technician_profiles (profile_id) on delete cascade,
  course_id uuid not null references public.training_courses (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, course_id)
);
alter table public.training_favorites enable row level security;
create index training_favorites_course_idx on public.training_favorites (course_id);

-- An inquiry or a seat request (V19-019…026). `organization_id` = the provider (denormalised, set by
-- the RPC). No e-mail column and no share flag: the provider sees the display name and the note only
-- (NEEDS_DECISION N-5 default: never shared). Wallet and Candidate Pack are never attached (V19-033).
create table public.training_requests (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.training_courses (id) on delete cascade,
  edition_id uuid references public.training_editions (id) on delete cascade,
  organization_id uuid not null references public.training_providers (organization_id) on delete cascade,
  -- NEEDS_DECISION N-3 default: a closed account takes its requests with it (as its applications'
  -- Candidate Pack copies do; the provider keeps nothing of a person who left).
  professional_id uuid not null references public.technician_profiles (profile_id) on delete cascade,
  kind public.training_request_kind not null,
  status public.training_request_status not null default 'received',
  applicant_name text not null check (char_length(applicant_name) between 1 and 180),
  note text check (note is null or char_length(note) between 1 and 3000),
  units integer not null default 1 check (units between 1 and 50),
  current_offer_id uuid,
  accepted_offer_id uuid,
  reason text check (reason is null or char_length(reason) between 1 and 2000),
  outcome public.training_outcome,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_requests_seat_edition check (kind = 'inquiry' or edition_id is not null),
  constraint training_requests_reason check ((status in ('rejected', 'cancelled')) = (reason is not null)),
  constraint training_requests_outcome check ((status = 'finished') = (outcome is not null)),
  constraint training_requests_offer_when_offered
    check (status not in ('offered', 'accepted', 'confirmed', 'finished') or current_offer_id is not null),
  constraint training_requests_accepted_offer
    check (status not in ('accepted', 'confirmed', 'finished') or accepted_offer_id is not null)
);
alter table public.training_requests enable row level security;
-- One active request per edition × professional (v1.9 `training_active_seat`, extended to inquiries
-- about an edition). The RPC checks first (CFT03); this is the backstop under concurrency.
create unique index training_requests_one_active
  on public.training_requests (professional_id, edition_id)
  where edition_id is not null
    and status in ('received', 'waitlisted', 'offered', 'accepted', 'confirmed');
create index training_requests_edition_status_idx on public.training_requests (edition_id, status);
create index training_requests_org_idx on public.training_requests (organization_id, created_at desc);
create index training_requests_professional_idx on public.training_requests (professional_id, created_at desc);
create trigger training_requests_set_updated_at before update on public.training_requests
  for each row execute function public.set_updated_at();

-- Offer version n of a request: the frozen terms the professional accepts (R-08). Immutable.
-- `course_updated_at` / `edition_updated_at` are the versions it was built from: confirming refuses
-- when either changed since (v1.9 «Han cambiado las condiciones: vuelve a enviarlas»).
create table public.training_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.training_requests (id) on delete cascade,
  version integer not null check (version >= 1),
  terms jsonb not null check (jsonb_typeof(terms) = 'object'),
  total_cents bigint check (total_cents is null or total_cents between 0 and 500000000),
  currency text not null check (currency in ('EUR', 'GBP', 'CHF', 'USD')),
  course_updated_at timestamptz not null,
  edition_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (request_id, version),
  unique (request_id, id)
);
alter table public.training_offers enable row level security;

alter table public.training_requests
  add constraint training_requests_current_offer_fk foreign key (id, current_offer_id)
    references public.training_offers (request_id, id) deferrable initially deferred,
  add constraint training_requests_accepted_offer_fk foreign key (id, accepted_offer_id)
    references public.training_offers (request_id, id) deferrable initially deferred;

-- The timeline both parties read. `system` = an edition cancellation cancelling its requests.
create table public.training_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.training_requests (id) on delete cascade,
  seq integer not null check (seq >= 1),
  from_status public.training_request_status,
  to_status public.training_request_status not null,
  actor text not null check (actor in ('professional', 'provider', 'system')),
  offer_id uuid,
  created_at timestamptz not null default now(),
  unique (request_id, seq),
  foreign key (request_id, offer_id) references public.training_offers (request_id, id) on delete cascade
);
alter table public.training_request_events enable row level security;
create index training_request_events_request_idx on public.training_request_events (request_id, seq);

-- The private conversation of one request (V19-027). Sender = a profile id (the professional or a
-- provider member); readers are the participants only. Immutable.
create table public.training_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.training_requests (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  sender_side text not null check (sender_side in ('professional', 'provider')),
  body text not null check (char_length(body) between 1 and 3000),
  created_at timestamptz not null default now()
);
alter table public.training_messages enable row level security;
create index training_messages_request_idx on public.training_messages (request_id, created_at);

-- ---------------------------------------------------------------------------------------------
-- 3. Row triggers: immutability, IANA zone, edition ↔ course consistency, session overlap
-- ---------------------------------------------------------------------------------------------
-- UPDATE only (as application_proposals / application_events): no API role may DELETE, and the
-- account-closure cascade (N-3) must still take a request's offers and events with it.
create trigger training_offers_immutable before update on public.training_offers
  for each row execute function public.refuse_application_history_update();
create trigger training_request_events_immutable before update on public.training_request_events
  for each row execute function public.refuse_application_history_update();
create trigger training_messages_immutable before update on public.training_messages
  for each row execute function public.refuse_application_history_update();

-- The zone must be one Postgres knows (pg_timezone_names: IANA names and the abbreviations the server
-- accepts), so `at time zone` never fails at read time (22023, like the other value checks).
create function public.guard_training_edition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = new.time_zone) then
    raise exception using errcode = '22023', message = 'unknown time zone';
  end if;
  if new.organization_id is distinct from
     (select c.organization_id from public.training_courses c where c.id = new.course_id) then
    raise exception using errcode = '22023', message = 'edition and course belong to different providers';
  end if;
  if tg_op = 'UPDATE' and new.course_id <> old.course_id then
    raise exception using errcode = '55000', message = 'an edition cannot change course';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_training_edition() from public, anon, authenticated;
create trigger training_editions_guard before insert or update on public.training_editions
  for each row execute function public.guard_training_edition();

-- No two sessions of one edition overlap (v1.9 «Las sesiones de una edición no pueden solaparse»).
-- Statement-level AFTER INSERT trigger (one event per transition table): the RPC inserts the whole set
-- in one statement under the edition lock. Rows are never updated (the set is replaced).
create function public.guard_training_sessions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'training_sessions rows are replaced, never updated' using errcode = '55000';
  end if;
  if exists (
    select 1
    from public.training_sessions a
    join public.training_sessions b on b.edition_id = a.edition_id and b.id > a.id and a.span && b.span
    where a.edition_id in (select n.edition_id from new_rows n)
  ) then
    raise exception using errcode = '22023', message = 'sessions of one edition cannot overlap';
  end if;
  return null;
end;
$$;
revoke execute on function public.guard_training_sessions() from public, anon, authenticated;
create trigger training_sessions_no_overlap
  after insert on public.training_sessions
  referencing new table as new_rows
  for each statement execute function public.guard_training_sessions();
create trigger training_sessions_immutable before update on public.training_sessions
  for each row execute function public.refuse_application_history_update();

-- ---------------------------------------------------------------------------------------------
-- 4. RLS and grants. Supabase grants ALL to the API roles by default: revoke, then grant SELECT only
--    (review notes and cancel reasons stay behind the RPCs: column grant).
-- ---------------------------------------------------------------------------------------------
revoke all on table
  public.training_providers, public.training_courses, public.training_editions, public.training_sessions,
  public.training_favorites, public.training_requests, public.training_offers,
  public.training_request_events, public.training_messages
from anon, authenticated;
grant select (organization_id, name, description, website, status, created_at, updated_at)
  on table public.training_providers to authenticated;
grant select (id, organization_id, title, family, description, aircraft, engine, category, language,
              prerequisites, syllabus, certificate_info, issuer, scope, approval_ref, status, created_at, updated_at)
  on table public.training_courses to authenticated;
grant select (id, course_id, organization_id, mode, provisional, deadline, capacity, city, country, currency,
              price_unit, price_cents, price_includes, policy, time_zone, status, created_at, updated_at)
  on table public.training_editions to authenticated;
grant select on table
  public.training_sessions, public.training_favorites, public.training_requests, public.training_offers,
  public.training_request_events, public.training_messages
to authenticated;

create policy training_providers_select on public.training_providers for select to authenticated
  using (status = 'reviewed'
         or public.has_org_role(organization_id, array['admin', 'manager']::public.organization_role[])
         or public.is_platform_admin());
create policy training_courses_select on public.training_courses for select to authenticated
  using ((status = 'published' and exists (
            select 1 from public.training_providers p
            where p.organization_id = training_courses.organization_id and p.status = 'reviewed'))
         or public.has_org_role(organization_id, array['admin', 'manager']::public.organization_role[])
         or public.is_platform_admin());
-- Editions and sessions inherit the course's visibility (the subquery runs under RLS).
create policy training_editions_select on public.training_editions for select to authenticated
  using ((status = 'published' or public.has_org_role(organization_id, array['admin', 'manager']::public.organization_role[])
          or public.is_platform_admin())
         and exists (select 1 from public.training_courses c where c.id = training_editions.course_id));
create policy training_sessions_select on public.training_sessions for select to authenticated
  using (exists (select 1 from public.training_editions e where e.id = training_sessions.edition_id));
create policy training_favorites_select on public.training_favorites for select to authenticated
  using (profile_id = (select auth.uid()));
create policy training_requests_select on public.training_requests for select to authenticated
  using (professional_id = (select auth.uid())
         or public.has_org_role(organization_id, array['admin', 'manager']::public.organization_role[])
         or public.is_platform_admin());
create policy training_offers_select on public.training_offers for select to authenticated
  using (exists (select 1 from public.training_requests r where r.id = training_offers.request_id));
create policy training_request_events_select on public.training_request_events for select to authenticated
  using (exists (select 1 from public.training_requests r where r.id = training_request_events.request_id));
-- Participants only: the professional and the provider's admin/manager. No platform admin (N-6).
create policy training_messages_select on public.training_messages for select to authenticated
  using (exists (
    select 1 from public.training_requests r
    where r.id = training_messages.request_id
      and (r.professional_id = (select auth.uid())
           or public.has_org_role(r.organization_id, array['admin', 'manager']::public.organization_role[]))));

-- ---------------------------------------------------------------------------------------------
-- 5. The transition table = TRAINING_TRANSITIONS (src/domain/training.ts; tests/db/training.test.ts
--    compares both). `system` rows are written by cancel_training_edition only.
-- ---------------------------------------------------------------------------------------------
create table app_private.training_transitions (
  from_status public.training_request_status not null,
  to_status public.training_request_status not null,
  actor text not null check (actor in ('professional', 'provider', 'system')),
  reason_required boolean not null,
  primary key (from_status, to_status, actor)
);
alter table app_private.training_transitions enable row level security; -- no policy, no grant
revoke all on table app_private.training_transitions from public, anon, authenticated;

insert into app_private.training_transitions (from_status, to_status, actor, reason_required) values
  ('received', 'waitlisted', 'provider', false),
  ('received', 'offered', 'provider', false),
  ('received', 'rejected', 'provider', true),
  ('received', 'closed', 'provider', false),        -- inquiries only
  ('received', 'withdrawn', 'professional', false),
  ('waitlisted', 'offered', 'provider', false),
  ('waitlisted', 'rejected', 'provider', true),
  ('waitlisted', 'withdrawn', 'professional', false),
  ('offered', 'offered', 'provider', false),        -- a new offer version (R-08)
  ('offered', 'accepted', 'professional', false),   -- with the CURRENT offer id + explicit acceptance
  ('offered', 'waitlisted', 'provider', false),
  ('offered', 'rejected', 'provider', true),
  ('offered', 'withdrawn', 'professional', false),
  ('accepted', 'offered', 'provider', false),       -- terms changed: a new version to accept
  ('accepted', 'confirmed', 'provider', false),     -- transactional seat (capacity + overlaps)
  ('accepted', 'waitlisted', 'provider', false),
  ('accepted', 'rejected', 'provider', true),
  ('accepted', 'withdrawn', 'professional', false),
  ('confirmed', 'cancelled', 'professional', true),
  ('confirmed', 'cancelled', 'provider', true),
  ('confirmed', 'finished', 'provider', false),     -- after the last session; outcome required
  ('received', 'cancelled', 'system', true),        -- the edition was cancelled
  ('waitlisted', 'cancelled', 'system', true),
  ('offered', 'cancelled', 'system', true),
  ('accepted', 'cancelled', 'system', true),
  ('confirmed', 'cancelled', 'system', true);

-- ---------------------------------------------------------------------------------------------
-- 6. Feature flag and idempotency operations
-- ---------------------------------------------------------------------------------------------
create or replace function public.is_feature_enabled(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Whitelist: only flags the app may know about. Unknown names are simply "off".
  select p_name in ('document_wallet', 'training')
    and exists (select 1 from app_private.feature_flags f where f.name = p_name and f.enabled);
$$;

do $$
declare
  v_def text;
  v_ops text[];
begin
  select pg_get_constraintdef(c.oid) into v_def
  from pg_constraint c
  where c.conrelid = 'app_private.idempotency_keys'::regclass
    and c.conname = 'idempotency_keys_operation_check';
  select array_agg(distinct replace(t.m[1], '''''', '''')) into v_ops
  from regexp_matches(coalesce(v_def, ''), '''((?:[^'']|'''')*)''', 'g') as t(m);
  if v_ops is null or not v_ops @> array['work_requirement.create', 'application.transition'] then
    raise exception 'idempotency_keys_operation_check has an unexpected definition: %', v_def;
  end if;
  v_ops := array(select distinct o from unnest(v_ops || array[
    'training_request.create', 'training_request.transition', 'training_message.create']) as o order by o);
  alter table app_private.idempotency_keys drop constraint idempotency_keys_operation_check;
  execute format(
    'alter table app_private.idempotency_keys add constraint idempotency_keys_operation_check check (operation in (%s))',
    (select string_agg(quote_literal(o), ', ' order by o) from unnest(v_ops) as o));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 7. Private helpers (no grants; the DEFINER functions call them as their owner)
-- ---------------------------------------------------------------------------------------------

-- The flag gate every training RPC starts with (0A000 → 404 «not available», as the wallet).
create function app_private.require_training()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.is_feature_enabled('training') then
    raise exception using errcode = '0A000', message = 'training is not enabled';
  end if;
end;
$$;

-- Is the course on the catalog now: published, provider reviewed.
create function app_private.training_course_live(p_course_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.training_courses c
    join public.training_providers p on p.organization_id = c.organization_id
    where c.id = p_course_id and c.status = 'published' and p.status = 'reviewed');
$$;

-- Confirmed seats of an edition (`finished` keeps its seat, as employment does).
create function app_private.training_confirmed_seats(p_edition_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer from public.training_requests r
  where r.edition_id = p_edition_id and r.status in ('confirmed', 'finished');
$$;

-- First start / last end of an edition (sessions, or the self-paced deadline).
create function app_private.training_edition_bounds(p_edition_id uuid)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
set search_path = ''
as $$
  select coalesce((select min(lower(s.span)) from public.training_sessions s where s.edition_id = e.id), e.deadline),
         coalesce((select max(upper(s.span)) from public.training_sessions s where s.edition_id = e.id), e.deadline)
  from public.training_editions e where e.id = p_edition_id;
$$;

-- Does [p_from, p_to) overlap a live session of a CONFIRMED seat of this professional (another request
-- than p_exclude)? Both overlap directions use it: training confirm ↔ training, and the employment
-- confirmation (20261029100400). Self-paced editions have no sessions and block nothing.
create function app_private.training_overlaps(
  p_profile_id uuid, p_from timestamptz, p_to timestamptz, p_exclude_request uuid default null
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.training_requests r
    join public.training_sessions s on s.edition_id = r.edition_id
    where r.professional_id = p_profile_id
      and r.status = 'confirmed'
      and (p_exclude_request is null or r.id <> p_exclude_request)
      and s.span && tstzrange(p_from, p_to, '[)'));
$$;

-- Does a live session of this edition overlap a confirmed employment assignment or another confirmed
-- training seat of the professional? (V19-028, hour-based, both directions.)
create function app_private.training_edition_conflicts(p_edition_id uuid, p_profile_id uuid, p_request_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.training_sessions s
    where s.edition_id = p_edition_id
      and (exists (
             select 1 from public.applications a
             join public.work_requirements r on r.id = a.requirement_id
             where a.technician_profile_id = p_profile_id and a.status = 'confirmed'
               and tstzrange(r.starts_at, r.ends_at, '[)') && s.span)
           or app_private.training_overlaps(p_profile_id, lower(s.span), upper(s.span), p_request_id)));
$$;

-- Validates and inserts the sessions of an edition from [{ startsAt, endsAt, location?, element? }]
-- (v1.9 normalizeEdition): ≤ 60, each ≤ 24 h and in the future, no overlap; self-paced = none;
-- confirmed dates need at least one. Called under the edition lock; replaces the set.
create function app_private.replace_training_sessions(
  p_edition_id uuid, p_mode public.training_mode, p_provisional boolean, p_sessions jsonb
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_sessions is null or jsonb_typeof(p_sessions) <> 'array' or jsonb_array_length(p_sessions) > 60 then
    raise exception using errcode = '22023', message = 'between 0 and 60 sessions';
  end if;
  v_count := jsonb_array_length(p_sessions);
  if p_mode = 'selfpaced' and v_count > 0 then
    raise exception using errcode = '22023', message = 'self-paced editions have no live sessions';
  end if;
  if p_mode <> 'selfpaced' and not p_provisional and v_count = 0 then
    raise exception using errcode = '22023', message = 'add the sessions or mark the dates as provisional';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_sessions) s
    where jsonb_typeof(s) <> 'object' or s ->> 'startsAt' is null or s ->> 'endsAt' is null
       or coalesce(s ->> 'element', 'theory') not in ('theory', 'practical', 'assessment')
       or (s ->> 'location' is not null and char_length(s ->> 'location') not between 1 and 200)
  ) then
    raise exception using errcode = '22023', message = 'invalid session';
  end if;
  delete from public.training_sessions s where s.edition_id = p_edition_id;
  begin
    insert into public.training_sessions (edition_id, span, location, element)
    select p_edition_id,
           tstzrange((s ->> 'startsAt')::timestamptz, (s ->> 'endsAt')::timestamptz, '[)'),
           nullif(btrim(coalesce(s ->> 'location', '')), ''),
           coalesce(s ->> 'element', 'theory')::public.training_session_element
    from jsonb_array_elements(p_sessions) s;
  exception when invalid_datetime_format or datetime_field_overflow or data_exception then
    raise exception using errcode = '22023', message = 'invalid session';
  end;
  if exists (select 1 from public.training_sessions s where s.edition_id = p_edition_id and lower(s.span) <= now()) then
    raise exception using errcode = '22023', message = 'session dates must be in the future';
  end if;
  return v_count;
end;
$$;

revoke execute on function
  app_private.require_training(),
  app_private.training_course_live(uuid),
  app_private.training_confirmed_seats(uuid),
  app_private.training_edition_bounds(uuid),
  app_private.training_overlaps(uuid, timestamptz, timestamptz, uuid),
  app_private.training_edition_conflicts(uuid, uuid, uuid),
  app_private.replace_training_sessions(uuid, public.training_mode, boolean, jsonb)
from public, anon, authenticated;
