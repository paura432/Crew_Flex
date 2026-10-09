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

## S4–S8 · missing prototypes

`crew-flex-aviation-premium-v2.html`, `crew-flex-web-premium-v2-1.html`, `lutes_recrew_demo.html`,
`index-1.html`, `JobSlice_Aero_propuesta.pdf` — `SOURCE_MISSING`. No classification possible.

## Contradictions with the current repo direction (→ `docs/product/OPEN_DECISIONS.md`)

| Topic                              | S1                                                                                      | Repo / brief                                           | Entry          |
| ---------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------- |
| Language                           | Spanish                                                                                 | English                                                | C-5 (existing) |
| Visibility levels                  | private / anonymous / **verified** / open                                               | private / anonymous / open                             | C-7 (existing) |
| Self-declared evidence in matching | counts (demo)                                                                           | hard requires `verified`                               | C-3 (existing) |
| Availability model                 | per-day states incl. `aog`, `working`, `assigned` + shift patterns                      | time windows `available` / `unavailable`               | **C-8 (new)**  |
| Job model                          | rich offer (economics, logistics, split coverage, per-day)                              | work requirement (headcount, hard/soft qualifications) | **C-9 (new)**  |
| Matching inputs                    | category + aircraft + engines + courses + years + country + tools + skills; score 75/25 | qualification types only; soft score only for eligible | **C-10 (new)** |
| Partial coverage                   | split jobs, min consecutive days                                                        | not eligible in V0                                     | C-4 (existing) |
