-- Crew Flex — sign-up by invitation behind an owner flag (v1.8 `server/app.mjs:42,160,188`; OD-8 default,
-- technical default T-40 in docs/integration/crewflex-v13/08-product-decisions.md). LOCAL ONLY.
-- NON-DESTRUCTIVE: one table (RLS on in this file), private/public functions, and `create or replace` of
-- handle_new_user (same signature). With the flag off nothing changes: open sign-up behaves exactly as before.
--
-- FLAG. `app_private.feature_flags('invitation_signup', true)` — no row = OFF (open sign-up). Only the
-- database owner writes it (no grant, schema not exposed), e.g. in the SQL editor:
--   insert into app_private.feature_flags (name, enabled) values ('invitation_signup', true);   -- on
--   delete from app_private.feature_flags where name = 'invitation_signup';                     -- off
--
-- MODEL (v1.8). A platform admin invites an e-mail address with an account type (professional or
-- organization; never «Administración»: platform_admin is not an account type and is never invited).
-- The invitation carries a random code (two v4 UUIDs = 244 random bits, 64 hex chars) that is shown
-- to nobody: only its SHA-256 is stored. It is valid for 7 days and for one sign-up, by that e-mail
-- address only. The code reaches the invitee inside the link of an Auth e-mail
-- (`/register?invite=<code>`): Supabase Auth only e-mails addresses that have an Auth user, so the
-- `invitations` function asks the public Auth API to create a short-lived *delivery account* for the
-- address (metadata `invitation_delivery = <invitation id>`), which gets no profile here and is
-- deleted by finish_invitation_delivery() right after the e-mail leaves. No privileged key is used.
--
-- SIGN-UP. With the flag on, handle_new_user refuses (CFI01) every new Auth user whose metadata does
-- not carry the code of an open, unexpired invitation for the same e-mail; the account type comes from
-- the invitation (the metadata's is ignored) and the invitation is consumed in the same transaction.
-- The raw code is then removed from the user's metadata. The sign-up form reads invitation_status()
-- first to show its own messages (invalid / another e-mail) without consuming anything. The
-- `invitation_delivery` marker is accepted only for a genuine delivery (flag on, open invitation of
-- that address); anywhere else it is refused (CFI01). Unused invitations (revoked or expired) are
-- deleted 30 days later, when the next invitation is created; used ones leave with their account.
-- Residual (security review L-1): the code is consumed when the Auth user is created, before the
-- address is confirmed — production must keep e-mail confirmation on (owner Auth setting).
--
-- Errors: 42501 not authorized · 0A000 invitations off · 22023 invalid argument · 23505 the e-mail
-- already has an account · P0002 unknown invitation · CFI01 sign-up without a valid invitation.

create table public.account_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null
    check (char_length(email) between 3 and 254
           and email = lower(btrim(email))
           and email ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
  account_type public.account_type not null,
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  -- The account created with it. Cascade: the invitation (it holds the e-mail) leaves with the account.
  consumed_by uuid references public.profiles (id) on delete cascade,
  consumed_at timestamptz,
  revoked_at timestamptz,
  constraint account_invitations_expiry check (expires_at > created_at),
  constraint account_invitations_consumed check ((consumed_at is null) = (consumed_by is null)),
  constraint account_invitations_closed_once check (consumed_at is null or revoked_at is null)
);
alter table public.account_invitations enable row level security;
-- One open invitation per address (create_invitation revokes the previous one, expired or not).
create unique index account_invitations_one_open
  on public.account_invitations (email) where consumed_at is null and revoked_at is null;

-- Platform admins read the list (support); nobody writes it directly; the hash is not readable.
revoke all on table public.account_invitations from anon, authenticated;
grant select (id, email, account_type, created_by, created_at, expires_at, consumed_at, revoked_at)
  on public.account_invitations to authenticated;
create policy account_invitations_select_platform_admin on public.account_invitations
  for select to authenticated using ((select public.is_platform_admin()));

-- ---------------------------------------------------------------------------------------------
-- Flag and code helpers (private: called by the DEFINER functions below as their owner)
-- ---------------------------------------------------------------------------------------------
create function app_private.invitation_signup_on()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from app_private.feature_flags f where f.name = 'invitation_signup' and f.enabled
  );
$$;

create function app_private.invitation_code_hash(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(coalesce(p_code, ''), 'UTF8')), 'hex');
$$;

revoke execute on function app_private.invitation_signup_on(), app_private.invitation_code_hash(text)
  from public, anon, authenticated;

