-- Crew Flex — qualification catalog: the v1.8 categories Next did not have (package passport, N-01).
-- NON-DESTRUCTIVE: insert-only, idempotent reference data (needed in every environment, like
-- 20261009120100). No table, policy or privilege change.
--
-- v1.8 `CATEGORIES` (src/business.js:7): B1.1, B1.2, B1.3, B1.4, B2, B3, Cat A, Cat C, Mecánico, Sheet Metal,
-- NDT, Helper. The catalog already had B1.1, B1.3, B2, CAT-A, CAT-C and NDT-UT2. Technical default T-30
-- (docs/integration/crewflex-v13/08-product-decisions.md): the three missing Part-66 licences are LICENSE
-- types with a mandatory expiry (BR-2.7, like the others); the three trades are SKILL types without one.
-- Their names stay in English like the rest of the catalog (aeronautical convention, NX-12).

insert into public.qualification_types (code, name, category, requires_expiry) values
  ('B1.2', 'Part-66 B1.2 — Aeroplanes, piston', 'LICENSE', true),
  ('B1.4', 'Part-66 B1.4 — Helicopters, piston', 'LICENSE', true),
  ('B3', 'Part-66 B3 — Piston aeroplanes, non-pressurised, up to 2000 kg MTOM', 'LICENSE', true),
  ('MECHANIC', 'Aircraft mechanic (non-certifying)', 'SKILL', false),
  ('SHEET-METAL', 'Sheet metal and structures repair', 'SKILL', false),
  ('HELPER', 'Maintenance helper', 'SKILL', false)
on conflict (code) do nothing;
