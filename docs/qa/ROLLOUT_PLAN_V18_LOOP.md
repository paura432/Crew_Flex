# Publication plan — `feat/v18-html-parity` (v1.8 loop of 2026-10-21/22) · FOR OWNER APPROVAL · NOT EXECUTED

> Written 2026-10-22. **Nothing here has been run against production.** Every step needs its own explicit owner
> approval (AGENTS.md «STOP»; OD-9 main-only: a push to `main` is a production deploy). This plan is SEPARATE from
> `ROLLOUT_PLAN_RELEASE2.md` (release 2 = `65df3b9..51c835a`, still undecided: deploy its backend or roll Vercel back).
> Living document: the SCOPE-2 packages still being merged add migrations/functions; §2 lists the state at the last
> update and must be re-read from `git log origin/main..<release-sha>` before any step.

## 0. Production today and the first, separate step: the X-01 hotfix

- Production frontend: `origin/main` = `51c835a` (Vercel), backend = release 1 (15 migrations, 8 functions). The
  landing «Iniciar sesión» is **white on white** there (X-01, P1, read-only GET confirmed 2026-10-22).
- **Hotfix candidate:** local branch `hotfix/x01-landing-signin` = `15eb913` on top of `51c835a` — 3 source files
  (`src/app/page.tsx`, `src/components/ui/Button.tsx`, `src/features/preferences/components/LocaleSwitcher.tsx`), no
  backend change, compatible with the release-1 backend. Verified locally: typecheck, lint, 418 tests, `next build`,
  `next start` with computed colours at 1440/390 es/en.
- **Candidate with the dependency patches (2026-10-26):** local branch `hotfix/x01-deps` = `352182c` = `15eb913` +
  `fix/next-16.4.3` (`dc1b421`, §6). Gate on `352182c`: `pnpm check` 0 (Vitest 418 passed / 32 skipped, Deno 74),
  `pnpm build` 0 with no advisory nudge, `git diff --check` clean, `next start` landing 200 with «Sign in» → `/login`.
- Scope check of `352182c` (2026-10-26): `git diff 51c835a 352182c` = 7 files — the 3 X-01 sources (`15eb913`) and
  `package.json`, `pnpm-lock.yaml`, `supabase/functions/deno.json`, `deno.lock` (`fdf085b`, `dc1b421`); no migration, no
  function source; `51c835a` is an ancestor (fast-forward). Independent review of the dependency commits: APPROVE.
- Step H1 (owner): `git push origin 352182c:main` (fast-forward of `51c835a`; `15eb913` alone if the owner wants the
  hotfix without the dependency patches). Preconditions: `origin/main` still `51c835a` (`git ls-remote`), the gate of
  `352182c` above. Step H2 (checks): GitHub commit status `Vercel: success` for `352182c`; https://crew-flex.vercel.app/
  shows a readable «Iniciar sesión»; `/login` renders; no new CSP report in DevTools.
- Rollback of H1, from the real parents of `352182c` (first `15eb913` = X-01, second `dc1b421` = dependencies),
  rehearsed 2026-10-26 in a throw-away worktree: `git revert -m 1 352182c` → tree identical to `15eb913` (dependencies
  out, X-01 kept); then `git revert 15eb913` → tree identical to `51c835a`. Each push needs its own approval. Immediate
  alternative without a push: Vercel «Promote» of GitHub deployment `7203981813` (= `51c835a`, 2026-10-20 15:32:56 UTC);
  Vercel then stops auto-promoting new `main` builds until a deployment is promoted again — check it after. Re-applying
  the dependencies later needs a revert of the revert (git will not merge `dc1b421` twice).
- If release 2 is pushed first, cherry-pick `ef4d9b7` (same fix on the branch) instead.

## 0b. Production Auth settings — independent of any release, before any real sign-up

Read 2026-10-26 (Management API `GET config/auth`, non-secret fields): `site_url` = `http://localhost:3000`,
`uri_allow_list` empty, `password_min_length` 6, `password_hibp_enabled` false; `mailer_autoconfirm` false; the
confirmation and recovery templates use `{{ .ConfirmationURL }}`; built-in SMTP (no custom host, `rate_limit_email_sent`
2). Effect today, read from the code: the production frontend (`51c835a`) signs up without `emailRedirectTo`, so the
confirmation link falls back to `site_url` = localhost; recovery asks `${origin}/auth/confirm?next=/reset-password`
(`src/features/auth/actions.ts:157`), which an empty allow-list rejects → also localhost. **Neither link works.**

