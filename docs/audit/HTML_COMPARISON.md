# HTML prototypes — comparison and adoption decisions

## S1 · `CrewFlex_v1.1.html` (main reference)

Vite/React 18 single-file bundle, Spanish UI, Inter/Outfit via Google Fonts, Lucide icons. State in one
React context persisted to `localStorage["crewflex-v11"]` (version 11); `resetAllData()` restores the
synthetic seed. Three demo roles switched from the topbar: **Técnico**, **Empresa**, **Recruiter**.
Mobile preview toggle in the topbar. All operations are in-memory; the audit log (`audit[]`, last 200) and
notifications are local.

### Navigation

| Role      | Tabs (sidebar)                                                                                                                          |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Técnico   | Mi espacio · Mi pasaporte · Disponibilidad · Oportunidades · Mis candidaturas · Wallet documental · Logbook · Herramientas · Privacidad |
| Empresa   | Resumen · Nueva necesidad · Ofertas y cobertura · Buscar candidatos · Candidaturas · Ofertas en la red · Organización                   |
| Recruiter | Same as Empresa with "Publicar para cliente" (client represented) and "Red recruiter" copy                                              |
| Global    | Notificaciones (bell), Configuración/Organización, "Qué incluye esta versión"                                                           |

### Data model (synthetic seed `Cl()`)

- **Profile** (`tech-me`, code `CF-001`): name, email, phone, location (airport list), `employerId`,
  `categories[]` (B1.1, B2, Cat A, Cat C, Mecánico, Sheet Metal, NDT, Helper), `aircraft[]`,
  `ratings[{aircraft, category, expiry}]`, `engines[]`, `years`, `english` (A2–C2), `courses[{name, expiry}]`
  (HF, EWIS, FTS, SMS), `skills[]`, `dailyRate`, `minRate/minRateType`, `workCountries[]`, `mobility`,
  `ownTools`, `shiftPattern` (4x4, 2D2N4OFF, Noche, Partido, Flexible), `shiftAnchor`,
  `availability{date → available|off|aog|working|assigned}`, `visibility` (private|anonymous|verified|open),
  `blockEmployer`, `whatsappOptIn`, `aogOptIn`, `quietStart/End`, `documents[]`, `verification`
  ("Autodeclarado" / "Verificado · demo").
- **Candidates** (`tech-2..4`): same shape.
- **Organizations** (`org-1` AeroLine MRO, `org-employer`, `org-recruiter`): name, email, verified, billing/type.
- **Jobs**: organizationId, company, client (recruiter), title, location, country, startDate/endDate,
  `days[]` (explicit dates), category, aircraft[], requireType, engines[], courses[], minYears, hardSkills[],
  softSkills[], people, minDays, split, consecutive, shift, arrival, hourlyRate, hours, overtime, perDiem,
  contract (Temporal/Permanente/Por proyecto/Contractor), currency, urgency (Planificado/Urgente/AOG),
  flights/accommodation/transport/meals, ownTools, description, status (Publicada/Pausada),
  `outreach[]`/`outreachAt`.
- **Applications**: jobId, candidateId, status, `days[]`, `pack` (Candidate Pack snapshot), contactConsent,
  source (direct/simulated), score, history[], messages[].
- **Logbook** entries: date, aircraft, category, environment, description, cvRelevant.

### Business logic

- `je(candidate, job)` — matching: **hard checks** (category, aircraft/type rating valid through
  `endDate`, engines, each course valid through `endDate`, min years, work-permit country, own tools, hard
  skills) → `eligible = all hard ok`; **soft** (rate within budget, base or mobility, technical English,
  soft skills); `score = 75 × hard ratio + 25 × soft ratio`; `compatibleDays` (available, or `aog` when job
  is AOG), `coverage %`, `canCover` (split jobs: ≥ minDays, consecutive runs).
- `ya()` — application validation: eligible, dates inside job, full coverage unless split, min days,
  consecutive blocks.
