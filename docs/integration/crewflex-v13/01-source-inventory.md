# 01 · CrewFlex V1.3 source inventory

> Phase 0.8 (2026-10-15). Reference only: **nothing from this archive is copied into product code.**
> The V1.3 prototype is a source of functional knowledge, rules and UI ideas; the product remains
> Next.js → Supabase Edge Functions → PostgreSQL + RLS (`docs/architecture/ARCHITECTURE.md`).

## Archive

| Item               | Value                                                                                                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File               | `CrewFlex_v1.3_Unificada.zip` (repo root, 485 900 bytes, **git-ignored** by `/*.zip` since 2026-10-15)                                                                                                   |
| Extracted to       | `tmp/references/crewflex-v13/` (git-ignored `/tmp/`). Read-only; no script, `pnpm` or `node` from the archive was run                                                                                    |
| Manifest           | `MANIFEST.json`: release "V1.3 unificada", 2026-10-14, claims `testsPassed: 48`                                                                                                                          |
| Integrity          | **86/86 SHA-256 hashes match**, no unlisted file (checked 2026-10-15 with a Python script outside the archive)                                                                                           |
| Not in the ZIP     | `../CrewFlex_v1.3_Estado.md`, referenced by its README and AGENTS.md as "the current guide"                                                                                                              |
| Secrets            | None: no `.env`, `.sqlite`, keys or certificates. Synthetic test password literal in `tests/server.test.mjs`; seed personas use `example.com`                                                            |
| Personal-data risk | `src/data/mockData.js` (dead code) has one e-mail at a non-reserved domain and a realistic Spanish mobile number, plus real company names (Iberia Maintenance, TAP, Safran). **Never import mock data.** |

## Two environments in one shell

| Environment               | Entry                                                                                  | Persistence                                                              | Auth                                                 |
| ------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------- |
| **DEMO** (recorrido)      | `src/LegacyApp.jsx` tabs except `account`/`tools`; state in `src/context/AppState.jsx` | IndexedDB `crewflex-v12` (`src/storage.js`), backup JSON export/import   | None: a "Probar como" role `<select>` is the "login" |
| **BETA-SERVER** (cuentas) | Tab `account` → `src/beta/Account.jsx` → `server/app.mjs`                              | SQLite (`node:sqlite`), generic `entities(kind, owner, data JSON)` table | Invite-only, scrypt passwords, session cookie + CSRF |
| **SHARED, no server**     | Tab `tools` (default landing) → `src/tools/*`                                          | `localStorage` favourites only                                           | None                                                 |

Both environments share the navigation shell but **not their data or rules**: the demo uses
`src/business.js`; the beta server uses `server/rules.mjs`. They disagree on several rules
(see `03-business-rule-conflicts.md`).

Boot path: `index.html` → `src/main.jsx` → `src/BetaPreview.jsx` → `src/LegacyApp.jsx`.
`src/App.jsx` is dead (nothing imports it).

## Classification

### Live — demo (DEMO)

