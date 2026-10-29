-- Crew Flex — trigger-only SECURITY DEFINER functions are no longer callable by API roles (F1b, 2026-10-26).
-- NON-DESTRUCTIVE: three REVOKEs. No table, column, policy, function body or data change.
--
-- Supabase Security Advisor (production, 2026-10-26): `authenticated_security_definer_function_executable`
-- lists `handle_new_user`, `audit_requirement_created` and `audit_qualification_verified`. They return
-- `trigger` and only ever run from their triggers (`on_auth_user_created`, `work_requirements_audit_created`,
-- `technician_qualifications_audit_verified`); PostgreSQL checks EXECUTE when a trigger is created, not when it
-- fires, so sign-up and the audit trail keep working. Same pattern as `lock_availability_owner` and
-- `enforce_requirement_qualifications`. `create or replace` of these functions in later migrations keeps the
-- revocation; a DROP + CREATE must repeat it.

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.audit_requirement_created() from public, anon, authenticated;
revoke execute on function public.audit_qualification_verified() from public, anon, authenticated;