-- The public sign-up page must know whether a code is required before anyone is signed in. One
-- boolean of owner configuration, nothing else (anon-callable on purpose).
create function public.invitation_signup_required()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.invitation_signup_on();
$$;
revoke execute on function public.invitation_signup_required() from public;
grant execute on function public.invitation_signup_required() to anon, authenticated;

-- What the sign-up form may say about a code its holder already has (anon-callable on purpose: the
-- caller is not signed in). `valid` (+ the invitation's account type) · `other_email` (the code is
-- open but belongs to another address; nothing is consumed) · `invalid` (unknown, expired, used or
-- revoked — one answer, as v1.8 «Enlace caducado, utilizado o no válido.») · `off` (open sign-up).
-- Never returns the e-mail address or any id. Codes carry 244 random bits: no useful oracle.
create function public.invitation_status(p_code text, p_email text default null)
returns table (status text, account_type public.account_type)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_inv public.account_invitations%rowtype;
begin
  if not app_private.invitation_signup_on() then
    return query select 'off'::text, null::public.account_type;
    return;
  end if;
  if p_code is null or p_code !~ '^[0-9a-f]{64}$' then
    return query select 'invalid'::text, null::public.account_type;
    return;
  end if;
  select * into v_inv from public.account_invitations i
  where i.code_hash = app_private.invitation_code_hash(p_code);
  if not found or v_inv.consumed_at is not null or v_inv.revoked_at is not null
     or v_inv.expires_at <= now() then
    return query select 'invalid'::text, null::public.account_type;
    return;
  end if;
  if p_email is not null and lower(btrim(p_email)) is distinct from v_inv.email then
    return query select 'other_email'::text, null::public.account_type;
    return;
  end if;
  return query select 'valid'::text, v_inv.account_type;