- `Li(job, applications)` — per-day coverage from **confirmed/finished** applications only.
- `fh()` — application state machine: Recibida → Preseleccionada → Propuesta → Aceptada → Confirmada →
  Finalizada; Rechazada/Retirada from most states; confirmation blocked if the technician already has an
  assignment on those dates or a date is fully covered; confirmed days become `assigned` in the calendar.
- `Cr(candidate, org)` — visibility: blocked employer excluded; `anonymous`/`open` visible;
  `verified` only to verified organizations. `ir()` — anonymised view (`Técnico CF-00x`, no contact)
  unless `open` or consent + accepted application.
- `ph()` — Candidate Pack: categories, aircraft, engines, ratings, courses, years, location, English, rate,
  skills, selected days, selected documents, CV-relevant logbook entries, contact consent.
- `dispatchAog()` — Urgent/AOG distribution: filters visible + opted-in + eligible + canCover; **simulated**
  (no external messages).
- Calendar: month grid, state picker (Disponible / Descanso / Solo AOG / Turno habitual), pattern
  generator from `shiftPattern` + anchor; assigned days preserved.
- Documents: local upload (PDF/PNG/JPEG/WebP ≤ 2 MB, data URL), block (Licencias / CV / Cursos / Permisos),
  expiry, verification "Pendiente"; removal keeps copies in shared packs.
- Tools: fuel mass calculator, unit converter, net-income estimator by country (illustrative rates),
  extra-days income simulator, length converter, glossary.

### Screens (18 rendered, see `evidence/proto-1440-*.jpg`)

Técnico: Mi espacio (hero, 4 metrics, compatible opportunities, next step, shortcuts) · Mi pasaporte
(5-step wizard: identity, qualifications, experience & courses, availability & rate, summary) ·
Disponibilidad (3 metrics, pattern, month calendar) · Oportunidades (search, filters, compatibility,
apply drawer with day selection, documents, consent) · Mis candidaturas (status tabs, history, messages,
withdraw) · Wallet documental (blocks, upload, access) · Logbook · Herramientas · Privacidad (visibility
modes, block employer, WhatsApp/AOG opt-in, quiet hours).
Empresa: Resumen · Nueva necesidad (profile, aircraft, engines, courses, skills, dates with day picker,
people, min days, split/consecutive, shift, arrival, economics, logistics, urgency, description, live
summary) · Ofertas y cobertura (per-job per-day coverage, outreach, pause) · Buscar candidatos (job
selector, search, eligible-only, compare, profile drawer, simulate response) · Candidaturas (pipeline
actions) · Ofertas en la red · Organización (name, email, verified toggle, plan, audit).

## S3 · Fable handoff (`tmp/fable-src`) and Fable 5.1 redesign (`tmp/fable-5.1-redesign`)

Reconstructions from the current repo, in English, capacity-first, 8 screens. They are **not original
product sources**; they post-date the foundation. Decisions:

| Contribution                                                                 | Decision                          | Justification                                                              |
| ---------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------- |
| Capacity board (required · eligible · gap · coverage + slot bar + next step) | ADOPT (already in repo direction) | Matches the current strategic thesis and the brief; no conflict with S1    |
| Verification ledger rows (per-qualification ✓/✗ + expiry inline)             | ADAPT                             | Improves explainability over S1's chip lists; keep S1 copy where it exists |
| English UI, UTC                                                              | ADOPT (brief)                     | S1 is Spanish — recorded as open decision C-5                              |
| Hash routing, drawer                                                         | REJECT                            | Next.js App Router already provides routing                                |
| Removal of marketplace flows (applications, packs, AOG outreach)             | REJECT                            | The brief forbids dropping original functionality                          |

## S4–S8 · recovered prototypes (Phase 0.6, 2026-10-09)

All five were recovered and audited in full (`docs/audit/sources/`, screenshots `evidence/src-S*-*.jpg`).
Hierarchy unchanged: S1 remains the application reference; S2 (Blueprint) outranks S8 (older proposal);
S4–S7 are secondary prototypes whose useful ideas are ADOPTed only where justified. Nothing below is
treated as implemented; every candidate feature is `SOURCE_ONLY` in `FEATURE_INVENTORY.md` §J–M.

