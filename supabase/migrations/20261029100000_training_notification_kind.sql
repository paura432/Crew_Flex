-- Crew Flex — Training («Formación», CrewFlex v1.9, ADR-003, batch V19-01): the fourth kind of in-app
-- notice. Alone in its file, as 20261024400000 did: a new enum value must be committed before any
-- statement uses it (20261029100100 does: CHECK, columns, triggers, the read RPC).
-- NON-DESTRUCTIVE: one enum value; nothing else changes.

alter type public.notification_kind add value if not exists 'training';
