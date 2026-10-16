-- Crew Flex — integrity hardening (phase 0.8, docs/integration/crewflex-v13/05-data-model-gaps.md).
-- NON-DESTRUCTIVE: no DROP, no data change. Revokes three column/table privileges that no
-- application path uses, adds one CHECK, two triggers and audit for qualification writes.
--
-- Why: these business rules were enforced only in the Edge Functions, while the table grants let
-- a signed-in user reach PostgREST directly with their own JWT and skip them (audit finding
-- "Edge-Function-only rules"). The database is now the backstop; the functions keep their checks
-- (they give field-level messages, the DB gives a generic 400).

-- 1. A qualification's type is immutable after declaration (BR-2.8). The Edge Function never
--    sends it; the column grant allowed a direct UPDATE to swap a pending row's type.
revoke update (qualification_type_id) on public.technician_qualifications from authenticated;

-- 2. Technician profiles are created only by the sign-up trigger (handle_new_user, SECURITY
--    DEFINER). Without this, an organization account could self-insert a technician_profiles row
--    and appear as a professional. No application path inserts it.
revoke insert on public.technician_profiles from authenticated;

-- 3. BR-2.7: an ACTIVE qualification whose catalog type requires an expiry must carry one.
--    Withdrawn rows keep whatever they had (withdrawal is not a declaration).
create function public.enforce_qualification_expiry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'active' and new.expires_at is null and exists (
    select 1 from public.qualification_types t
    where t.id = new.qualification_type_id and t.requires_expiry
  ) then
    raise exception 'expiry date required for this qualification type'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger technician_qualifications_enforce_expiry
  before insert or update on public.technician_qualifications
  for each row execute function public.enforce_qualification_expiry();

-- 4. Availability windows are at most 366 days long, like work requirements (BR-4).
alter table public.availability_windows
  add constraint availability_windows_max_366_days
  check (ends_at <= starts_at + interval '366 days');

-- 5. Audit of the professional's own qualification writes (DATA_MODEL reserved
--    qualification.created / qualification.updated; adds qualification.removed).
--    Verifier-only status changes keep their own event (qualification.verified). A removal is
--    audited only when the owner deletes the row, not when an account deletion cascades.
create function public.audit_qualification_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
    values (v_actor, null, 'qualification.created', 'technician_qualification', new.id,
      jsonb_build_object('technician_profile_id', new.technician_profile_id,
                         'qualification_type_id', new.qualification_type_id,
                         'status', new.status,
                         'verification_status', new.verification_status));
    return new;
  elsif tg_op = 'UPDATE' then
    if (new.status, new.issued_at, new.expires_at, new.qualification_type_id)
       is distinct from (old.status, old.issued_at, old.expires_at, old.qualification_type_id) then
      insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
      values (v_actor, null, 'qualification.updated', 'technician_qualification', new.id,
        jsonb_build_object('technician_profile_id', new.technician_profile_id,
                           'qualification_type_id', new.qualification_type_id,
                           'status', new.status,
                           'previous_verification_status', old.verification_status,
                           'verification_status', new.verification_status));
    end if;
    return new;
  else
    if v_actor is not null and v_actor = old.technician_profile_id then
      insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
      values (v_actor, null, 'qualification.removed', 'technician_qualification', old.id,
        jsonb_build_object('technician_profile_id', old.technician_profile_id,
                           'qualification_type_id', old.qualification_type_id,
                           'verification_status', old.verification_status));
    end if;
    return old;
  end if;
end;
$$;
create trigger technician_qualifications_audit_change
  after insert or update or delete on public.technician_qualifications
  for each row execute function public.audit_qualification_change();

revoke execute on function
  public.enforce_qualification_expiry(),
  public.audit_qualification_change()
from public, anon, authenticated;
