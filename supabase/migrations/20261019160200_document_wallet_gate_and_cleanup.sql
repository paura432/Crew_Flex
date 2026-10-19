-- Crew Flex — document wallet: backend activation gate + deletion/retention/orphan cleanup (D-10,
-- owner instructions 2026-10-19, review M-3). LOCAL ONLY.
-- NON-DESTRUCTIVE: two private tables (one seeded settings row), one trigger, five functions, and
-- `create or replace` / policy re-creation of objects added by 20261019160000/160100 (same names
-- and signatures). No row or column is removed. Design: docs/product/DOCUMENT_WALLET.md §6–§8.
--
-- 1. ACTIVATION GATE (the owner refused a Vercel variable). Reuses `app_private.feature_flags`
--    (20261015130400): no row `('document_wallet', true)` = OFF. Only the database owner can write
--    that table, e.g. in the SQL editor:
--      insert into app_private.feature_flags (name, enabled) values ('document_wallet', true);
--    While OFF the database refuses every NEW document: `create_professional_document` raises
--    0A000 (→ 404 "service not available"), and both the table INSERT policy and the bucket's
--    Storage INSERT policy require the flag, so direct PostgREST inserts and direct Storage uploads
--    are closed too. Reads, metadata edits and deletes of what the owner already stored keep
--    working when the flag is switched off later: switching a product feature off must never take
--    a person's own data hostage (they can still list, open and delete it — data minimisation and
--    erasure stay possible). `public.is_feature_enabled` lets the Next.js server hide the UI; it is
--    a convenience, not a barrier.
--
-- 2. TOMBSTONES. Every deleted document row — owner delete, account-deletion cascade, or any other
--    cause — leaves a tombstone for its Storage object in `app_private.document_object_tombstones`
--    (AFTER DELETE trigger, SECURITY DEFINER). `reason`:
--      owner_delete     the owner deleted it          → purge-eligible immediately
--      account_deleted  the technician profile is gone → purge after the grace period (setting)
--      operator_delete  anyone else (SQL by an operator)→ same grace period (not the owner's wish)
--      orphan_upload    object with no row found by reconciliation (its age already exceeded the
--                       orphan grace) → purge-eligible immediately
--    `legal_hold = true` is never purge-eligible until released. Proposal: only the database owner
--    sets or releases it, in SQL (no API surface), e.g.
--      update app_private.document_object_tombstones set legal_hold = true where owner_id = '<uuid>';
--
-- 3. RETENTION SETTINGS. One row in `app_private.document_retention_settings`: grace after account
--    deletion (default 30 days — a PROPOSAL for the owner) and minimum age of an unreferenced
--    object before it counts as an orphan (default 24 h: a POST may still be committing its row,
--    review L-1). Changed only by the database owner in SQL; never hard-coded in a function.
--
-- 4. MAINTENANCE RPCs for the `documents-maintenance` Edge Function (platform admin only; each
--    re-checks `is_platform_admin()` in its body, S-10). They never delete objects themselves
--    (Storage objects are removed through the Storage API):
--      document_maintenance_batch(apply, limit)  reconciliation (+ tombstones when apply) and the
--                                                due tombstones, bounded;
--      document_purge_recheck(tombstone)         right before a delete: no row references the path,
--                                                no legal hold, not purged yet (row lock);
--      document_purge_record(tombstone, outcome) marks purged / absent / failed, audits
--                                                `document.purged` (ids and reason only).
--
-- Errors: 0A000 wallet disabled · 42501 not authorized · 22023 invalid argument · P0002 unknown
-- tombstone.

-- ---------------------------------------------------------------------------------------------
-- 1. Gate
-- ---------------------------------------------------------------------------------------------
create function public.is_feature_enabled(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Whitelist: only flags the app may know about. Unknown names are simply "off".
  select p_name in ('document_wallet')
    and exists (select 1 from app_private.feature_flags f where f.name = p_name and f.enabled);
$$;
revoke execute on function public.is_feature_enabled(text) from public, anon;
grant execute on function public.is_feature_enabled(text) to authenticated;

drop policy professional_documents_insert_own on public.professional_documents;
create policy professional_documents_insert_own on public.professional_documents
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select public.is_feature_enabled('document_wallet')));

drop policy professional_documents_objects_insert_own on storage.objects;
create policy professional_documents_objects_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'professional-documents'
              and (select public.is_feature_enabled('document_wallet'))
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[0-9a-f]{16}$'
              and exists (select 1 from public.technician_profiles t
                          where t.profile_id = (select auth.uid())));

