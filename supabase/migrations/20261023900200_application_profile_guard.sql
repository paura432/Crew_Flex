-- Crew Flex — the v1.8 profile requirements at apply and confirm, and v1.8's confirmation gate for declared
-- general restrictions (package matching-v18; BR-3.7–3.13, BR-13/BR-15, T-87; v2 diff 30 HIRE-04 #3, 20 N-02).
-- NON-DESTRUCTIVE: one trigger function and one BEFORE trigger on public.applications. No table, column,
-- policy, grant or data changes; apply_to_requirement and transition_application keep their bodies.
--
-- Why a trigger: every application row is written by those two DEFINER RPCs (no table grant), and both already
-- re-check qualifications (CFA03) and availability (CFA04) through app_private.hard_eligibility before the
-- write. The new checks run on that same write, so they cover both RPCs (and any later write path) without
-- copying their bodies:
--   * INSERT (apply, T-08: eligible now) and UPDATE to `confirmed` (the confirm re-check of everything):
--     hard_eligibility(...).profile_ok — work permit, category, aircraft, type rating, engines, years,
--     capabilities — else SQLSTATE CFA14 = PROFILE_REQUIREMENTS_UNMET (src/domain/applications.ts).
--   * UPDATE to `confirmed` only: the professional declares general restrictions (BR-18) → CFA15 =
--     RESTRICTIONS_DECLARED. v1.8 connected `server/app.mjs:122` refuses the confirmation with «Perfil o
--     restricciones pendientes de revisión.»; it does not refuse applying, and neither does this.
-- The RPC's own checks come first (CFA01…CFA06 keep their order); a failure rolls back the whole transaction,
-- the Idempotency-Key claim included.

create function public.guard_application_profile_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_confirming boolean := new.status = 'confirmed'
    and (tg_op = 'INSERT' or old.status is distinct from 'confirmed');
begin
  if tg_op = 'UPDATE' and not v_confirming then
    return new;
  end if;
  if not coalesce((
    select e.profile_ok
    from app_private.hard_eligibility(new.requirement_id, new.technician_profile_id) e
  ), false) then
    raise exception using errcode = 'CFA14',
      message = 'the professional does not meet the profile requirements';
  end if;
  if v_confirming and exists (
    select 1 from public.technician_profiles tp
    where tp.profile_id = new.technician_profile_id and tp.general_restrictions is not null
  ) then
    raise exception using errcode = 'CFA15',
      message = 'the professional declares general restrictions';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_application_profile_rules() from public, anon, authenticated;

create trigger applications_profile_rules
  before insert or update of status on public.applications
  for each row execute function public.guard_application_profile_rules();