| File                                                                   | Content                                                                                                                                                                                                                |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/business.js` (via `src/domain.js`)                                | Demo rules: `matching`, `coverage`, `validateDays`, `validateJob`, `transitionError`, `canSeeCandidate`, `publicCandidate`, `buildPack`/`projectedPack`, `pricing`, `classifyUrgency`, `patternForDate`, `aogAudience` |
| `src/context/AppState.jsx`                                             | Store + actions (commit queue, persists before updating React state)                                                                                                                                                   |
| `src/storage.js`                                                       | IndexedDB, legacy `localStorage` migration, backup format `CrewFlexBackup` v1                                                                                                                                          |
| `src/data/v11.js`                                                      | `seed()`: one profile, 3 fake candidates, 3 orgs, 3 jobs (dates relative to today)                                                                                                                                     |
| `src/components/v11/Professional2.jsx`                                 | 5-step profile wizard, availability month calendar + shift patterns, document wallet, privacy                                                                                                                          |
| `src/components/v11/Company2.jsx`                                      | Job builder (3 sections), manage jobs, organization settings (incl. **self-verification toggle**)                                                                                                                      |
| `src/components/v11/Marketplace.jsx`                                   | Jobs list, candidates search/compare, job details, application modal, logistics strip                                                                                                                                  |
| `src/components/v11/Workflow.jsx`                                      | Application pipeline, Candidate Pack viewer, terms, conversation                                                                                                                                                       |
| `src/components/v11/{Dashboard,DataPanel,Logbook2,Pricing,Shared}.jsx` | Dashboard/notifications, backup panel, logbook, fee summary, UI primitives                                                                                                                                             |
| Shims                                                                  | `v11/Professional.jsx`, `v11/Company.jsx`, `context/AppContext.jsx`, `domain.js` (one-line re-exports)                                                                                                                 |

### Live — beta server (BETA-SERVER)

| File                   | Content                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `server/app.mjs`       | HTTP API: auth (register/verify/login/forgot/reset), `/api/state`, `/api/action` (14 actions), documents upload/download, export, admin |
| `server/rules.mjs`     | Pure server rules: `validateJob` (multi-shift, timezone), `selectShifts`, `totals`, `eligible`, `quietNow`, `urgency`                   |
| `server/scanner.mjs`   | ClamAV adapter. **Not configured by default** (no `CREWFLEX_CLAMSCAN` → 503); scanning is a manual admin action, never on upload        |
| `src/beta/Account.jsx` | Entire beta UI (auth, profile, jobs + ShiftEditor, applications, documents, logbook, admin)                                             |
| `scripts/manage.mjs`   | CLI: invite (only way to create an admin), outbox (prints live token links), backup, restore-copy                                       |

### Live — shared tools (no server)

| File                                     | Content                                                                                                                     |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `src/tools/engine.js`                    | Engine 1.0.0: 22 magnitudes (NIST SP811 factors), strict number parser (fractions), fuel conversion/plan/balance, durations |
| `src/tools/knowledge.js`                 | ES/EN glossary (≥100 entries) + orientative ATA chapter index (>40)                                                         |
| `src/tools/Toolbox.jsx`, `FuelSheet.jsx` | Tools hub with favourites, converters, fuel sheet                                                                           |

### Dead / obsolete (V1.0 generation, never rendered)

`src/components/screens/*` (AuthScreen, CalendarScreen, CandidatePackModal, DocsScreen, HomeScreen,
JobsScreen, LogbookScreen, PassportScreen, PrivacyScreen, ToolsScreen),
`src/components/company/*` (AircraftCategoryDiagram, CompanyDashboard, CreateJobForm, DayCoverageMap),
`src/components/{Header,Navbar}.jsx`, most of `src/data/mockData.js`, `src/App.jsx`.
They call context functions that no longer exist and would crash if mounted. Their content is
hard-coded (fixed `matchScore: 92`, "Cobertura Garantizada por Algoritmo", September-2026 calendar,
fixed tax rates). **Use only as taxonomy reference** (EASA category cards, aircraft × licence
diagram — which contains a non-Part-66 "B2.1" category that needs domain review).

### Build output and tooling (ignored)

`dist/`, `CrewFlex_v1.3.html` (standalone bundle), `scripts/{build,dev,format,preview,standalone}.mjs`,
`Iniciar_CrewFlex.cmd` (reveals an authoring toolchain path), `pnpm-lock.yaml`, `package.json`.

### Tests (Node `node:test`, not run here)

| File                            | Covers                                                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/domain.test.mjs`         | Demo matching (eligibility vs score), AOG days, full-block offers, coverage per date, overbooking, visibility, contact unlock, pack snapshot, expiry                            |
| `tests/regression.test.mjs`     | Hourly rates, optional budget gate, recommended blocks, filled places, finalisation time, pack projection, fees 2.3/4/10 %, AOG audience, urgency boundaries 0/9/10/11/39/40/45 |
| `tests/v13-regression.test.mjs` | Rating restriction blocks eligibility; pricing snapshot survives mode change                                                                                                    |
| `tests/shifts.test.mjs`         | Server shift selection (isolated shifts rejected), commission on selected shifts, required courses/skills                                                                       |
| `tests/tools.test.mjs`          | Round-trip of every unit pair, known factors, strict parsing, fuel examples (11 920 kg / −40 kg / −120 kg), multi-supply, durations                                             |
| `tests/server.test.mjs`         | Beta API end-to-end with injected scanner                                                                                                                                       |
| `tests/backup.test.mjs`         | Backup/restore copy                                                                                                                                                             |

The "48 tests passed" claim was **not re-executed** (running prototype code is out of policy).
The tool tests are the ones worth porting (see `06-implementation-roadmap.md`, block 4).

## Documentation status inside the ZIP

| Doc                                                                                                                      | Status                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `README.md`, `docs/TOOLS.md`, `docs/DEPLOYMENT.md`, `docs/launch-config.json`, `Cambios.md`, V1.3 section of `AGENTS.md` | Describe V1.3                                                                                         |
| `docs/BUSINESS_RULES.md`, `docs/USER_FLOWS.md`, `docs/V1_SCOPE.md`                                                       | **Self-declared historical** ("Documento de diseño heredado", V1.1) — describe the demo, not the beta |
| `docs/RELEASE_V1.2.md`, `docs/VALIDATION.md`                                                                             | V1.2                                                                                                  |
| `docs/PRODUCT.md`, `docs/DESIGN_SYSTEM.md`                                                                               | Unversioned; describe the demo                                                                        |

Known doc/code contradictions inside the ZIP: 4 privacy levels and 75/25 affinity exist only in the
demo (the beta has a boolean `visible` and no score); the demo allows Aceptada → Propuesta
(re-proposal) while the server allows accepted → cancelled; AGENTS.md calls `domain.js` "pure rules"
(it is a re-export); "CrewFlex V1.2" strings remain in the demo UI.

## Security observations on the beta server (do not reuse)

1. `outbox` stores **plaintext** invite/verify/reset URLs and `GET /api/admin` returns them →
   account takeover by anyone who can read the admin view or the DB file.
2. In-memory rate limits keyed by `remoteAddress` (shared on loopback); lost on restart.
3. `account.close` rewrites finished applications to `withdrawn` (history loss).
4. Document download for the hiring company is tied to `consentContact`, not to the pack consent.
5. Directory pseudonym `T-<first 8 hex of user UUID>` is stable and derived from the internal id
   (Next derives a per-requirement SHA-256 reference instead).
6. Admin review has no `rejected` state; "approve: false" only resets to pending.

Worth keeping as ideas: identity/role from the session only, role from the invitation, transaction
per action, audit per action, **full re-check of eligibility/availability/capacity at confirmation**.