create or replace function public.create_professional_document(
  p_idempotency_key uuid,
  p_kind public.document_kind,
  p_title text,
  p_storage_path text,
  p_mime_type text,
  p_size_bytes integer,
  p_sha256 text,
  p_expires_at date,
  p_qualification_id uuid
)
returns table (id uuid, replayed boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if not public.is_feature_enabled('document_wallet') then
    raise exception using errcode = '0A000', message = 'document wallet is not enabled';
  end if;
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_storage_path is distinct from
     v_uid::text || '/' || p_idempotency_key::text || '-' || left(p_sha256, 16) then
    raise exception using errcode = '22023', message = 'storage path does not match the request';
  end if;

  v_id := app_private.claim_idempotency_key('document.create', p_idempotency_key,
    jsonb_build_object('kind', p_kind, 'title', p_title, 'storage_path', p_storage_path,
                       'mime_type', p_mime_type, 'size_bytes', p_size_bytes, 'sha256', p_sha256,
                       'expires_at', p_expires_at, 'qualification_id', p_qualification_id));
  if v_id is not null then
    return query select v_id, true;
    return;
  end if;

  insert into public.professional_documents
    (owner_id, kind, title, storage_path, mime_type, size_bytes, sha256, expires_at, qualification_id)
  values (v_uid, p_kind, p_title, p_storage_path, p_mime_type, p_size_bytes, p_sha256, p_expires_at,
          p_qualification_id)
  returning professional_documents.id into v_id;
  perform app_private.complete_idempotency_key('document.create', p_idempotency_key, v_id);
  return query select v_id, false;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 2–3. Tombstones and retention settings (private: no grant, no policy, DEFINER access only)
-- ---------------------------------------------------------------------------------------------
create table app_private.document_retention_settings (
  id boolean primary key default true check (id),
  account_deletion_grace interval not null default interval '30 days'
    check (account_deletion_grace between interval '0' and interval '3650 days'),
  orphan_upload_grace interval not null default interval '24 hours'
    check (orphan_upload_grace between interval '1 hour' and interval '30 days'),
  updated_at timestamptz not null default now()
);
alter table app_private.document_retention_settings enable row level security;
revoke all on table app_private.document_retention_settings from public, anon, authenticated;
insert into app_private.document_retention_settings (id) values (true) on conflict (id) do nothing;
comment on table app_private.document_retention_settings is
  'Document wallet retention (D-10). Defaults are a proposal for the owner; change in SQL only.';

create table app_private.document_object_tombstones (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null check (storage_path ~ '^[0-9a-f-]{36}/[^/]{1,200}$'),
  owner_id uuid not null, -- no FK: the owner may be gone (account deletion)
  reason text not null
    check (reason in ('owner_delete', 'account_deleted', 'operator_delete', 'orphan_upload')),
  deleted_at timestamptz not null default now(),
  purge_after timestamptz not null,
  legal_hold boolean not null default false,
  purged_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text check (char_length(last_error) <= 200)
);
-- At most one open tombstone per object.
create unique index document_object_tombstones_open_path_idx
  on app_private.document_object_tombstones (storage_path) where purged_at is null;
create index document_object_tombstones_due_idx
  on app_private.document_object_tombstones (purge_after) where purged_at is null and not legal_hold;
alter table app_private.document_object_tombstones enable row level security;
revoke all on table app_private.document_object_tombstones from public, anon, authenticated;

create function app_private.document_retention()
returns app_private.document_retention_settings
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v app_private.document_retention_settings;
begin
  select * into v from app_private.document_retention_settings s where s.id;
  if not found then -- row removed by an operator: fall back to the documented defaults
    v := row(true, interval '30 days', interval '24 hours', now());
  end if;
  return v;
end;
$$;
revoke execute on function app_private.document_retention() from public, anon, authenticated;

create function public.tombstone_professional_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_reason text;
  v_settings app_private.document_retention_settings := app_private.document_retention();
begin
  -- In an account-deletion cascade the parent technician profile is already gone.
  if not exists (select 1 from public.technician_profiles t where t.profile_id = old.owner_id) then
    v_reason := 'account_deleted';
  elsif v_actor is not null and v_actor = old.owner_id then
    v_reason := 'owner_delete';
  else
    v_reason := 'operator_delete';
  end if;
  insert into app_private.document_object_tombstones (storage_path, owner_id, reason, purge_after)
  values (old.storage_path, old.owner_id, v_reason,
          case when v_reason = 'owner_delete' then now()
               else now() + v_settings.account_deletion_grace end)
  on conflict (storage_path) where purged_at is null do nothing;
  return old;
end;
$$;
create trigger professional_documents_tombstone
  after delete on public.professional_documents
  for each row execute function public.tombstone_professional_document();
revoke execute on function public.tombstone_professional_document() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. Maintenance RPCs (platform admin only)
-- ---------------------------------------------------------------------------------------------
create function public.document_maintenance_batch(p_apply boolean, p_limit integer)
returns table (tombstone_id uuid, storage_path text, reason text, action text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_settings app_private.document_retention_settings := app_private.document_retention();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if (select auth.uid()) is null or not public.is_platform_admin() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  -- Reconciliation: objects older than the orphan grace that no row and no open tombstone
  -- reference. A referenced object is never listed.
  if p_apply then
    insert into app_private.document_object_tombstones (storage_path, owner_id, reason, purge_after)
    select o.name, (storage.foldername(o.name))[1]::uuid, 'orphan_upload', now()
    from storage.objects o
    where o.bucket_id = 'professional-documents'
      and o.name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]{1,200}$'
      and o.created_at < now() - v_settings.orphan_upload_grace
      and not exists (select 1 from public.professional_documents d where d.storage_path = o.name)
      and not exists (select 1 from app_private.document_object_tombstones t
                      where t.storage_path = o.name and t.purged_at is null)
    order by o.created_at
    limit v_limit
    on conflict (storage_path) where purged_at is null do nothing;
  else
    return query
    select null::uuid, o.name, 'orphan_upload'::text, 'would_tombstone'::text
    from storage.objects o
    where o.bucket_id = 'professional-documents'
      and o.name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]{1,200}$'
      and o.created_at < now() - v_settings.orphan_upload_grace
      and not exists (select 1 from public.professional_documents d where d.storage_path = o.name)
      and not exists (select 1 from app_private.document_object_tombstones t
                      where t.storage_path = o.name and t.purged_at is null)
    order by o.created_at
    limit v_limit;
  end if;

  -- Due tombstones (in apply mode this includes the orphans just recorded).
  return query
  select t.id, t.storage_path, t.reason, 'purge'::text
  from app_private.document_object_tombstones t
  where t.purged_at is null and not t.legal_hold and t.purge_after <= now() and t.attempts < 10
    and not exists (select 1 from public.professional_documents d where d.storage_path = t.storage_path)
  order by t.purge_after
  limit v_limit;
