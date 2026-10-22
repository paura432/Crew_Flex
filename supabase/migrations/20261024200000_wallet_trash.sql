-- Crew Flex — document wallet trash («Papelera», N-19; owner rule DEFAULTS of 2026-10-22: v1.8's
-- behaviour as a reversible technical default, T-100/T-101). LOCAL ONLY.
-- v1.8 demo (`Professional2.jsx:210-219`): «Archivar {título}» moves a document to «Papelera», «Ver wallet»
-- goes back, «Restaurar» returns it, and the empty trash says «Los documentos archivados pueden
-- restaurarse.»; the demo keeps archived documents forever (IndexedDB). Here an archived document can be
-- restored for a retention period (T-100: 30 days, a setting) and is then purged by the EXISTING wallet
-- machinery of 20261019160200 — no parallel one: the maintenance batch deletes the expired row, the AFTER
-- DELETE trigger leaves a tombstone with the new reason `trash_expired` (due at once) and
-- `documents-maintenance` removes the object through Storage, audited `document.purged`.
--
-- NON-DESTRUCTIVE: one nullable column, one partial index and one column grant on
-- `professional_documents`; one column with a default on `app_private.document_retention_settings`; the
-- tombstone `reason` CHECK re-created with every value it had plus `trash_expired`; one private helper,
-- one trigger function + BEFORE UPDATE trigger, one DEFINER read RPC; `create or replace` of four functions
-- of 20261019160000/160200 with the same signatures and grants (`audit_professional_document`,
-- `app_private.document_retention`, `tombstone_professional_document`, `document_maintenance_batch`), every
-- earlier rule kept; changes marked «N-19». No existing row, policy or grant is removed.
--
-- The wallet flag (`document_wallet`, 20261019160200) is unchanged: archiving and restoring are metadata
-- edits of the owner's own rows, which stay open when the flag is off (the gate only refuses NEW documents).
-- Archived documents stay owner-only (RLS unchanged) and count for nothing outside the trash (the app's
-- reads filter `archived_at is null`; T-101).

alter table public.professional_documents add column archived_at timestamptz;
comment on column public.professional_documents.archived_at is
  'N-19: in the trash since (database clock); null = in the wallet. Purged after archive_retention.';
create index professional_documents_archived_idx
  on public.professional_documents (archived_at) where archived_at is not null;
-- Owner-only RLS update policy unchanged; insert has no grant on the column (new documents start active).
grant update (archived_at) on public.professional_documents to authenticated;

-- The database clock decides when a document entered the trash: a client can neither backdate it (purge
-- sooner) nor post-date it (keep it past the retention). Archiving an archived document keeps its first
-- date; restoring clears it.
create function public.stamp_professional_document_archive()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.archived_at is distinct from old.archived_at then
    new.archived_at := case
      when new.archived_at is null then null
      when old.archived_at is null then now()
      else old.archived_at
    end;
  end if;
  return new;
end;
$$;
create trigger professional_documents_archive_clock
  before update of archived_at on public.professional_documents
  for each row execute function public.stamp_professional_document_archive();
revoke execute on function public.stamp_professional_document_archive() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Retention (T-100). Changed only by the database owner in SQL, like the other two settings:
--   update app_private.document_retention_settings set archive_retention = interval '30 days';
-- ---------------------------------------------------------------------------------------------
alter table app_private.document_retention_settings
  add column archive_retention interval not null default interval '30 days'
    check (archive_retention between interval '1 day' and interval '3650 days');

-- Body of 20261019160200; «N-19»: the fallback row carries the new column.
create or replace function app_private.document_retention()
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
    v := row(true, interval '30 days', interval '24 hours', now(), interval '30 days');
  end if;
  return v;
end;
$$;
revoke execute on function app_private.document_retention() from public, anon, authenticated;

