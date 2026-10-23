-- Crew Flex — the third kind of in-app notice: «Distribuir aviso Urgente / AOG» (package outreach, v2 diff
-- 30 v2-17 / ORG-06; SCOPE-2 LATER, local only). Alone in its file: a new enum value must be committed
-- before any statement uses it (20261024400200 does: CHECK, partial index, RPC).
-- NON-DESTRUCTIVE: one enum value; nothing else changes.

alter type public.notification_kind add value if not exists 'outreach';
