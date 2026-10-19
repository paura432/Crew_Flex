-- Crew Flex — document wallet hardening after the independent security review (D-10). LOCAL ONLY.
-- NON-DESTRUCTIVE for data: replaces one Storage policy and one trigger function body (no row,
-- table, column or grant changes). 20261019160000 is already applied locally, so it is not edited.
--
-- 1. (review M-2) Only professionals may upload into the bucket. Before, any signed-in account
--    (organization accounts, fresh sign-ups) could fill its own folder through the Storage API;
--    such objects could never get a row (owner FK → technician_profiles) and only piled up.
-- 2. (review L-2) The insert backstop fails closed: the object must carry a recorded size equal
--    to `size_bytes` (hosted Storage always records it).

drop policy professional_documents_objects_insert_own on storage.objects;
create policy professional_documents_objects_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'professional-documents'
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[0-9a-f]{16}$'
              and exists (select 1 from public.technician_profiles t
                          where t.profile_id = (select auth.uid())));

create or replace function public.enforce_professional_document()
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
      and o.metadata ->> 'size' ~ '^[0-9]{1,10}$'
      and (o.metadata ->> 'size')::bigint = new.size_bytes
  ) then
    raise exception using errcode = '23514', message = 'document object not found';
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_professional_document() from public, anon, authenticated;