end;
$$;

create function public.document_purge_recheck(p_tombstone_id uuid)
returns table (storage_path text, allowed boolean, why text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_t app_private.document_object_tombstones%rowtype;
begin
  if (select auth.uid()) is null or not public.is_platform_admin() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  select * into v_t from app_private.document_object_tombstones t where t.id = p_tombstone_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'unknown tombstone';
  end if;
  return query select v_t.storage_path,
    v_t.purged_at is null and not v_t.legal_hold and v_t.purge_after <= now()
      and not exists (select 1 from public.professional_documents d where d.storage_path = v_t.storage_path),
    case
      when v_t.purged_at is not null then 'already_purged'
      when v_t.legal_hold then 'legal_hold'
      when v_t.purge_after > now() then 'not_due'
      when exists (select 1 from public.professional_documents d where d.storage_path = v_t.storage_path)
        then 'referenced'
      else 'ok'
    end;
end;
$$;

create function public.document_purge_record(p_tombstone_id uuid, p_outcome text, p_error text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_t app_private.document_object_tombstones%rowtype;
begin
  if v_uid is null or not public.is_platform_admin() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_outcome is null or p_outcome not in ('purged', 'absent', 'failed') then
    raise exception using errcode = '22023', message = 'invalid outcome';
  end if;
  select * into v_t from app_private.document_object_tombstones t where t.id = p_tombstone_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'unknown tombstone';
  end if;
  if v_t.purged_at is not null then
    return; -- idempotent: already recorded
  end if;
  if p_outcome = 'failed' then
    update app_private.document_object_tombstones
    set attempts = attempts + 1, last_error = left(coalesce(p_error, 'error'), 200)
    where id = v_t.id;
    return;
  end if;
  update app_private.document_object_tombstones set purged_at = now(), attempts = attempts + 1,
    last_error = null
  where id = v_t.id;
  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values (v_uid, null, 'document.purged', 'document_object_tombstone', v_t.id,
    jsonb_build_object('technician_profile_id', v_t.owner_id, 'reason', v_t.reason,
                       'object_found', p_outcome = 'purged'));
end;
$$;

revoke execute on function
  public.document_maintenance_batch(boolean, integer),
  public.document_purge_recheck(uuid),
  public.document_purge_record(uuid, text, text)
from public, anon;
grant execute on function
  public.document_maintenance_batch(boolean, integer),
  public.document_purge_recheck(uuid),
  public.document_purge_record(uuid, text, text)
to authenticated;