end;
$$;
revoke execute on function public.invitation_status(text, text) from public;
grant execute on function public.invitation_status(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Platform admin: create (returns the code ONCE, to the caller — the `invitations` function, which
-- puts it in the e-mail link and never in its response) and finish the delivery.
-- ---------------------------------------------------------------------------------------------
create function public.create_invitation(
  p_email text,
  p_account_type public.account_type,
  p_request_id uuid default null
)
returns table (invitation_id uuid, code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_code text;
  v_id uuid;
  v_expires timestamptz := now() + interval '7 days';
  v_replaced integer;
begin
  if v_uid is null or not public.is_platform_admin() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if not app_private.invitation_signup_on() then
    raise exception using errcode = '0A000', message = 'invitations are not enabled';
  end if;
  if p_account_type is null or char_length(v_email) not between 3 and 254
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+$' then
    raise exception using errcode = '22023', message = 'invalid invitation';
  end if;
  -- One invitation at a time per address (concurrent creates serialise here).
  perform pg_advisory_xact_lock(hashtextextended('invitation:' || v_email, 0));
  -- An address that already has an account (a profile) is not invited; a delivery account has none.
  if exists (
    select 1 from auth.users u join public.profiles p on p.id = u.id where lower(u.email) = v_email
  ) then
    raise exception using errcode = '23505', message = 'an account exists for this e-mail';
  end if;
  update public.account_invitations i set revoked_at = now()
  where i.email = v_email and i.consumed_at is null and i.revoked_at is null;
  get diagnostics v_replaced = row_count;
  -- Retention (security review M-2): unused invitations hold an address of someone who never signed up;
  -- 30 days after they were revoked or expired they go (at the next invitation; T-40).
  delete from public.account_invitations i
  where i.consumed_at is null
    and coalesce(i.revoked_at, i.expires_at) < now() - interval '30 days';

  v_code := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.account_invitations (email, account_type, code_hash, created_by, expires_at)
  values (v_email, p_account_type, app_private.invitation_code_hash(v_code), v_uid, v_expires)
  returning id into v_id;
  -- S-9: ids and flags only — never the e-mail address or the code.
  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values (v_uid, null, 'invitation.created', 'account_invitation', v_id,
          jsonb_build_object('account_type', p_account_type, 'replaced', v_replaced,
                             'request_id', p_request_id));
  return query select v_id, v_code, v_expires;
end;
$$;

-- After the e-mail was handed to Auth (or failed): removes the delivery account(s) of that address —
-- Auth users with the `invitation_delivery` marker and no profile, never a real account — and records
-- the outcome. A failed delivery revokes the invitation (nobody received its code).
create function public.finish_invitation_delivery(
  p_invitation_id uuid,
  p_sent boolean,
  p_request_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_inv public.account_invitations%rowtype;
  v_removed integer;
begin
  if v_uid is null or not public.is_platform_admin() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  select * into v_inv from public.account_invitations i where i.id = p_invitation_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'unknown invitation';
  end if;
  delete from auth.users u
  where lower(u.email) = v_inv.email
    and u.raw_user_meta_data ? 'invitation_delivery'
    and not exists (select 1 from public.profiles p where p.id = u.id);
  get diagnostics v_removed = row_count;
  if p_sent is distinct from true and v_inv.consumed_at is null and v_inv.revoked_at is null then
    update public.account_invitations i set revoked_at = now() where i.id = v_inv.id;
  end if;
  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values (v_uid, null,
          case when p_sent then 'invitation.sent' else 'invitation.revoked' end,
          'account_invitation', v_inv.id,
          jsonb_build_object('delivery_account_removed', v_removed > 0, 'request_id', p_request_id)
            || case when p_sent then '{}'::jsonb else jsonb_build_object('reason', 'delivery_failed') end);
  return v_removed;
end;
$$;

revoke execute on function
  public.create_invitation(text, public.account_type, uuid),
  public.finish_invitation_delivery(uuid, boolean, uuid)
from public, anon;
grant execute on function
  public.create_invitation(text, public.account_type, uuid),
  public.finish_invitation_delivery(uuid, boolean, uuid)
to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Sign-up trigger (same body as 20261009120000 for open sign-up; invitation rules on top).
-- platform_role is still NEVER taken from metadata.
-- ---------------------------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_account public.account_type :=
    case when v_meta ->> 'account_type' = 'organization' then 'organization'::public.account_type
         else 'professional'::public.account_type end;
  v_name text := left(coalesce(nullif(btrim(v_meta ->> 'display_name'), ''),
                               nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
                               'User'), 120);
  v_org_id uuid;
  v_delivery text := v_meta ->> 'invitation_delivery';
  v_inv public.account_invitations%rowtype;
begin
  -- 1. Delivery account of an invitation e-mail: no profile (removed by finish_invitation_delivery).
  --    Only with the flag on and for an open invitation of that very address. Any other use of the
  --    marker is refused (security review M-1): it would render the invitation e-mail branch of the
  --    template for an address nobody invited, or skip a profile.
  if v_meta ? 'invitation_delivery' then
    if app_private.invitation_signup_on()
       and v_delivery ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       and exists (
         select 1 from public.account_invitations i
         where i.id = v_delivery::uuid and i.email = lower(new.email)
           and i.consumed_at is null and i.revoked_at is null and i.expires_at > now()
       ) then
      return new;
    end if;
    raise exception using errcode = 'CFI01', message = 'not an invitation delivery';
  end if;

  -- 2. Invitation-only sign-up (owner flag): a valid code for this address, consumed below.
  if app_private.invitation_signup_on() then
    select * into v_inv from public.account_invitations i
    where i.code_hash = app_private.invitation_code_hash(v_meta ->> 'invitation_code')
    for update;
    if not found or v_inv.consumed_at is not null or v_inv.revoked_at is not null
       or v_inv.expires_at <= now() or v_inv.email is distinct from lower(new.email) then
      raise exception using errcode = 'CFI01', message = 'a valid invitation is required to sign up';
    end if;
    v_account := v_inv.account_type;
  end if;

  insert into public.profiles (id, display_name, account_type) values (new.id, v_name, v_account);

  if v_account = 'professional' then
    insert into public.technician_profiles (profile_id) values (new.id);
  else
    insert into public.organizations (name, type, country)
    values (
      left(coalesce(nullif(btrim(v_meta ->> 'organization_name'), ''), v_name || ' organization'), 160),
      case when v_meta ->> 'organization_type' in ('mro', 'airline', 'operator', 'staffing_agency', 'other')
           then (v_meta ->> 'organization_type')::public.organization_type
           else 'mro'::public.organization_type end,
      case when v_meta ->> 'country' ~ '^[A-Z]{2}$' then v_meta ->> 'country' end
    )
    returning id into v_org_id;
    insert into public.organization_members (organization_id, profile_id, role)
    values (v_org_id, new.id, 'admin');
  end if;

  if v_inv.id is not null then
    update public.account_invitations i set consumed_at = now(), consumed_by = new.id
    where i.id = v_inv.id;
  end if;
  -- The code is a credential: it never stays in the user's metadata (consumed or not).
  if v_meta ? 'invitation_code' then
    update auth.users u set raw_user_meta_data = u.raw_user_meta_data - 'invitation_code'
    where u.id = new.id;
  end if;

  return new;
end;
$$;
