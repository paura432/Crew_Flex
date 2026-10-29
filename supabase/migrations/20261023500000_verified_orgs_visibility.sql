-- Crew Flex — «Empresas verificadas» visibility (v2 diff 20 N-09 / 10 #13; OD-5 default = v1.8
-- `Professional2.jsx` «Perfil anónimo para organizaciones verificadas.»; T-50).
-- NON-DESTRUCTIVE: adds one enum value, placed in the v1.8 order (Privado · Anónimo · Empresas
-- verificadas · Abierto). Kept alone in its migration because PostgreSQL cannot use a new enum value
-- in the transaction that adds it; the pool rule that uses it is in 20261023500200.
alter type public.profile_visibility add value if not exists 'verified_orgs' before 'open';