| Setting                 | Before (2026-10-26)     | Proposed                                                                              | Why                                                                                                                                                                                               |
| ----------------------- | ----------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `site_url`              | `http://localhost:3000` | `https://crew-flex.vercel.app`                                                        | Fallback of every e-mail link; today's sign-up uses it                                                                                                                                            |
| `uri_allow_list`        | (empty)                 | `https://crew-flex.vercel.app/auth/confirm**,https://crew-flex.vercel.app/register**` | Recovery and (branch) sign-up land on `/auth/confirm?next=…` (`actions.ts:135,174` on the branch); invitations on `/register?invite=` (`supabase/functions/invitations/index.ts:40`); same origin |
| `password_min_length`   | 6                       | 12                                                                                    | Q-01; the branch asks 12 (`PASSWORD_MIN`). Today's frontend asks 10: a 10–11 character password gets «Elige una contraseña más segura.» until the branch ships                                    |
| `password_hibp_enabled` | false                   | true                                                                                  | Advisor WARN `auth_leaked_password_protection`; a paid-plan feature — if the API refuses it, leave false and record                                                                               |

**Owner-decision item, NOT in the PATCH above and not applied (P14b-S1, security review 2026-10-28, Medium):** read `jwt_exp`
first (unread on 2026-10-26; the read-only `GET config/auth` below) and decide whether to set it to 600 s together with local
`supabase/config.toml:167` (`jwt_expiry`): after a password reset an already-issued access token keeps working for `jwt_exp`
seconds although every refresh token is revoked (`docs/product/SECURITY_PRIVACY.md` §T22 residual). Nothing is applied by this
plan without the owner.

Not in this step (owner decisions): custom SMTP — the built-in sender only reaches the organization's team addresses,
2 e-mails per hour, so real users get no confirmation or recovery mail until it exists (OD-8); the branch's
`supabase/templates/confirmation.html` (§3 step 3).

Command (one owner approval; scoped token with **Auth Config read-write** on this project only):

```bash
set -a; . <owner token file>; set +a   # SUPABASE_ACCESS_TOKEN=sbp_fc… — outside the repo, never printed
curl -sS -X PATCH https://api.supabase.com/v1/projects/sbjkzrkmcekokkqiuvvh/config/auth \
  -H @<(printf 'Authorization: Bearer %s\n' "$SUPABASE_ACCESS_TOKEN") -H 'Content-Type: application/json' \
  -d '{"site_url":"https://crew-flex.vercel.app","uri_allow_list":"https://crew-flex.vercel.app/auth/confirm**,https://crew-flex.vercel.app/register**","password_min_length":12,"password_hibp_enabled":true}'
```

Rollback: the same PATCH with the «Before» column —
`{"site_url":"http://localhost:3000","uri_allow_list":"","password_min_length":6,"password_hibp_enabled":false}`.
Checks after: (0) before anything, `GET config/auth` (read-only) records `jwt_exp` too, for the P14b-S1 decision; (1) `GET config/auth` shows the four values (read-only); (2) «¿Olvidaste tu contraseña?» for an existing
account whose address is a team member's → the link opens `https://crew-flex.vercel.app/auth/confirm?…` and ends on
`/reset-password`; (3) a sign-up with a team-member address → the link confirms and lands on `crew-flex.vercel.app`;
(4) a 10-character password is refused. (2)–(4) create mail or users in production: one approval each, cleanup by
`scripts/e2e/cleanup-synthetic.sh` rules.

