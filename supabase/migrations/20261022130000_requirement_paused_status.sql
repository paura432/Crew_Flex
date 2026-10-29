-- Crew Flex — requirement status `paused` (M05, owner decision 2026-10-22; v1.8 «Pausada», server/app.mjs:88).
-- NON-DESTRUCTIVE: adds one enum value. Alone in its file because PostgreSQL cannot use a new enum value
-- in the transaction that adds it (same split as 20261019150000 for `aog_only`).
alter type public.requirement_status add value if not exists 'paused' after 'open';