| Src | What it is                                                                                                                                                                                               | Logic / state                                                                                   | Adds (IDs)                                                                                                                                                                                                                                                                                                                                                                                           | Contradicts                                                                                                                                                                                                                                                                                        | Verdict                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S4  | Spanish marketing landing "Crew Flex Aviation, a vertical of Crew Flex": passport, 3 engagement modes, August calendar mock, tools, privacy, recruiter workspace, enterprise, brand architecture         | none (static illustrations, 8-line script; numbers are literals)                                | CF-J01 engagement modes, J02 temporary link, J03 availability-gated visibility, J04 "limited profile" hides employer, J05 aircraft×engine matrix, J06 JT/OJT evidence, J07 CV export, J08 talent pools, J10 specialties, J11 flex-work disclaimer, J12 "recruiting without noise", J13 technical-lead role, J15 brand architecture                                                                   | visibility enum (Privado / Perfil limitado / Disponible en días seleccionados / Enlace temporal, no "open") vs S1 & BR-8 → C-7; sourcing pipeline Matched→Shortlist→Contacted→Interview vs S1 `fh()`; match % without eligibility gate; taxonomy adds Cabin/Composite/Helicopters, drops Cat C/NDT | ADOPT J04/J11/J12 · ADAPT J01 · OD J03/J10/J15 · DEFER J02/J05/J06/J07/J08/J13/J16 · REJECT J09/J14                                                    |
| S5  | Spanish corporate one-pager "Crew Flex — Web corporativa": company thesis "one infrastructure, many verticals" (Aviation, Industry, Tech, Healthcare in the infographic), enterprise layer, brand assets | none                                                                                            | CF-M02 multi-vertical core, M03 ATS/HRIS/ERP integrations, M04 "operaciones" role, M07 brand assets (CF monogram, wordmark, tagline), M08 how-it-works infographic, M09 contact CTA                                                                                                                                                                                                                  | visual identity dark navy + cyan (no orange) vs `DESIGN_SYSTEM.md` → C-12; aviation scope incl. Ingeniería/Ground/Operaciones vs maintenance-only → M05 REJECT; "IA" as selling point vs LLM ≠ eligibility → M06 REJECT                                                                            | OD M02/M04/M07 · ADAPT M09 · DEFER M01/M03/M08 · REJECT M05/M06                                                                                        |
| S6  | "Lutes Recrew" company-centric marketplace landing: company console, 4 mock screens (registro, publicar, buscar, aplicados), 9-module roadmap, SaaS plans €149/€499/Custom                               | 5 JS functions, no data; all match % literal; verified bug: tab switch blanks "Pantallas clave" | CF-K01 private pool + blacklist, K05 rate calculator, K06 expiry alerts to company, K07 "Modo AOG extremo", K08 reputation ratings, K09 "Pedir doc." lane, K12 SaaS plans, K15 identity/right-to-work KYC, K16 publish-time compatible/available counts, K17 blocking-document reason, K19 licence authority field                                                                                   | ranking uses distance + reputation (none in S1/repo); AOG push/WhatsApp blasts without opt-in; candidate names shown pre-consent; company→technician block direction (inverse of CF-H02); "Logbook revisado" as evidence; hourly rates                                                             | ADOPT K16 (= capacity board) / K17 · ADAPT K06/K07 (opt-in kept)/K09/K19 · OD K01/K08/K12/K15 · DEFER K02/K03/K04/K05/K10/K11/K14 · REJECT K13/K18/K20 |
| S7  | "JobSlice Aero — MVP Técnicos": mobile technician-only demo in a 440 px phone frame, 9 screens, working calculators (fuel, converters, net estimator, extra income)                                      | no persistence; calculators real; privacy toggles static                                        | CF-L01 onboarding intent, L02 private by default, L03 completeness hint, L04 engines/years per aircraft, L05 one-tap "72 h" window, L06 WhatsApp consent, L07 apply preview sheet, L09 tool-calibration document, L10 logbook disclaimer, L11 ineligible shown with reason, L12 tool formulas, L13 pay-per-posting model                                                                             | privacy modes as independent toggles vs exclusive enum; contact "unlocked on apply" vs CF-H04 (consent + accepted application); 67 % score shown for hard-failed job vs "score only for eligible"; origin of S1 vocabulary (Candidate Pack, Pasaporte técnico, Document wallet)                    | ADOPT L02/L03/L07/L10 · ADAPT L01/L05/L09/L11 · OD L04/L13 · DEFER L06/L08/L12/L16 · REJECT L14/L15/L17                                                |
| S8  | "JobSlice Aero – Propuesta de MVP y modelo de negocio", v0.1, Aug 2026, 11 pages, internal draft (pre-Blueprint)                                                                                         | n/a (document)                                                                                  | 22 decision statements FD-15…FD-36 (`FOUNDER_DECISIONS.md`): supply-first entry, KYB before access, progressive verification, explainable non-automated matching, 5 privacy modes + company block, per-case document authorisation, Candidate Pack spec, WhatsApp opt-in alerts, logbook disclaimers, revenue lines, retention principles, regulatory frame, catalog breadth (EASA/UK CAA/FAA), KPIs | phase order (technicians first, simulated offers) vs C-1; self-declared data counts in MVP vs BR-3; "Match 91 %" first vs C-2; never states hard-missing blocks (Blueprint wins)                                                                                                                   | ADOPTED where already true (FD-19/22/31) · OPEN FD-15/17/18/20/29/30/32/33 · DEFERRED rest · SUPERSEDED FD-35/36                                       |

