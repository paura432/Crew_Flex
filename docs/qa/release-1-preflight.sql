-- Release-1 preflight (step 0 of docs/qa/ROLLOUT_PLAN_2026-10-19.md). READ-ONLY: one SELECT inside a
-- read-only transaction; counts and catalog data only. Run: npx supabase db query --linked -f docs/qa/release-1-preflight.sql
begin transaction read only;
select json_build_object(
  'q1_users', (select count(*) from auth.users),
  'q1_orgs', (select count(*) from public.organizations),
  'q1_windows', (select count(*) from public.availability_windows),
  'q2_flags', (select coalesce(json_agg(json_build_object('name', name, 'enabled', enabled)), '[]'::json) from app_private.feature_flags),
  'q2_buckets', (select count(*) from storage.buckets),
  'q3_migrations', (select json_agg(version order by version) from supabase_migrations.schema_migrations),
  'q4_enum', (select enum_range(null::public.availability_status)::text),
  'q5_rotations_table', (select to_regclass('public.availability_rotations')::text),
  'q6_q7_replace_rpc_overloads', (select count(*) from pg_proc where proname = 'replace_availability_days'),
  'q8_lock_trigger', (select count(*) from pg_trigger where tgname = 'availability_windows_lock_owner'),
  'q9_check', (select pg_get_constraintdef(oid) from pg_constraint where conname = 'idempotency_keys_operation_check'),
  'q10_aog_only_rows', (select count(*) from public.availability_windows where status::text = 'aog_only'),
  'd_windows_by_status', (select coalesce(json_object_agg(s, n), '{}'::json) from (select status::text s, count(*) n from public.availability_windows group by 1) x),
  'd_idempotency_ops', (select coalesce(json_object_agg(o, n), '{}'::json) from (select operation o, count(*) n from app_private.idempotency_keys group by 1) y),
  'd_existing_objects', (select json_build_object(
      'lock_availability_owner', to_regprocedure('public.lock_availability_owner()') is not null,
      'ranked_external_pool', to_regprocedure('app_private.ranked_external_pool(uuid)') is not null,
      'is_feature_enabled', to_regproc('public.is_feature_enabled') is not null,
      'documents_table', to_regclass('public.professional_documents') is not null)),
  'tx_read_only', current_setting('transaction_read_only')
) as preflight;
rollback;
