-- Crew Flex — qualification catalog V0 (reference data, needed in every environment).
-- NON-DESTRUCTIVE: insert-only, idempotent.
-- Codes follow EASA Part-66 licence categories, type ratings (TR-*) and mandatory continuation
-- training as used in the prototype. "Fuel Tank Safety" = FTS, "Human Factors" = HF (one code each).

insert into public.qualification_types (code, name, category, requires_expiry) values
  ('B1.1', 'Part-66 B1.1 — Aeroplanes, turbine', 'LICENSE', true),
  ('B1.3', 'Part-66 B1.3 — Helicopters, turbine', 'LICENSE', true),
  ('B2', 'Part-66 B2 — Avionics', 'LICENSE', true),
  ('CAT-A', 'Part-66 Category A — Line maintenance certifying mechanic', 'LICENSE', true),
  ('CAT-C', 'Part-66 Category C — Base maintenance', 'LICENSE', true),
  ('TR-A320', 'Type rating — Airbus A320 family', 'TYPE_RATING', false),
  ('TR-A330', 'Type rating — Airbus A330', 'TYPE_RATING', false),
  ('TR-A350', 'Type rating — Airbus A350', 'TYPE_RATING', false),
  ('TR-B737', 'Type rating — Boeing 737', 'TYPE_RATING', false),
  ('TR-B787', 'Type rating — Boeing 787', 'TYPE_RATING', false),
  ('TR-ATR72', 'Type rating — ATR 72', 'TYPE_RATING', false),
  ('EWIS', 'Electrical Wiring Interconnection System', 'TRAINING', true),
  ('HF', 'Human Factors', 'TRAINING', true),
  ('FTS', 'Fuel Tank Safety', 'TRAINING', true),
  ('SMS', 'Safety Management System', 'TRAINING', true),
  ('NDT-UT2', 'NDT ultrasonic testing level 2', 'APPROVAL', true),
  ('BORESCOPE', 'Borescope inspection', 'SKILL', false)
on conflict (code) do nothing;
