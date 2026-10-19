-- Crew Flex — document wallet for professionals (owner decision D-10, 2026-10-19). LOCAL ONLY.
-- NON-DESTRUCTIVE: adds two enums, one table, one private Storage bucket, four Storage policies,
-- three trigger functions, one SECURITY INVOKER RPC and widens one CHECK (adds an allowed value).
-- Nothing is dropped, no existing row, policy or grant changes. Design and threat model:
-- docs/product/DOCUMENT_WALLET.md.
--
-- Owner rules (D-10): private bucket · RLS · owner access only · type and size validation ·
-- protection against manipulated names and paths · third-party access only when expressly
-- authorised · relevant accesses logged · never public URLs · WITHOUT AN APPROVED FILE-SCANNING
-- MECHANISM, NO SHARING WITH THIRD PARTIES. Therefore:
--   - the only policies are the owner's own (select/insert/update/delete). There is NO
--     organization, manager or platform-admin policy on the table or on the bucket's objects;
--   - `scan_status` defaults to 'not_scanned' and `authenticated` cannot write it (column grants).
--     Nothing in this migration can set 'clean'; a future, approved scanner and any sharing path
--     are separate owner decisions and separate migrations.
--
-- Bytes live in the private bucket `professional-documents` under `<owner uuid>/<idempotency key>-
-- <first 16 hex of sha256>`. The Edge Function `professional-documents` derives that path, the mime
-- type (magic bytes), the size and the hash from the uploaded bytes; the client never sends them.
-- The row is the source of truth: an object without a row is an orphan (cleanup is an operations
-- task, DOCUMENT_WALLET.md §6); a row without its object cannot be created (insert trigger) and the
-- object of an existing row cannot be deleted (Storage delete policy), so delete = row, then object.
--
-- Concurrency: no per-owner advisory lock. There is no cross-row invariant to protect (no document
-- count limit, no ordering, no "last document" rule). Duplicate submissions of one upload share an
-- Idempotency-Key: the second claim blocks on the key's unique index until the first commits and
-- then replays; `storage_path` is UNIQUE, so two rows can never share one object.
--
-- Errors: 42501 not signed in / RLS · 22023 path not derived from (owner, key, hash) · 23514 CHECK,
-- missing object, other user's qualification · CF409 same key with another request.

create type public.document_kind as enum ('license', 'course', 'other');
create type public.document_scan_status as enum ('not_scanned', 'clean', 'infected');

create table public.professional_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.technician_profiles (profile_id) on delete cascade,
  kind public.document_kind not null,
  title text not null check (char_length(title) between 1 and 180),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf', 'image/png', 'image/jpeg')),
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  expires_at date,
  qualification_id uuid references public.technician_qualifications (id) on delete set null,
  scan_status public.document_scan_status not null default 'not_scanned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- `<owner>/<uuid>-<16 hex>`: one folder per owner, no other separator, no `..`, no user text.
  constraint professional_documents_storage_path_check check (
    left(storage_path, 37) = owner_id::text || '/'
    and storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[0-9a-f]{16}$'
  )
);
alter table public.professional_documents enable row level security;
create index professional_documents_owner_created_idx
  on public.professional_documents (owner_id, created_at desc);
create index professional_documents_qualification_idx
  on public.professional_documents (qualification_id) where qualification_id is not null;

create trigger professional_documents_set_updated_at before update on public.professional_documents
  for each row execute function public.set_updated_at();

-- Owner only. `scan_status`, `storage_path`, `mime_type`, `size_bytes`, `sha256` and `owner_id`
-- are fixed at insert and never updatable by users.
revoke all on table public.professional_documents from public, anon, authenticated;
grant select, delete on public.professional_documents to authenticated;
grant insert (owner_id, kind, title, storage_path, mime_type, size_bytes, sha256, expires_at, qualification_id)
  on public.professional_documents to authenticated;
grant update (kind, title, expires_at, qualification_id) on public.professional_documents to authenticated;

create policy professional_documents_select_own on public.professional_documents
  for select to authenticated using (owner_id = (select auth.uid()));