-- One definition of «expired from the trash» for the triggers below (the maintenance batch uses the same
-- expression with the settings it already loaded, so the partial index serves it).
create function app_private.document_trash_expired(p_archived_at timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_archived_at is not null
    and p_archived_at <= now() - (app_private.document_retention()).archive_retention;
$$;
revoke execute on function app_private.document_trash_expired(timestamptz) from public, anon, authenticated;

-- What the trash page shows: «restorable for {n} days». Integer days, rounded up; signed-in users only.
create function public.document_trash_retention_days()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select ceil(extract(epoch from (app_private.document_retention()).archive_retention) / 86400)::integer;
$$;
revoke execute on function public.document_trash_retention_days() from public, anon;
grant execute on function public.document_trash_retention_days() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Tombstone reason `trash_expired` (purge-eligible at once: the owner archived it and let it expire).
-- ---------------------------------------------------------------------------------------------
alter table app_private.document_object_tombstones
  drop constraint document_object_tombstones_reason_check;
alter table app_private.document_object_tombstones
  add constraint document_object_tombstones_reason_check
  check (reason in ('owner_delete', 'account_deleted', 'operator_delete', 'orphan_upload', 'trash_expired'));

-- Body of 20261019160200; «N-19»: an expired trash document gets `trash_expired`, due now.
create or replace function public.tombstone_professional_document()
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
  elsif app_private.document_trash_expired(old.archived_at) then -- N-19
    v_reason := 'trash_expired';
  else
    v_reason := 'operator_delete';
  end if;
  insert into app_private.document_object_tombstones (storage_path, owner_id, reason, purge_after)
  values (old.storage_path, old.owner_id, v_reason,
          case when v_reason in ('owner_delete', 'trash_expired') then now()
               else now() + v_settings.account_deletion_grace end)
  on conflict (storage_path) where purged_at is null do nothing;
  return old;
end;
$$;
revoke execute on function public.tombstone_professional_document() from public, anon, authenticated;

-- Body of 20261019160000; «N-19»: archive and restore are audited as such (ids and flags only, S-9), and
-- a trash expiry is audited with the maintenance caller as actor (an account-deletion cascade still is not).
create or replace function public.audit_professional_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_changed text[];
begin
  if tg_op = 'INSERT' then
    insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
    values (v_actor, null, 'document.uploaded', 'professional_document', new.id,
      jsonb_build_object('technician_profile_id', new.owner_id, 'kind', new.kind,
                         'mime_type', new.mime_type, 'size_bytes', new.size_bytes,
                         'sha256', new.sha256));
    return new;
  elsif tg_op = 'UPDATE' then
    v_changed := array_remove(array[
      case when new.kind is distinct from old.kind then 'kind' end,
      case when new.title is distinct from old.title then 'title' end,
      case when new.expires_at is distinct from old.expires_at then 'expires_at' end,
      case when new.qualification_id is distinct from old.qualification_id then 'qualification_id' end,
      case when new.scan_status is distinct from old.scan_status then 'scan_status' end,
      case when new.archived_at is distinct from old.archived_at then 'archived_at' end -- N-19
    ], null);
    if cardinality(v_changed) > 0 then
      insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
      values (v_actor, null,
        case
          when new.archived_at is not distinct from old.archived_at then 'document.updated'
          when new.archived_at is null then 'document.restored'
          else 'document.archived'
        end,
        'professional_document', new.id,
        jsonb_build_object('technician_profile_id', new.owner_id, 'kind', new.kind,
                           'mime_type', new.mime_type, 'size_bytes', new.size_bytes,
                           'sha256', new.sha256, 'changed', to_jsonb(v_changed)));
    end if;
    return new;
  else
    if v_actor is not null and v_actor = old.owner_id then
      insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
      values (v_actor, null, 'document.deleted', 'professional_document', old.id,
        jsonb_build_object('technician_profile_id', old.owner_id, 'kind', old.kind,
                           'mime_type', old.mime_type, 'size_bytes', old.size_bytes,
                           'sha256', old.sha256));
    elsif app_private.document_trash_expired(old.archived_at) -- N-19
      and exists (select 1 from public.technician_profiles t where t.profile_id = old.owner_id) then
      insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
      values (v_actor, null, 'document.trash_expired', 'professional_document', old.id,
        jsonb_build_object('technician_profile_id', old.owner_id, 'kind', old.kind,
                           'mime_type', old.mime_type, 'size_bytes', old.size_bytes,
                           'sha256', old.sha256));
    end if;
    return old;
  end if;
end;
$$;
revoke execute on function public.audit_professional_document() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Body of 20261019160200; «N-19»: step 0 expires the trash before the reconciliation and the purge.
-- Dry-run lists the expired documents (`would_expire`) and writes nothing; apply deletes them (bounded
-- by the limit, oldest first): their tombstones are due at once, so the purge below returns their
-- objects in the same run. Platform admin only, re-checked here (S-10).
-- ---------------------------------------------------------------------------------------------
create or replace function public.document_maintenance_batch(p_apply boolean, p_limit integer)
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

  -- N-19: expired trash (same rule as app_private.document_trash_expired, written with the loaded
  -- settings so the partial index on archived_at serves it).
  if p_apply then
    return query
    with expired as (
      delete from public.professional_documents d
      where d.id in (
        select x.id from public.professional_documents x
        where x.archived_at is not null and x.archived_at <= now() - v_settings.archive_retention
        order by x.archived_at
        limit v_limit)
      returning d.storage_path
    )
    select null::uuid, e.storage_path, 'trash_expired'::text, 'expired'::text from expired e;
  else
    return query
    select null::uuid, x.storage_path, 'trash_expired'::text, 'would_expire'::text
    from public.professional_documents x
    where x.archived_at is not null and x.archived_at <= now() - v_settings.archive_retention
    order by x.archived_at
    limit v_limit;
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

  -- Due tombstones (in apply mode this includes the orphans and the expired trash just recorded).
  return query
  select t.id, t.storage_path, t.reason, 'purge'::text
  from app_private.document_object_tombstones t
  where t.purged_at is null and not t.legal_hold and t.purge_after <= now() and t.attempts < 10
    and not exists (select 1 from public.professional_documents d where d.storage_path = t.storage_path)
  order by t.purge_after
  limit v_limit;
end;
$$;
