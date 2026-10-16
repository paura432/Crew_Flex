-- Crew Flex — user interface language preference (phases 1.5/1.6, docs/product/I18N_STRATEGY.md).
-- NON-DESTRUCTIVE: adds one nullable column and one column grant. No DROP, no data change.
--
-- `preferred_locale` is owned by the authenticated user: the existing policy `profiles_update_own`
-- (id = auth.uid()) applies, and the grant below is a column grant like `display_name`.
-- NULL = never chosen → the UI falls back to the locale cookie, the browser language, then 'en'.
alter table public.profiles
  add column preferred_locale text
  check (preferred_locale in ('es', 'en'));

comment on column public.profiles.preferred_locale is
  'UI language chosen by the user (es|en). NULL = not chosen; cookie/browser decide.';

grant update (preferred_locale) on public.profiles to authenticated;