Compatibility with the deployed frontend, rehearsed locally 2026-10-26: the `352182c` build (`next start -p 3001`)
against local GoTrue with minimum 12 and an allow-list admitting `localhost:3001/**` (`supabase/config.toml`): a
10-character password → «Choose a stronger password.» (`weak_password` mapped); 16 characters → «Check your inbox»; the
confirmation link carries `redirect_to` = `site_url` and `/verify` answers 303 to `site_url?code=…`, the account is
confirmed and the landing answers 200 with `?code`; recovery carries `redirect_to` =
`http://localhost:3001/auth/confirm?next=/reset-password` and ends on `/reset-password` with the form. Production
equivalent: links on `https://crew-flex.vercel.app`. Not covered by the rehearsal: the exact `/auth/confirm**` glob
(local uses `/**`; both match the query) and `password_hibp_enabled` (no local equivalent). Domains other than
`crew-flex.vercel.app` (Vercel deployment URLs) are not in the list on purpose: their links fall back to `site_url`.

## 0c. Management token — replace the current one with a Crew_Flex-only read token

Today (2026-10-26): a scoped token `sbp_fc…` reaching Crew_Flex and one other project of the owner, no organization;
write permissions unknown (not probed). Kept in an owner-local file outside the repository, never in Git, docs or the
memory bank. Procedure (owner, dashboard «Account → Access Tokens»):

1. Preconditions: the current token still answers (`GET /v1/projects/sbjkzrkmcekokkqiuvvh` → 200); no remote step in
   progress.
2. Generate a **scoped** token: project Crew_Flex only; permissions **Read** — Project Settings, Advisors, Migrations,
   Edge Functions, Auth Config, Data API Config (Database Read only if typed reads are wanted); expiry 30 days or less.
3. The owner writes it into the same owner-local file (editor, not chat). Checks (read-only): `GET /v1/projects` lists
   only Crew_Flex; `database/migrations`, `functions`, `config/auth`, `postgrest`, `advisors/security` answer 200.
4. Confirm no other tool or session still uses the old token, then revoke it in the dashboard. Rollback before step 4: keep using the old one; after it: generate
   another read token (step 2).
5. Writes (§0b, functions deploy, secrets) use a separate token created for that window — the matching **Read-write**
   permissions only, expiry 1–7 days — revoked when the step is done.

## 1. What the branch adds (state at `8fa806a`, 2026-10-23; rows 37–39 added 2026-10-26, row 40 added 2026-10-27 — P10; `work-requirements` must be deployed no earlier than that migration: the new function calls the 23-argument overloads)

Fifteen implementation packages of the v2 diff on top of X-01…X-22, M05/M07/M08/M09 (`15-autonomous-migration-backlog.md`
§6.3 has each package's commits, gates and technical defaults T-01…T-148; `08-product-decisions.md` the defaults;
`BUSINESS_RULES.md` BR-1…BR-29). **42 migrations** not applied anywhere but the local Docker DB, in file order:

