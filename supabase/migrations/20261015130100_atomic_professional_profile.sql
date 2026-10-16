-- Crew Flex — atomic passport save (remediation 2026-10-15, finding I-3).
-- NON-DESTRUCTIVE: adds one SECURITY INVOKER function and its EXECUTE grant. No table, policy or
-- privilege change: the function can do exactly what the caller's column grants and RLS allow.
--
-- Why: `professional-profile` PATCH ran two separate PostgREST updates (technician_profiles, then
-- profiles.display_name). If the second failed the first stayed committed — a half-saved passport.
-- Now both updates run in one function call = one transaction: all or nothing.
--
-- Optimistic concurrency: the form sends the `updatedAt` it was rendered with. If the passport
-- changed since (another tab or device), the call fails with SQLSTATE CF412 (→ 409 CONFLICT) and
-- nothing is written, instead of silently overwriting the newer values. NULL skips the check.
-- Not 40001: PostgREST retries serialization failures automatically, which would loop on a stale
-- version (found by the local E2E run, 2026-10-15).
-- Precision is milliseconds because that is what the API exposes (JS Date). The version is
-- technician_profiles.updated_at (a language change must not invalidate an open passport form).

create function public.update_professional_profile(
  p_display_name text,
  p_base_location text,
  p_mobility public.mobility,
  p_years_experience integer,
  p_current_status public.technician_status,
  p_visibility public.profile_visibility,
  p_expected_updated_at timestamptz default null
)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_current timestamptz;
  v_rows integer;
  v_updated timestamptz;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  -- Own rows only (RLS), locked for the rest of the transaction. Not a professional → no row.
  -- Version = technician_profiles.updated_at: every passport save touches that row, while
  -- profiles.updated_at also moves on unrelated writes (language preference) — independent review L5.
  select tp.updated_at into v_current
  from public.technician_profiles tp
  join public.profiles p on p.id = tp.profile_id
  where tp.profile_id = v_uid
  for update of tp, p;
  if not found then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  if p_expected_updated_at is not null
     and date_trunc('milliseconds', v_current) <> date_trunc('milliseconds', p_expected_updated_at) then
    raise exception using errcode = 'CF412', message = 'profile was modified by another session';
  end if;

  update public.technician_profiles
  set base_location = p_base_location,
      mobility = p_mobility,
      years_experience = p_years_experience,
      current_status = p_current_status,
      visibility = p_visibility
  where profile_id = v_uid;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  update public.profiles set display_name = p_display_name where id = v_uid;
  if not found then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  select tp.updated_at into v_updated from public.technician_profiles tp where tp.profile_id = v_uid;

  return v_updated;
end;
$$;

revoke execute on function public.update_professional_profile(
  text, text, public.mobility, integer, public.technician_status, public.profile_visibility, timestamptz
) from public, anon;
grant execute on function public.update_professional_profile(
  text, text, public.mobility, integer, public.technician_status, public.profile_visibility, timestamptz
) to authenticated;
