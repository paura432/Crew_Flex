-- Crew Flex — "available only for AOG" availability (owner decision C-8 / D-05, 2026-10-19).
-- NON-DESTRUCTIVE: adds one enum value. Kept alone in its migration because PostgreSQL cannot use
-- a new enum value in the transaction that adds it; the rules that use it are in 20261019150100.
alter type public.availability_status add value if not exists 'aog_only';