| #   | File (apply in this order — `db push` applies pending files in file order) | Package                                      |
| --- | -------------------------------------------------------------------------- | -------------------------------------------- |
| 1   | `20261021120000_availability_version`                                      | W5 availability version                      |
| 2   | `20261022130000_requirement_paused_status`                                 | M05 paused                                   |
| 3   | `20261022130100_requirement_lifecycle`                                     | M05 lifecycle                                |
| 4   | `20261022130200_opportunities`                                             | M07 opportunities                            |
| 5   | `20261022130300_applications`                                              | M08 applications                             |
| 6   | `20261023100000_passport_catalog`                                          | passport                                     |
| 7   | `20261023100100_passport_declarations`                                     | ?                                            |
| 8   | `20261023100200_passport_save`                                             | ?                                            |
| 9   | `20261023100300_passport_pool_visibility`                                  | ?                                            |
| 10  | `20261023200000_logbook_entries`                                           | logbook                                      |
| 11  | `20261023300000_assignment_protection`                                     | calendar                                     |
| 12  | `20261023400000_account_invitations`                                       | account                                      |
| 13  | `20261023400100_account_closure`                                           | ?                                            |
| 14  | `20261023500000_verified_orgs_visibility`                                  | admin-org                                    |
| 15  | `20261023500100_organization_review`                                       | ?                                            |
| 16  | `20261023500200_verified_orgs_pool`                                        | ?                                            |
| 17  | `20261023500300_platform_summary`                                          | ?                                            |
| 18  | `20261023500400_organization_review_former_members`                        | ?                                            |
| 19  | `20261023600000_requirement_terms`                                         | requirement-builder                          |
| 20  | `20261023600100_requirement_builder_rpcs`                                  | ?                                            |
| 21  | `20261023800000_notifications`                                             | notices                                      |
| 22  | `20261023900000_requirement_profile_rules`                                 | matching-v18                                 |
| 23  | `20261023900100_profile_rules_matching`                                    | ?                                            |
| 24  | `20261023900200_application_profile_guard`                                 | ?                                            |
| 25  | `20261024100000_hiring_polish_opportunities`                               | hiring-polish                                |
| 26  | `20261024100100_organization_applications`                                 | ?                                            |
| 27  | `20261024100900_matching_v18_organization_applications`                    | matching-v18 (re-create after hiring-polish) |
| 28  | `20261024200000_wallet_trash`                                              | wallet-extras                                |
| 29  | `20261024200100_availability_past_start`                                   | ?                                            |
| 30  | `20261024300000_application_packs`                                         | pack-view                                    |
| 31  | `20261024400000_notification_kind_outreach`                                | outreach                                     |
| 32  | `20261024400100_notice_preferences`                                        | ?                                            |
| 33  | `20261024400200_requirement_outreach`                                      | ?                                            |
| 34  | `20261024500000_represented_clients`                                       | recruiter                                    |
| 35  | `20261024500100_requirement_client`                                        | ?                                            |
| 36  | `20261024600000_visible_network_count`                                     | shell-visual                                 |
| 37  | `20261024700000_candidate_directory`                                       | directory (search-only)                      |
| 38  | `20261024800000_professional_block_opportunities`                          | professional-block (v2-16)                   |
| 39  | `20261026100000_revoke_trigger_function_execute`                           | F1b security (REVOKE only)                   |
| 40  | `20261027100000_requirement_profile_rules_builder`                         | P10 needs and matching (builder rules)       |
| 41  | `20261027200000_requirement_cards_client`                                  | P11 recruiter (card names the client, T-169) |
| 42  | `20261027300000_qualification_review_evidence`                             | P12 admin (review evidence table, T-170)     |

**Edge Functions** (22 directories): **new, never deployed** — `account`, `applications`, `invitations`, `notice-preferences`, `notifications`, `opportunities`, `organization-profile`, `organization-reviews`, `professional-logbook`, `represented-clients`, `requirement-outreach`;
**changed since release 1** — `work-requirements`, `capacity-evaluate`, `matching-evaluate`, `professional-profile`, `professional-qualifications`, `professional-availability`, `user-preferences` (every one of them parses the new schema/statuses and
accepts new parameters; the deployed versions answer 500/400 on them); **release-2 functions still undeployed** —
`professional-documents`, `documents-maintenance`, `qualification-reviews` (wallet + OD-3 review, both behind flags). The directory package (merged `47b467e`) added
`20261024700000` and `candidate-directory`. The professional-block package (v2-16, `20261024800000`) changes no
function code but the shared `APPLICATION_CONFLICTS` (CFA16): deploy `applications` **no later than** that migration
(the new function on the old SQL never sees CFA16, harmless; an older `applications` on the new SQL answers 500 instead
of 409 `ORGANIZATION_BLOCKED`); `opportunities` changes only a comment and needs no redeploy for it.

## 2. Preconditions (owner decisions, before any step)

1. Release 2 resolved (pushed with its backend, or rolled back): this branch sits on top of it.
2. **OD-3 in production.** With the review off nobody is `verified`, so in production nobody is eligible to apply or
   to be confirmed: M07/M08 ship «empty» until OD-3 is activated (verifier list + evidence procedure).
3. Auth settings that the branch assumes (production Auth is the owner's): minimum password 12 (Q-01: the app already
   refuses < 12), e-mail confirmation redirect `/auth/confirm**` (release-2 step 3), and whatever the account package
   adds (12 h session, invitation flag OFF by default).
4. D-07 P3 + D-10 stay closed: nothing in the branch shares contact or documents with organizations.

## 3. Order (each line = one approval; stop on any deviation)