create policy professional_documents_insert_own on public.professional_documents
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy professional_documents_update_own on public.professional_documents
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy professional_documents_delete_own on public.professional_documents
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Database backstops (they hold for direct PostgREST writes too, not only for the RPC):
--   - a linked qualification belongs to the document's owner (missing and foreign look the same);
--   - a new row points at an existing object of the bucket, of the declared size when Storage
--     recorded one. SECURITY INVOKER: the caller sees only their own objects (Storage policy).
create function public.enforce_professional_document()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.qualification_id is not null and not exists (
    select 1 from public.technician_qualifications q
    where q.id = new.qualification_id and q.technician_profile_id = new.owner_id
  ) then
    raise exception using errcode = '23514', message = 'qualification must belong to the document owner';
  end if;
  if tg_op = 'INSERT' and not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'professional-documents' and o.name = new.storage_path
      and (o.metadata ->> 'size' is null or (o.metadata ->> 'size')::bigint = new.size_bytes)
  ) then
    raise exception using errcode = '23514', message = 'document object not found';
  end if;
  return new;
end;
$$;
create trigger professional_documents_enforce
  before insert or update of qualification_id on public.professional_documents
  for each row execute function public.enforce_professional_document();

-- Audit (S-9): ids, kind, type, size and hash only — never the title, the path or the bytes.
-- A removal is audited when the owner deletes the row (the only delete policy), not when an
-- account deletion cascades.
create function public.audit_professional_document()
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
      case when new.scan_status is distinct from old.scan_status then 'scan_status' end
    ], null);
    if cardinality(v_changed) > 0 then
      insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
      values (v_actor, null, 'document.updated', 'professional_document', new.id,
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
    end if;
    return old;
  end if;
end;
$$;
create trigger professional_documents_audit_change
  after insert or update or delete on public.professional_documents
  for each row execute function public.audit_professional_document();

revoke execute on function
  public.enforce_professional_document(),
  public.audit_professional_document()
from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Private bucket. ON CONFLICT DO NOTHING keeps an existing bucket untouched, so the block after it
-- fails the migration instead of silently accepting a pre-existing bucket with weaker settings.
-- ---------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('professional-documents', 'professional-documents', false, 5242880,
        array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from storage.buckets b
    where b.id = 'professional-documents'
      and b.public is false
      and b.file_size_limit = 5242880
      and b.allowed_mime_types::text[] @> array['application/pdf', 'image/png', 'image/jpeg']
      and b.allowed_mime_types::text[] <@ array['application/pdf', 'image/png', 'image/jpeg']
  ) then
    raise exception 'bucket professional-documents exists with unexpected settings (must be private, 5 MiB, pdf/png/jpeg)';
  end if;
end;
$$;

-- Storage RLS for the bucket: the owner's folder only. No UPDATE policy (objects are immutable:
-- uploads use upsert = false). Insert accepts only the server-derived name shape. Delete is refused
-- while a document row still points at the object, so a row can never lose its bytes.
create policy professional_documents_objects_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'professional-documents'
         and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy professional_documents_objects_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'professional-documents'
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[0-9a-f]{16}$');
create policy professional_documents_objects_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'professional-documents'
         and (storage.foldername(name))[1] = (select auth.uid())::text
         and not exists (select 1 from public.professional_documents d
                         where d.storage_path = objects.name));

-- ---------------------------------------------------------------------------------------------
-- Idempotent create (Idempotency-Key, like 20261015130200). Owner = JWT subject. The object path
-- must be the one derived from (owner, key, hash), so a retried upload of the same file reuses its
-- object and another file under the same key gets another path and then CF409.
-- ---------------------------------------------------------------------------------------------
alter table app_private.idempotency_keys
  drop constraint idempotency_keys_operation_check;
alter table app_private.idempotency_keys
  add constraint idempotency_keys_operation_check
  check (operation in ('work_requirement.create', 'availability_window.create', 'qualification.declare',
                       'availability_days.replace', 'document.create'));

create function public.create_professional_document(
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

revoke execute on function public.create_professional_document(uuid, public.document_kind, text, text,
  text, integer, text, date, uuid) from public, anon;
grant execute on function public.create_professional_document(uuid, public.document_kind, text, text,
  text, integer, text, date, uuid) to authenticated;