Evolution (evidence-backed, `sources/S6-S7-lutes-jobslice.md` §Evolution): Lutes Recrew (company-centric,
SaaS, €/h, reputation + distance) → JobSlice Aero (technician-first, privacy modes, Candidate Pack, €/day,
pay-per-posting) → Crew Flex S1 merges both, formalises hard→soft matching (75/25 is S1's own), drops
reputation/distance/tiers/integrations and keeps the navy + orange + Inter identity (S7 tokens closest to
S1). Monetisation is unresolved in every source (OD-7).

## Contradictions with the current repo direction (→ `docs/product/OPEN_DECISIONS.md`)

| Topic                                | S1                                                                                      | Repo / brief                                           | Entry          |
| ------------------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------- |
| Language                             | Spanish                                                                                 | English                                                | C-5 (existing) |
| Visibility levels                    | private / anonymous / **verified** / open                                               | private / anonymous / open                             | C-7 (existing) |
| Self-declared evidence in matching   | counts (demo)                                                                           | hard requires `verified`                               | C-3 (existing) |
| Availability model                   | per-day states incl. `aog`, `working`, `assigned` + shift patterns                      | time windows `available` / `unavailable`               | **C-8 (new)**  |
| Job model                            | rich offer (economics, logistics, split coverage, per-day)                              | work requirement (headcount, hard/soft qualifications) | **C-9 (new)**  |
| Matching inputs                      | category + aircraft + engines + courses + years + country + tools + skills; score 75/25 | qualification types only; soft score only for eligible | **C-10 (new)** |
| Partial coverage                     | split jobs, min consecutive days                                                        | not eligible in V0                                     | C-4 (existing) |
| Visual identity (S4/S5 vs S1/S6/S7)  | dark navy + cyan marketing identity, no orange                                          | light canvas, orange accent (`DESIGN_SYSTEM.md`)       | **C-12 (new)** |
| Multi-vertical core (S4/S5)          | sector-agnostic core + vertical modules (Aviation, Industry, Tech, Healthcare)          | aviation maintenance only                              | **C-13 (new)** |
| Organization verification (S4/S6/S8) | KYB before accessing technicians; "verified companies" visibility level                 | no KYB in V0 (OD-5)                                    | **C-14 (new)** |
| Launch order (S8)                    | supply-first: technicians + tools before companies                                      | demand side (capacity) built first                     | **C-15 (new)** |
| Ranking inputs (S6)                  | distance + reputation ratings in ranking                                                | qualifications/availability only, no reputation        | **C-16 (new)** |