| Step | Action                                                                                                                                                                                                                                                                                                   | Why here                                                                                                                                        |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | Preflight read-only: remote `main` SHA, `migration list --linked`, deployed function versions; `git merge-base --is-ancestor` of the release SHA; `supabase db push --dry-run` and compare the list with §1 (exactly the files above, same order)                                                        | know the starting point; `db push` cannot skip files                                                                                            |
| 1    | `supabase db push` (all pending files, file order as in §1) — the enum-value files (`20261022130000`, `20261024400000`) commit before their users; `20261024500000`/`500100` sort before the already-applied-locally `600000` → a reset in file order is what we verified locally                        | the functions of step 2 parse the new statuses/columns; new functions on the old schema are NOT supported                                       |
| 2    | Deploy **by name, never bare**, with `--use-api --project-ref sbjkzrkmcekokkqiuvvh`: every directory of §1 except `health` (the 7 changed release-1 functions, the 11 new ones, and the 3 release-2 ones only if their flags/secrets are wanted)                                                         | old `work-requirements`/`matching-evaluate`/`applications`… answer 500 on `paused`/new columns and 400 on the new parameters the frontend sends |
| 3    | Owner Auth settings (§2.3): e-mail confirmation ON, redirect URLs `/auth/confirm**` and `/register**`, confirmation template `supabase/templates/confirmation.html`, `otp_expiry` 1 h, session timebox 12 h (decision), minimum password 12                                                              | the account package assumes them; the app refuses < 12 already                                                                                  |
| 4    | `git push origin <release-sha>:main`                                                                                                                                                                                                                                                                     | frontend last: it calls routes that must exist                                                                                                  |
| 5    | Owner checks signed in: dashboards render (both account types, the recruiter space for an agency), Oportunidades/Mis candidaturas render (empty while OD-3 is off), requirement pause/resume/close/archive, notices bell, no CSP report in DevTools; Storage CORS answers the app origin (wallet viewer) | smoke of the critical paths                                                                                                                     |

Flags/rows to insert remotely only if wanted (each a separate approval): `app_private.feature_flags` `qualification_review`
(OD-3), `document_wallet` (release 2), `invitation_signup` (T-40, invitation-only sign-up). Nothing else is gated: notices,
outreach, account closure/export, recruiter and the passport ship for every account as soon as their migration lands.

Compatibility proven locally: the old frontend (`51c835a`) on the new functions and schema sends a subset of the new API;
new functions on the old schema are NOT supported — hence step 1 before 2.

## 4. Local evidence to attach to each approval

At `c093523` (2026-10-23, local Docker DB reset in file order): `pnpm check` 0 (Vitest 1123, Deno 188) · `pnpm build` 0 (Next 16.4.0
stops once with its security-advisory nudge; the retry passes — see §6) · local E2E 48/48 · `scripts/local/db-race-check.sh all`
19/19 · `scripts/local/ui-smoke.mjs` **259/259** on `next build && next start` (every merged package block) · PGlite RLS suites
(15 files). Record the numbers of the release SHA in `memory-bank/01-current-state.md` before step 1.

## 5. Rollback

- Frontend: Vercel «Promote» of the previous production deployment.
- Functions: redeploy the previous versions by name (the old functions read the new schema except `paused`/new
  statuses: pause nothing in production before rolling back, or roll the functions forward again).
- Migrations: forward-only, never dropped; additive tables/columns stay empty.

## 6. Open before any step (owner)

- **Next.js 16.4.0** in production carries two published advisories (GHSA-2464-fhr4-w9xw critical, GHSA-p3m5-59mp-jv5r
  high), and zod 4.6.5 a third (GHSA-mrhx-c7xc-m3w5 high). Patched locally 2026-10-26 on `fix/next-16.4.3` (`dc1b421`:
  Next/eslint-config-next 16.4.3, zod 4.6.7 in the app and in `supabase/functions/deno.json`; `pnpm audit`: no known
  vulnerabilities; independent review APPROVE), merged into this branch and into the §0 hotfix candidate. The Edge
  Functions' zod reaches production only with step 2.
- Sign-offs on defaults listed in `memory-bank/06-active-context.md` «Risks» 4 (T-111, T-128, T-86, T-113, free text in
  `description`/`arrival`), OD-3 activation, D-07 P3, Q6 vs SCOPE-2.
