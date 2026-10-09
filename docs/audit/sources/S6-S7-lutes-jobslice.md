<!-- Detailed source audit produced in Phase 0.6 (2026-10-09). Evidence file for docs/audit/HTML_COMPARISON.md; line numbers refer to the sources in tmp/ (ignored). -->

# S6 / S7 audit — `lutes_recrew_demo.html` and `index-1.html`

Date: 2026-10-09. Scope: read-only analysis of two earlier-branded prototypes against S1
(`CrewFlex_v1.1.html`, as described in `docs/audit/HTML_COMPARISON.md`) and `docs/audit/FEATURE_INVENTORY.md`.
All line numbers refer to the source files as found under
`tmp/crew-flex-fuentes-faltantes/tmp/`. Nothing was executed outside a headless, network-blocked Chromium.

Rendering method: playwright-core 1.63 + Chromium 1243, viewports 1440×900 and 390×844, full page, JPEG q60,
all non-`file://` requests aborted. Script: `scratchpad/shots-S6S7.mjs`; raw metrics: `scratchpad/shots-S6S7.out.json`;
tab-interference check: `scratchpad/verify-S6.mjs`.

Evidence (all under `docs/audit/evidence/`):

| File                                                                                            | What                                                         |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `src-S6-1440.jpg`, `src-S6-390.jpg`                                                             | S6 initial state (Panel empresa + Registro tabs)             |
| `src-S6-1440-ofertas.jpg`, `src-S6-1440-talento.jpg`                                            | S6 demo tabs "Ofertas abiertas", "Profesionales verificados" |
| `src-S6-1440-publicar.jpg`, `src-S6-1440-buscar.jpg`, `src-S6-1440-aplicados.jpg`               | S6 "Pantallas clave" tabs 2–4                                |
| `src-S6-1440-modal.jpg`                                                                         | S6 "Nueva necesidad operativa" modal                         |
| `src-S6-390-publicar.jpg`, `src-S6-390-aplicados.jpg`                                           | S6 mobile versions of the two densest screens                |
| `src-S7-1440.jpg`, `src-S7-390.jpg`                                                             | S7 Inicio                                                    |
| `src-S7-390-passport.jpg`, `-jobs.jpg`, `-tools.jpg`, `-privacy.jpg`, `-pack.jpg`, `-apply.jpg` | S7 screens + apply sheet                                     |
| `src-S7-1440-jobs.jpg`, `src-S7-1440-tools.jpg`                                                 | S7 at desktop width (centred phone column)                   |

Render findings common to both:

- Console: S6 logs one `Failed to load resource: net::ERR_FAILED` per load (the blocked Google Fonts request,
  line 9). S7 logs nothing. No `pageerror` in either.
- Horizontal overflow: none. `scrollWidth == innerWidth` at both widths for every captured view (1440/1440,
  390/390).
- Fonts: Inter is requested by S6 (line 9) and blocked; S7 never loads Inter at all (no `<link>`, only
  `font-family: Inter, …` on line 11). Inter is not installed on this machine (`fc-list` empty), so **both renders
  use the system-ui fallback**. `document.fonts.check('16px Inter')` returned `true` only because no `@font-face`
  was registered (trivially true), not because Inter rendered.
- `localStorage`: empty in both after interaction. Neither file persists anything.
- S7 full-page captures show the `position:fixed` bottom nav in the middle of the image; that is a capture
  artefact, not a layout bug (`.bottom`, line 15).

---

## S6 · `lutes_recrew_demo.html` — "Lutes Recrew — Demo Marketplace Aeronáutico"

### 1. Nature

- **Type:** marketing landing page with an embedded, static "demo de producto" and four static "pantallas clave"
  mock-ups. It is a pitch deck in HTML ("Estas serían las zonas que más necesita ver tu jefe", line 126), not
  an app prototype: there is no state, no data layer, no computation.
- **Language:** Spanish (`lang="es"`, line 2) with English aviation terms (AOG, line maintenance, type ratings).
- **Framework:** none. Plain HTML + one `<style>` block (lines 10–28) + five vanilla JS functions (lines 314–320).
- **External deps:** Google Fonts Inter 400–900 (lines 7–9). Nothing else (no icon lib; icons are emoji, lines
  74–79, and one inline SVG, line 33).
- **Navigation:**
  - Anchor links in header: `#producto`, `#demo`, `#flujo`, `#precios` (line 34). Sections `#pantallas` (124) and
    `#roadmap` (230) exist but are not linked from the nav.
  - JS tabs, group A (`showPanel`, line 315): `#empresa`, `#ofertas`, `#talento` (lines 88–90, 103–117).
  - JS tabs, group B (`showScreen`, line 316): `#registro`, `#publicar`, `#buscar`, `#aplicados` (lines 128–131,
    134–226).
  - Modal `#modal` (lines 294–312) opened from five buttons (lines 35, 36, 47, 104, 288).
- **State / storage:** none. No `localStorage`, no arrays, no objects in JS. **All "data" is inline HTML text.**
- **Mock entities (inline only, fields inferred from the markup):**
  - _Offer / need_ (lines 57–63, 105–106, 109–111, 174–178, 190–192, 201–203, 300–308): title, type
    (AOG / Line / Base / Campaña / Structures / Avionics), base airport, licence required, aircraft/type rating,
    dates or duration, shift, hourly rate (`€58/h`, `€52/h`), extras (hotel, desplazamiento), urgency tag
    (`Urgente`, `Alta prioridad`), match count (`11 matches`, `18 matches`), minimum-documents preset,
    free-text requirements, `Pago 7 días` badge (line 111).
  - _Technician_ (lines 114–116, 151–158, 214–217, 221–223): initials, display name (first name + initial),
    licence category (B1.1 / B2 / Structures / CAT A), type ratings, city, years, courses (HF, EWIS, FTS, Fuel
    Tank Safety), English level (`inglés C1`), availability text (`Disponible 72 h`, `inmediata`, `24 h`,
    `48 h`), verification badge (`Documentación verificada`, `Cursos vigentes`, `Logbook revisado`), match
    score %, hourly rate, profile completeness `78%` (151), pipeline lane.
  - _Document_ (line 158): filename, status (`Validado`, `Vence pronto`, `Revisando`); includes `Logbook.xlsx`.
  - _Company console counters_ (lines 95–100): Necesidades 8, Candidaturas 43, Pool privado 218, Documentos
    "12 vencen", Facturación, Alertas AOG ON.
  - _Pricing plans_ (lines 277–279): name, audience, monthly price, feature list.
  - _Hero KPIs_ (lines 49–51): `92% matching documental`, `14 min primeros candidatos`, `24/7`.
  - No companies, ratings, licences or availability are modelled as entities; they appear only as copy.

### 2. Structure and interactions

| #   | Section (id) | Lines   | Heading                                                                           | Components                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ------------ | ------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | `header`     | 31–38   | brand "Lutes Recrew"                                                              | sticky nav, anchor links, CTA "Publicar necesidad" (desktop) / "Demo" (mobile)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 1   | `.hero`      | 41–68   | "Contrata técnicos aeronáuticos disponibles, cualificados y documentados."        | pill, h1, paragraph, 2 CTAs, 3 KPI tiles, fake dashboard card (search box "B1.1 + A320 / Madrid · 3 días / Match", job card with avatars and a 92 % bar hard-coded in CSS `.match>div{width:92%}` line 21)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2   | `#producto`  | 70–82   | "Diseñada para ser más que una bolsa de empleo."                                  | 6 feature cards (Verificación documental, Ofertas rápidas, Matching inteligente, Disponibilidad real, Aplicación en 1 clic, Compliance para empresas)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 3   | `#demo`      | 84–121  | "Demo de producto"                                                                | 3 tabs; dark sidebar "Console" with 6 counters; panel `#empresa` (toolbar with 3 fake inputs + "+ Nueva oferta", 2 offer rows with price and "Ver candidatos"); panel `#ofertas` (3 offers with "Aplicar rápido"); panel `#talento` (3 technician rows with verification badge and circular score 96/91/88 %)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 4   | `#pantallas` | 124–228 | "Pantallas clave de Lutes Recrew"                                                 | 4 tabs. `#registro` 134–163: checklist of 6 onboarding blocks + phone mock (profile 78 %, licence fields incl. `Autoridad: AESA`, 4 documents with status, bottom nav Perfil/Ofertas/Agenda/Chat). `#publicar` 165–183: 9-field need form (type, base, licence, aircraft, dates, rate, minimum docs, urgency, generated description) + statusbar "11 candidatos compatibles · 4 disponibles en 24 h · 2 con tarifa alta · Expediente automático" + 2 buttons. `#buscar` 185–207: phone mock with 3 offers (match %, missing-course reason) + 5-column table Oferta/Match/Tarifa/Estado/Acción. `#aplicados` 209–226: 4-lane kanban (Aplicados, Preselección, Documentación, Contratado) + 5-column table Candidato/Documentos/Disponibilidad/Tarifa/Acción with actions Entrevistar / Preseleccionar / Pedir doc. |
| 5   | `#roadmap`   | 230–245 | "Qué más deberíamos crear"                                                        | 9 module cards (see §5)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 6   | `#flujo`     | 246–257 | "Flujo operativo perfecto"                                                        | 5 numbered steps: Empresa publica → Filtro compliance → Matching → Aplicación rápida → Cierre y expediente                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 7   | (no id)      | 259–271 | "Funciones premium para que sea diferencial"                                      | 6 cards (largely duplicates of §5)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 8   | `#precios`   | 273–282 | "Modelo de negocio posible"                                                       | 3 plan cards                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 9   | (no id)      | 284–291 | CTA "La idea fuerte: no vender empleo, vender disponibilidad técnica verificada." | button "Simular oferta"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 10  | `#modal`     | 294–312 | "Nueva necesidad operativa"                                                       | 9-field form (type, base, licence, type rating, start date `2026-07-03`, duration, rate, extras, requirements) + Cancelar / "Publicar y buscar matches"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| —   | footer       | —       | —                                                                                 | **No footer element exists** despite `.footer` CSS (line 22)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

Interactions (every handler in the file):

| Handler                        | Lines                | Effect                                                                                                                     | State mutated / computed                                                                                                                                                                                                                                                         |
| ------------------------------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `showPanel(id, btn)`           | 315; buttons 88–90   | Removes `.active` from **all** `.panel` and **all** `.tab` in the document, then activates the target                      | DOM classes only. **Bug (verified in browser):** because the four `#pantallas` screens also carry `.panel`/`.tab`, clicking any "Demo de producto" tab blanks the "Pantallas clave" section (height 1059 → 331 px) and un-highlights its tab until a screen tab is clicked again |
| `showScreen(id, btn)`          | 316; buttons 128–131 | Toggles `.screenPanel` only and tabs inside its own `.tabs` parent                                                         | DOM only; correctly scoped                                                                                                                                                                                                                                                       |
| `openModal()` / `closeModal()` | 317–318              | Adds/removes `.open` on `#modal`                                                                                           | DOM only                                                                                                                                                                                                                                                                         |
| `fakePost()`                   | 319; button 310      | Closes modal and `alert('Demo: oferta publicada. 11 profesionales verificados encontrados con matching superior al 80%.')` | Nothing read from the form; message is hard-coded                                                                                                                                                                                                                                |

- 34 `<button>` elements, **19 without any handler** (Match, Ver candidatos ×2, Aplicar rápido ×3, Crear perfil
  verificado, Subir documentos, Publicar y avisar compatibles, Guardar borrador, Aplicar en 1 clic, Aplicar ×3,
  Ver requisitos, Ver, Entrevistar, Preseleccionar, Pedir doc.). 0 `<form>` elements; 18 inputs/selects with
  prefilled values that are never read.
- **No matching, scoring, availability or filter logic exists.** Every percentage (96, 91, 88, 89, 72, 92, 78) is a
  literal. The search/filter boxes are `<div class="input">` (lines 57, 104), not inputs.

### 3. Product claims and requirements

Roles and customers:

- Customers are "empresas MRO, operadores, aerolíneas y brokers" (line 46); plans split "talleres pequeños" /
  "MROs y operadores" / "aerolíneas, brokers y grupos" (277–279). Brokers are buyers, not a distinct recruiter role
  with "client represented" as in S1 (CF-F11).
- Supply side is "aeromecánicos" / "técnico" (46, 128). No technician account privacy of any kind is mentioned.

Verification and compliance:

- "Licencia Part-66, type ratings, cursos, recurrent, EWIS, HF, FTS, logbook, experiencia reciente, idiomas,
  DNI/pasaporte y derecho a trabajar" (74). Licence set "EASA Part-66: A, B1.1, B1.2, B2, C" (141); courses
  "HF, EWIS, FTS, SMS, CDCCL, Safety" (143); authority field "Autoridad: AESA" (157).
- Verification tiers: "Bronce: identidad. Plata: licencia y cursos. Oro: logbook revisado. Platino: referencias de
  empresas y experiencia reciente validada." (234). Badge "✓ Logbook revisado" (116) implies the platform reviews
  logbooks as evidence — **contradicts S7** (logbook "no oficial", S7 line 71) and S1 (logbook is self-declared,
  only `cvRelevant` entries go into the pack).
- Company compliance: "Checklist de requisitos, trazabilidad de selección, vencimiento de documentos, exportación de
  expediente y auditoría interna" (79); "Expediente exportable … PDF/ZIP" (235, 267).

Matching:

- "Ranking automático por licencia, habilitación, experiencia en tipo, distancia, disponibilidad, documentación
  vigente y reputación" (76). Flow: "Filtro compliance: El sistema descarta perfiles sin documentos o cursos
  vigentes" (251) then "Ranking por idoneidad, disponibilidad y experiencia reciente" (252). No weights, no formula.
- **Contradictions with S1/repo:** `distancia` and `reputación` are matching inputs here; S1 `je()` uses
  base/mobility as a soft factor and has no reputation at all; the repo (`CF-G01`) uses qualification + validity +
  availability only. AGENTS.md "LLM ≠ eligibility engine" is not touched (nothing here is AI), but "Matching
  inteligente" (76) is marketing wording with no stated method.
- "matching superior al 80%" (319) and "candidatos 90% compatibles" (241) are thresholds with no definition.

Availability and urgency:

- Profile: "Calendario, tarifa/hora, movilidad, turnos, AOG" (145). Company filters "puede empezar mañana",
  "disponible noches", "movilidad UE" (236). Availability granularity shown as hours-to-start (`24 h`, `48 h`,
  `Inmediata`, lines 221–223), **not** per-day states as in S1.
- Urgency on publish: "Enviar alerta AOG ahora" vs "Publicación normal" (177). "Modo AOG extremo: Botón rojo:
  publicar necesidad en 60 segundos y avisar por push/WhatsApp a candidatos 90% compatibles" (241); "notificación
  push/WhatsApp a candidatos compatibles" (265). No opt-in or consent is mentioned anywhere — **contradicts S1**
  (`aogOptIn`, `whatsappOptIn`, `dispatchAog` filters by opt-in) and the repo privacy direction.

Pricing / commission:

- Rates are hourly (`€58/h`, `€52/h`, `€60/h`, `€54/h`; lines 105, 106, 221–223). Extras: "hotel + desplazamiento"
  (175), "alojamiento incluido" (106). "Pago 7 días" (111) hints at platform-mediated payment terms.
- Business model: SaaS subscriptions for companies — Starter €149/mes (3 ofertas activas, 20 contactos/mes,
  Verificación básica), Ops Pro €499/mes (ofertas ilimitadas, pool privado, matching avanzado, modo AOG),
  Enterprise Custom (integración ATS/HR, multi-base, auditoría y compliance, API documental) (277–279).
  "Se puede empezar como marketplace y evolucionar a SaaS de staffing aeronáutico" (275). **No commission.**
  Neither S1 nor the inventory models billing (CF-F09 only shows "plan info"), so this is an open area, not a
  contradiction. The plan limits (active offers, contacts/month) would, if adopted, become authorization rules.
- "Tarifa recomendada / Tarifa inteligente" calculator "según urgencia, base, especialidad, turno, escasez de
  técnicos y experiencia" (238, 266) — not in S1.

Geography: MAD, Barcelona, Lisboa, Palma, Málaga; "movilidad UE" (116, 236). EU-centric, Spain-first.

Privacy: essentially absent. Only "Marketplace privado" (44) and "Pool privado y blacklist: … bloquean perfiles no
aptos" (239, 263). **The block direction is company→technician, the inverse of S1/CF-H02 (technician blocks
employer).** Candidate names and cities are shown to companies before any consent (114–116, 214–223) —
contradicts S1 `ir()` anonymised view and CF-H03.

Pipeline: lanes Aplicados → Preselección → Documentación → Contratado (214–217); actions Entrevistar,
Preseleccionar, Pedir doc. (221–223); "Contrato, documentación, rating posterior y trazabilidad" (254).
**Differs from S1 `fh()`** (Recibida → Preseleccionada → Propuesta → Aceptada → Confirmada → Finalizada): no
interview, no "Documentación" state, no post-job rating in S1.

Other: offer description is "generada" from structured fields (168, 178); "Chat con plantillas" over
"WhatsApp/email" (237); "Historial de trabajos … valoraciones, puntualidad, repetición y fiabilidad documental"
(242) and "Reputación técnica" (268).

### 4. Visual system

- **Palette (lines 11–16):** `--navy #071527`, `--navy2 #0b1f3a`, `--blue #1b4cff`, `--cyan #59d4ff`,
  `--orange #ff7a18`, `--green #19c37d`, `--red #ff5a66`, `--yellow #ffd166`, `--bg #f5f8fc`, `--card #ffffff`,
  `--text #101828`, `--muted #667085`, `--line #e6edf5`. Section alternates `#eef4fb` (84, 230, 273). Tag colours:
  blue `#eef4ff/#1849a9`, orange `#fff1e6/#b54708`, green `#e9fbf3/#087443` (line 21). Gradients everywhere
  (hero 21, CTA 22, logo 20, primary button orange→`#ff9d42`).
- **Type:** Inter 400–900; headline weights 800–900, h1 `clamp(42px,6vw,76px)` with `letter-spacing:-.07em`
  (21); body 14–18 px. Radii 20–36 px; large soft shadows (`0 22px 60px`, line 14). Density: low (marketing),
  except the kanban/table mocks.
- **Components:** sticky blurred header, pill, KPI tiles, fake macOS window (`.mac` dots, 21), tabs, dark sidebar,
  offer rows, talent rows with circular score, 5-step flow, pricing cards, modal, phone frame with bottom nav,
  kanban, "table-like" grid rows, dashed upload rows, mini progress bar.
- **Responsive:** one breakpoint at 900 px (lines 25, 27): all grids → 1 column, nav links hidden, `.mobile-menu`
  "Demo" button shown (36), phone mock un-rotated, `.row-like` tables collapse to 1 column (header row loses
  meaning — see `src-S6-390-aplicados.jpg`). At 390 px: no overflow, page is 14,652 px tall; readable but very
  long; the 5-column "tables" become stacked label-less cells.
- **vs S1 tokens:** same family, hotter. Navy `#071527` vs S1 `#0c2137` (darker/bluer); accent `#ff7a18` vs
  `#ff982f` (more saturated, redder); canvas `#f5f8fc` vs `#f5f7fa` (near identical); Inter in both. S6 adds
  cyan/electric blue (`#1b4cff`, `#59d4ff`) that S1 dropped. Emoji icons vs S1 Lucide.

### 5. Candidate features not in FEATURE_INVENTORY (CF-K…)

| ID     | Feature (location)                                                                                                                           | Actor         | Expected behaviour                                                                             | Recommendation                                                                                                                                                                          |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CF-K01 | Company private pool / favourites + blacklist (97, 239, 263)                                                                                 | org           | Save favourite technicians by base/fleet; block unsuitable profiles from future offers         | OPEN_DECISION — inverts S1/CF-H02 block direction and lets orgs retain lists of people; needs privacy ruling before any design                                                          |
| CF-K02 | Verification tiers Bronce/Plata/Oro/Platino (234)                                                                                            | platform      | Account-level trust badge derived from verified identity, licence/courses, logbook, references | DEFER — repo already has per-qualification `verification_status`; tiers are presentation and "references" imply a new flow; "Oro: logbook revisado" conflicts with S7/S1 logbook stance |
| CF-K03 | Exportable dossier PDF/ZIP for audits (79, 235, 267)                                                                                         | org           | Download pack as PDF/ZIP                                                                       | DEFER — S1 Candidate Pack (CF-E03) is the in-app equivalent; export format after packs exist                                                                                            |
| CF-K04 | Chat with message templates over WhatsApp/email (237)                                                                                        | org, pro      | Quick templates: rate, docs, travel, hotel, tools, shift, start date                           | DEFER — S1 application messages (CF-E04) first; templates later                                                                                                                         |
| CF-K05 | Recommended rate calculator by urgency/base/specialty/shift/scarcity (238, 266)                                                              | org           | Suggest €/h at publish time                                                                    | DEFER — needs market data the platform will not have at V1; no S1 equivalent                                                                                                            |
| CF-K06 | Expiry alerts to technician **and** company; console "Documentos: 12 vencen" (98, 240, 264)                                                  | pro, org      | Notify before EWIS/HF/FTS/SMS/licence/passport/medical/fiscal docs expire                      | ADAPT — fold into CF-A04 notifications using CF-D02 expiry chips; org-side view of candidates' expiries only for confirmed assignments (privacy)                                        |
| CF-K07 | "Modo AOG extremo": 60-second publish + push/WhatsApp to ≥90 % compatible (177, 241, 265)                                                    | org           | One-tap urgent publish and outreach                                                            | ADAPT — equals CF-G05 `dispatchAog`; keep S1's opt-in/eligibility filter (S6 has none); the 90 % threshold is an OPEN_DECISION parameter                                                |
| CF-K08 | Work history & reputation: ratings for punctuality, quality, documentation, communication, repeat hires; used in ranking (76, 242, 254, 268) | org, system   | Post-job rating; feeds matching                                                                | OPEN_DECISION — not in S1; using ratings in matching touches "deterministic hard eligibility" and worker privacy; must never enter hard checks                                          |
| CF-K09 | Pipeline lane "Documentación" + action "Pedir doc." (216, 223)                                                                               | org           | Company requests a missing document from a candidate                                           | ADAPT — model as a message/request on the application, not a new state in `fh()`                                                                                                        |
| CF-K10 | "Entrevistar" action (221)                                                                                                                   | org           | Schedule/record an interview step                                                              | DEFER — S1 state machine has no interview; add only if a real customer asks                                                                                                             |
| CF-K11 | Company console counters incl. "Facturación" and "Alertas AOG ON" (95–100)                                                                   | org           | Dashboard counters                                                                             | ADAPT — CF-F01 Resumen already covers needs/candidatures; "Facturación" depends on CF-K12                                                                                               |
| CF-K12 | SaaS plans with limits: Starter €149 (3 ofertas, 20 contactos/mes), Ops Pro €499, Enterprise (277–279)                                       | org, platform | Billing and plan-based entitlements                                                            | OPEN_DECISION — no billing in S1/repo; contradicts S7's pay-per-posting/pack model (S7 line 40)                                                                                         |
| CF-K13 | Enterprise: ATS/HR integration, multi-base, "API documental" (279)                                                                           | org           | Integrations                                                                                   | REJECT for V1 (YAGNI)                                                                                                                                                                   |
| CF-K14 | Auto-generated offer description from structured fields (168, 178)                                                                           | org           | Deterministic template text                                                                    | DEFER — S1 "Nueva necesidad" live summary already does this; no LLM needed                                                                                                              |
| CF-K15 | Identity + right-to-work verification "DNI/pasaporte y derecho a trabajar" (74, 140)                                                         | platform      | KYC-style identity check                                                                       | OPEN_DECISION — S1 only has self-declared `workCountries`; identity documents raise GDPR/retention questions (SECURITY_PRIVACY)                                                         |
| CF-K16 | Publish-time match preview "11 candidatos compatibles · 4 disponibles en 24 h · 2 con tarifa alta" (180)                                     | org           | Counts of eligible, available-soon and over-budget before publishing                           | ADOPT — same shape as the repo capacity board (CF-G03); "available within 24 h" is a small derived slice; "tarifa alta" is already a soft factor in S1                                  |
| CF-K17 | Technician sees which document/course blocks an application ("Falta curso", 198, 203)                                                        | pro           | Explain ineligibility                                                                          | ADOPT — already S1 CF-E01 "hard pending count"; S6 confirms the requirement                                                                                                             |
| CF-K18 | "Pago 7 días" payment-terms badge (111)                                                                                                      | org           | Platform-mediated payment terms                                                                | REJECT — payments out of scope; no S1 evidence                                                                                                                                          |
| CF-K19 | Licence issuing authority field ("Autoridad: AESA", 157)                                                                                     | pro           | Store authority per licence                                                                    | ADAPT — one column on qualifications; cheap and useful for verification (OPEN_DECISION on data model, small)                                                                            |
| CF-K20 | Hours-to-start availability ("24 h", "48 h", "Inmediata", 221–223)                                                                           | pro           | Lead-time semantics                                                                            | REJECT — S1 per-day calendar (and repo windows) subsume it; derive "can start within N h" from windows if needed                                                                        |

### 6. Personal data or secrets

- Person names (fictional-looking, first name + surname initial): lines 114, 115, 116, 153 (full name on 153),
  214, 215, 216, 217, 221, 222, 223. Avatar initials: 61, 114–116, 153.
- No emails, phones, keys, tokens or URLs other than Google Fonts (7–9). Document filenames (158) are generic.
- Dates: `2026-07-03` (304).

---

## S7 · `index-1.html` — "JobSlice Aero — MVP Técnicos"

### 1. Nature

- **Type:** mobile-first app MVP demo for the **technician side only**, framed as a phone (`.phone` max-width
  440 px, line 13) centred on a gradient backdrop (`.wrap`, line 12). Header tagline "MVP técnicos · demo móvil"
  (21). Nine screens, some light interactivity, working calculators.
- **Language:** Spanish (`lang="es"`) with many English product labels: "Private by default" (21), "Available
  72h", "Anonymous mode" (55), "Expiring soon", "Ready", "Due in 3 months" (78), "Open to extra work" (91),
  "Travel covered" (65), "Candidate Pack" (40, 64, 95–97), "Document wallet" (77), "Fuel calculator" (83).
- **Framework:** none. Plain HTML + `<style>` (7–16) + vanilla JS (104–117).
- **External deps:** **none**. Inter is named in `font-family` (11) but never loaded → always falls back.
- **Navigation:**
  - `screens` array (105) builds a horizontally scrollable chip bar: Inicio, Registro, Pasaporte, Ofertas,
    Logbook, Docs, Tools, Privacidad, Candidate Pack.
  - Fixed bottom nav with 5 items (100): home, passport, jobs, logbook, tools. `docs`, `privacy`, `pack` and
    `onboarding` are reachable only from the chip bar or CTAs (30, 49).
  - `go(id)` (107) toggles `.screen.active`, syncs chips and bottom nav, scrolls to top.
  - Bottom sheet `#applyModal` (103); toast `#toast` (102).
- **State / storage:** none persisted. No `localStorage`. The only data structure is `taxRates` (114). All other
  "data" is inline HTML.
- **Mock entities (inline):**
  - _Technician_ "Marcos B." (55–58): role `B1.1 Licensed Engineer`, base Madrid, 8 years, badges `Available 72h`,
    `Anonymous mode`, profile 82 % ("faltan 2 cursos por subir"), licence B1.1 / EASA Part-66, aircraft `A320
Family · 5y`, `B737 NG · 2y`, engines `CFM56`, `LEAP-1A`, skills Line Maintenance, AOG Support,
    Troubleshooting, Engine Change, courses EWIS, FTS, `HF caduca en 42 días`, target rate `€390/día`, derived
    `€1.170` for 3 days, experience per aircraft with environment (A320 5 años Line; B737 NG 2 años Base; ATR 72 8
    meses).
  - _Onboarding inputs_ (45–48): goal (4 options), primary role (7 options incl. `Unlicensed mechanic`), base,
    initial availability (3 options incl. `Open to opportunities confidentially`).
  - _Jobs_ (64–66): title, city, days, start, match %, day rate (`390/320/410 €/día`), aircraft/skill badge, course
    badge, `Travel covered`, hard-fail badge `Falta B2`.
  - _Logbook entries_ (72–73): date, aircraft, category (6 options), private description; 3 timeline items.
  - _Documents_ (78): EASA Part-66 B1.1 (`Válido`, "visible solo si aplicas"), Human Factors (`Expiring soon`),
    EWIS + FTS (`Ready` for pack), Tool calibration certificate (`Due in 3 months`).
  - _Privacy toggles_ (91): Perfil privado (off), Perfil anónimo (on), Visible a empresas verificadas (on), Open
    to extra work (on).
  - _Candidate Pack_ (97): match 94 %, included docs, protected data, contact channel.
  - _Tax model_ (114): flat retention per country — Spain 0.35, UK 0.34, Germany 0.42, France 0.38,
    Netherlands 0.40, Switzerland 0.27, each with a disclaimer string.
  - No companies, no applications list, no calendar, no ratings.

### 2. Structure and interactions

| #   | Screen id     | Lines | Heading                                                 | Components                                                                                                                                                                                                                                                                                                |
| --- | ------------- | ----- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | header `.top` | 20–23 | "JobSlice Aero · MVP técnicos · demo móvil"             | logo, status pill "Private by default", chip tabs (JS-built)                                                                                                                                                                                                                                              |
| 1   | `#home`       | 25–41 | "Tu carrera TMA organizada y lista para oportunidades." | hero with eyebrow "Pasaporte + trabajo extra + herramientas", 2 CTAs, mini match card (`A320 B1.1 match 94%`, `3 días · Madrid · 390 €/día`, `WhatsApp opt-in`), 2 metrics (82 % perfil, 3 ofertas), "Por qué un técnico lo usaría" with 4 items, dark card "Modelo de negocio integrado desde el inicio" |
| 2   | `#onboarding` | 43–52 | "Registro técnico"                                      | 5-dot stepper (3 on), 4 fields, "Continuar", badge list "Campos que se piden en fases"                                                                                                                                                                                                                    |
| 3   | `#passport`   | 54–59 | "Marcos B."                                             | profile head with avatar + badges, progress 82 %, "Badges técnicos" chip cloud, 2 metrics (rate/day, 3-day estimate), "Experiencia por avión" 3-tile grid                                                                                                                                                 |
| 4   | `#jobs`       | 61–68 | "Modo trabajo extra"                                    | dark card with "Disponible 72h" + "WhatsApp opt-in", 3 job cards with match pill and CTA                                                                                                                                                                                                                  |
| 5   | `#logbook`    | 70–74 | "Logbook personal"                                      | disclaimer card + product note, quick-entry form (date, aircraft, category, description), timeline of 3 entries                                                                                                                                                                                           |
| 6   | `#docs`       | 76–79 | "Document wallet"                                       | 4 document items with status badges                                                                                                                                                                                                                                                                       |
| 7   | `#tools`      | 81–87 | "Herramientas rápidas"                                  | Fuel calculator, Conversor técnico, Estimador neto orientativo (+ 3-row tax table), Simulador de ingresos extra                                                                                                                                                                                           |
| 8   | `#privacy`    | 89–93 | "Privacidad y control"                                  | 4 toggle rows (static), "Protecciones" list (Bloquear empresa actual, Vista previa antes de enviar, WhatsApp solo con consentimiento)                                                                                                                                                                     |
| 9   | `#pack`       | 95–98 | "Candidate Pack"                                        | 4 items (match, documents, protected data, contact channel) + "Enviar aplicación demo"                                                                                                                                                                                                                    |
| —   | `.bottom`     | 100   | —                                                       | fixed 5-item nav                                                                                                                                                                                                                                                                                          |
| —   | `#applyModal` | 103   | job title                                               | sheet: badges "Licencia incluida / A320 incluido / Empresa actual oculta / HF caduca pronto", logbook notice, Cancelar / Aplicar                                                                                                                                                                          |

Interactions (every handler):

| Handler                                             | Lines     | Effect                                                                                            | State / computation            |
| --------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------- | ------------------------------ |
| chip tab build + `go(id)`                           | 105–108   | Switch screen, sync chips and bottom nav, `scrollTo(0,0)`                                         | DOM only                       |
| `toast(t)`                                          | 109       | Show message 2.6 s                                                                                | DOM only                       |
| "Continuar"                                         | 49        | `go('passport')` + toast "Perfil creado como privado. Puedes activar visibilidad cuando quieras." | nothing read from the 4 fields |
| "Disponible 72h"                                    | 62        | toast "Disponibilidad activada para próximas 72 horas."                                           | no state                       |
| "WhatsApp opt-in"                                   | 62        | toast "Avisos WhatsApp activados con consentimiento."                                             | no state                       |
| "Aplicar con Candidate Pack" / "Ver Candidate Pack" | 64, 65    | `openApply(title)` → sheet with title                                                             | DOM                            |
| "No compatible total"                               | 66        | toast "No recomendable: tu perfil no cumple B2."                                                  | no state                       |
| "Guardar entrada"                                   | 72        | toast "Entrada guardada en logbook personal."                                                     | no state; timeline not updated |
| "Enviar aplicación demo"                            | 97        | toast "Candidate Pack enviado en modo demo."                                                      | no state                       |
| sheet "Aplicar"                                     | 103       | `closeApply()` + toast "Solicitud enviada. La empresa recibe tu Candidate Pack."                  | no state                       |
| sheet backdrop click                                | 110       | closes sheet                                                                                      | DOM                            |
| `fuelCalc()`                                        | 112       | `litres × density` → `fmt(…,'kg')`                                                                | pure, live on input            |
| `convCalc()`                                        | 113       | factors kg→lb 2.20462, lb→kg ÷2.20462, l→US gal 0.264172, Nm→lb·ft 0.737562, bar→psi 14.5038      | pure                           |
| `taxCalc()`                                         | 114–115   | `net = gross × (1 − rate[country])`; note text + "Retención estimada: N%"                         | pure, flat rate                |
| `incomeCalc()`                                      | 116       | `days × rate`                                                                                     | pure                           |
| Privacy `.switch` toggles                           | 91        | **no handler** (static divs)                                                                      | —                              |
| Onboarding/logbook/pack inputs                      | 45–48, 72 | never read                                                                                        | —                              |

- **No matching formula.** The 94/81/67 % values are literals. Note that the ineligible job (`Falta B2`, line 66)
  still displays `67% match` — a score is shown for a hard-failed candidate.
- Number formatting is `es-ES` (`Intl.NumberFormat`, 111, 113).

### 3. Product claims and requirements

Positioning and roles:

- Technician-first: "No es solo una bolsa de empleo. Es una herramienta personal: documentación, experiencia,
  logbook privado, CV técnico, disponibilidad y oportunidades reales cuando quiera ganar dinero extra." (34).
  "Trabajo extra" / moonlighting framing throughout (27, 36, 62, 86, 91).
- Roles offered at onboarding (46): B1.1 / B2 Licensed Engineer, Cat A Mechanic, Sheet Metal / Structures,
  Avionics Technician, Engine specialist, Unlicensed mechanic. Close to S1 categories (B1.1, B2, Cat A, Cat C,
  Mecánico, Sheet Metal, NDT, Helper); S7 has no Cat C/NDT/Helper and adds Engine specialist/Avionics.
- **No company side exists.** Companies appear only as payers (40) and recipients of packs (96–97).

Business model: "Primero se capta masa crítica de técnicos con una utilidad real. Después las empresas pagan por
publicar necesidades, acceder a Candidate Packs y activar alertas urgentes." (40). Free for technicians; pay-per-
posting / pack access / urgent alerts. **Contradicts S6's subscription tiers.** No prices, no commission.

Pricing of work: **daily** rates (`390 €/día`, `tarifa/día objetivo`, lines 31, 57, 64–66, 86). S6 is hourly. S1
reconciles both (job `hourlyRate`, profile `dailyRate` + `minRateType`).

Availability: "Tengo 3 días libres → ofertas compatibles con licencia, avión, país y tarifa" (36); "El técnico
marca cuándo puede trabajar. El sistema compara ofertas y envía avisos solo si encajan." (62); one-tap "Disponible
72h" (62); onboarding "Disponible para trabajos extra puntuales / Open to opportunities confidentially / No
disponible ahora" (48). No calendar UI (S1 adds the month calendar). Windows-with-a-horizon semantics are closer to
the repo's `availability_windows` than S1's per-day enum.

Matching inputs (as stated): "disponibilidad, licencia y avión" (29); "licencia, avión, país y tarifa" (36);
pack lists "B1.1, A320 Family, Line Maintenance, CFM56/LEAP, disponibilidad 72h" (97). Engines appear as matching
evidence → origin of S1 `engines[]` (repo: CF-B04 SOURCE_ONLY). No weights.
**Contradiction with repo rule "soft score only for eligible":** 67 % shown with `Falta B2` (66).

Verification / compliance: licence `EASA Part-66 B1.1` "Subido · privado · visible solo si aplicas" (78);
courses HF/EWIS/FTS with expiry; `Tool calibration` certificate with recalibration alert (78) — new document type.
Logbook: "Uso personal, no oficial … No incluye validación por supervisor ni sustituye registros de empresa" (71);
"no se presentan como documento oficial Part-145/Part-66/OJT" (71); "El logbook personal no se comparte salvo que
el usuario marque entradas como 'CV relevant'. No tiene valor oficial." (103). → S1 `cvRelevant` (CF-I01).
**Contradicts S6** "Oro: logbook revisado" / "✓ Logbook revisado".

Privacy (the core of S7):

- "Private by default" (21); toast "Perfil creado como privado" (49).
- Modes (91): "Perfil privado — Nadie te encuentra. Solo cuaderno y documentos."; "Perfil anónimo — Empresas ven
  skills, no nombre ni empresa actual."; "Visible a empresas verificadas — Contactan solo si aceptas desbloquear
  datos."; "Open to extra work — Recibir ofertas compatibles y avisos." These four are the origin of S1's
  `visibility` enum (private | anonymous | verified | open) and of repo OD C-7. **Nuance:** S7 presents them as
  independent switches (anonymous **and** verified both ON at once), not an exclusive enum.
- "Bloquear empresa actual — Evita que tu empleador vea tu perfil aunque busque candidatos." (92) → S1
  `blockEmployer` / CF-H02 (technician-side, opposite of S6's company blacklist).
- "Vista previa antes de enviar — El usuario revisa qué documentos salen en cada candidatura." (92) + sheet (103).
- "WhatsApp solo con consentimiento — Se activa explícitamente y se puede apagar en cualquier momento." (92).
- Pack: "Empresa actual oculta. Contacto desbloqueado solo al aplicar." (97). **Looser than S1/CF-H04**, where
  contact is released only with consent **and** an accepted application; S7 releases on apply.
- Contact channel preference "WhatsApp / email / chat interno" (97).

Tools disclaimers: "Siempre con aviso de 'uso orientativo/no operacional'" (82); "Usar siempre datos oficiales de
fuel slip/uplift y procedimientos de compañía." (83); "no asesoramiento fiscal" (85). Consistent with S1's
illustrative-rates disclaimer (CF-I02).

Geography: Madrid, Lisbon, Barcelona (64–66); tax countries ES, UK, DE, FR, NL, CH (85, 114).

Urgent/AOG: only as a skill badge "AOG Support" (56) and "alertas urgentes" as a paid company feature (40). No AOG
day state, no dispatch.

### 4. Visual system

- **Palette (line 9):** `--navy #07182f`, `--navy2 #0c274b`, `--blue #18558f`, `--sky #67a7ff`,
  `--orange #ff8a1f`, `--amber #ffbd66`, `--green #37d399`, `--mint #c8ffe9`, `--red #ff6b6b`,
  `--purple #9b7cff`, `--bg #f4f7fb`, `--card #fff`, `--ink #142036`, `--muted #66768d`, `--line #dbe5f1`,
  `--soft #eef4fb`. Badge variants orange/green/blue/red/purple (15). Backdrop gradient `#edf4ff→#f9fbfd` (11).
- **Type:** Inter requested but not loaded; weights 650–950 (`font-weight:950` on logo/badges/match, line 14–15);
  h1 31 px `letter-spacing:-.055em`; body 13–14 px; mini labels 10–11 px. Radii `--r 24px`, `--rs 16px`.
- **Density:** high for mobile — stacked cards with 15 px padding, chip clouds, 2-col metric grids, 3-col tile grid.
- **Components:** sticky dark header with status pill and scrollable chip tabs, hero card with rounded bottom,
  metric tiles, item lists with icon squares, badge rows, progress bar, stepper dots, toggle switches (static),
  job card with match pill, timeline, dark "calcOut" result panels, tax table with pill rows, fixed bottom nav
  with emoji-ish glyphs, bottom sheet, toast.
- **Responsive:** no media queries. At 390 px the phone column is the viewport (no overflow; screen heights
  844–1616 px). At 1440 px the same 440 px column is centred on the gradient — **there is no desktop layout**
  (`src-S7-1440-jobs.jpg`). `viewport-fit=cover` + `env(safe-area-inset-bottom)` (5, 15) show iOS intent.
- **vs S1 tokens:** closest ancestor of S1. Ink `#142036` vs S1 `#172c44`; navy `#07182f` vs `#0c2137`; accent
  `#ff8a1f` vs `#ff982f` (one step away); canvas `#f4f7fb` vs `#f5f7fa`; `--soft #eef4fb` matches S6 section
  background. Inter in both. S7 adds purple (`#9b7cff`) for privacy/skill badges, absent in S1.

### 5. Candidate features not in FEATURE_INVENTORY (CF-L…)

| ID     | Feature (location)                                                                                                                                                                                     | Actor    | Expected behaviour                                              | Recommendation                                                                                                                                 |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| CF-L01 | Onboarding intent question "¿Qué quieres conseguir?" (Organizar carrera / Solo perfil privado / Trabajos extra / Logbook) + initial availability incl. "Open to opportunities confidentially" (45, 48) | pro      | First-run choice that sets initial visibility and availability  | ADAPT — map onto the visibility enum and an optional first window; good copy for the passport wizard entry (CF-B02)                            |
| CF-L02 | "Private by default" account creation (21, 49)                                                                                                                                                         | platform | New professional profiles start `private`                       | ADOPT — consistent with S1 and repo privacy direction; verify the column default in the migration                                              |
| CF-L03 | Phased profile fields with progress and "faltan 2 cursos por subir" hint (44, 51, 55)                                                                                                                  | pro      | Skippable steps, completeness % with the next missing item      | ADOPT — CF-B01 completeness is PARTIAL; this is the pattern to finish it                                                                       |
| CF-L04 | Engines (CFM56, LEAP-1A) and per-aircraft experience with years + environment Line/Base (56, 58)                                                                                                       | pro      | Qualification detail beyond category/type rating                | OPEN_DECISION — already OD via CF-B04; S7 adds "years per aircraft" granularity and Line/Base environment (which S1 keeps only in the logbook) |
| CF-L05 | One-tap "Disponible 72h" (55, 62)                                                                                                                                                                      | pro      | Create a 72 h availability window from now                      | ADAPT — a quick action over CF-C02 windows; no new model                                                                                       |
| CF-L06 | WhatsApp opt-in: explicit, revocable, consent-worded (62, 92)                                                                                                                                          | pro      | Store channel consent                                           | DEFER — equals CF-G06 (phase 7); keep S7's consent wording when it lands                                                                       |
| CF-L07 | Apply preview sheet: shows exactly what the company will see, with warnings (HF caduca pronto, Empresa actual oculta) before sending (92, 103)                                                         | pro      | Mandatory preview before an application is created              | ADOPT — strengthens CF-E03 and CF-H04; consent-by-design; cheap                                                                                |
| CF-L08 | Contact-channel preference WhatsApp / email / chat interno in the pack (97)                                                                                                                            | pro      | Preferred channel released with contact                         | DEFER — depends on CF-H04 and CF-G06                                                                                                           |
| CF-L09 | "Tool calibration" certificate as a document with recalibration alert (78)                                                                                                                             | pro      | New document block/type with due date                           | ADAPT — extend S1 blocks (Licencias / CV / Cursos / Permisos) with "Herramientas"; reuse CF-D02 expiry                                         |
| CF-L10 | Logbook non-official disclaimer and "CV relevant" sharing gate (71, 103)                                                                                                                               | pro      | Logbook never leaves the account unless marked; disclaimer text | ADOPT — already S1 `cvRelevant` (CF-I01); keep S7's wording verbatim                                                                           |
| CF-L11 | Ineligible job still listed with reason and no apply ("Falta B2", "No compatible total", 66)                                                                                                           | pro      | Show incompatible offers with the blocking reason               | ADAPT — keep the reason, but **do not show a % score for ineligible** (repo rule CF-G02); S1 shows "hard pending count" instead                |
| CF-L12 | Tools with concrete formulas/constants: fuel (l×ρ), converter (5 pairs), net estimator (flat rates ES .35 / UK .34 / DE .42 / FR .38 / NL .40 / CH .27), extra-income (days×rate) (112–116)            | pro      | Client-side utilities                                           | DEFER — already CF-I02 (SOURCE_ONLY, phase 7); S7 supplies the reference implementation; S1 adds length converter + glossary                   |
| CF-L13 | Business model: free for technicians; companies pay per posting / pack access / urgent alerts (40)                                                                                                     | platform | Monetisation                                                    | OPEN_DECISION — contradicts S6 subscriptions; nothing in S1/repo                                                                               |
| CF-L14 | Mobile IA: 5-item bottom nav (Inicio/Perfil/Ofertas/Logbook/Tools) + chip bar (100, 105)                                                                                                               | pro      | Navigation                                                      | REJECT as a feature (Next.js routing); usable as a hint for the mobile nav order                                                               |
| CF-L15 | Visibility as independent toggles (anonymous + verified both ON) (91)                                                                                                                                  | pro      | Combinable privacy switches                                     | REJECT — S1/repo use an exclusive enum; combinations are ambiguous (OD C-7 covers the 3-vs-4 question)                                         |
| CF-L16 | Passport metrics: target day rate and "3 días extra estimados" (57)                                                                                                                                    | pro      | Derived earnings hint                                           | DEFER — pure client arithmetic; after CF-B05 rate fields exist                                                                                 |
| CF-L17 | Contact released "solo al aplicar" (97)                                                                                                                                                                | system   | Contact visible to the org once an application is sent          | REJECT — S1/CF-H04 require consent + accepted application; keep the stricter rule                                                              |

### 6. Personal data or secrets

- Person name (fictional-looking, first name + initial): line 55; initials line 55.
- No emails, phones, keys, tokens, URLs. Dates `2026-08-02`, `28 Jul 2026`, `20 Jul 2026` (72–73).

---

## Evolution — what S6 and S7 say about the road to S1

Only statements the files support; ordering is inferred, not documented.

- **Naming:** "Lutes Recrew" (S6) and "JobSlice Aero" (S7) precede "Crew Flex". No file references the other or
  Crew Flex. The only chronology hint is weak: S6's demo start date is `2026-07-03` (S6 304) and S7's demo dates
  are `20–28 Jul` and `2026-08-02` (S7 72–73), consistent with S6 → S7, but both are mock dates.
- **Audience flip:** S6 is company-centric (hero "Contrata técnicos…", S6 45; company console; SaaS pricing).
  S7 is technician-centric ("Tu carrera TMA…", S7 28; "Primero se capta masa crítica de técnicos", S7 40) and has
  no company screens. S1 merges both: its Técnico tabs (Mi pasaporte, Disponibilidad, Wallet documental, Logbook,
  Herramientas, Privacidad) are S7's screens one-to-one, and its Empresa/Recruiter tabs (Nueva necesidad, Buscar
  candidatos, Candidaturas pipeline, AOG dispatch, Organización) are S6's "Panel empresa", "Publicar anuncio" and
  "Candidatos empresa" mock-ups made functional. S6's "brokers" (46, 279) became S1's Recruiter role.
- **Vocabulary that survived:** "Candidate Pack" first appears in S7 (40, 64, 97) and is kept by S1 (`ph()`);
  "Pasaporte técnico" appears in S6 as an exportable dossier (235) and in S7 as the profile screen (35) → S1 "Mi
  pasaporte"; "Document wallet" (S7 77) → S1 "Wallet documental"; "Expediente" (S6 79, 180, 217) was replaced by
  "pack"; "Logbook" and "AOG" are in all three.
- **Privacy:** absent in S6 (names shown to companies, company-side blacklist) → central in S7 (4 modes, block
  current employer, preview before send, WhatsApp consent, "contacto desbloqueado solo al aplicar") → S1 formalised
  as `visibility` enum + `blockEmployer` + consent + anonymised view, and tightened contact release to consent +
  accepted application. The repo's OD C-7 (3 vs 4 visibility levels) traces directly to S7's fourth toggle
  "Visible a empresas verificadas" (S7 91).
- **Availability:** S6 talks in lead times ("24 h", "48 h", "puede empezar mañana") and roadmaps a calendar (236);
  S7 uses short windows ("Disponible 72h", "Tengo 3 días libres"); S1 built the month calendar with per-day states
  and shift patterns (OD C-8). The repo's time-window model is closer to S7 than to S1.
- **Matching:** S6 lists ranking by "licencia, habilitación, experiencia en tipo, distancia, disponibilidad,
  documentación vigente y reputación" after a "filtro compliance" (76, 251–252); S7 lists "licencia, avión, país y
  tarifa" + availability and introduces engines (36, 56, 97). S1's `je()` keeps the two-stage idea (hard checks →
  soft score 75/25), adopts S7's engines and country and S6's "cursos vigentes" (validity through end date),
  and drops S6's distance and reputation. Neither earlier file defines a formula; the 75/25 weighting is S1's own.
- **Pricing:** S6 = €/h for work + company SaaS subscriptions (€149/€499/Custom) + "tarifa recomendada";
  S7 = €/día for work + companies pay per posting/pack/alert. S1 stores both rate units and only a "plan" label on
  the organisation; no billing. The monetisation question was never resolved in any source.
- **Dropped between S6 and S1:** reputation/ratings, recommended-rate calculator, company private pool/blacklist,
  verification tiers, interview step, ATS/HR integrations, PDF/ZIP export, payment terms. **Dropped between S7 and
  S1:** nothing substantive; S1 adds a calendar, applications list, documents upload and a company side.
- **Visual identity:** navy + orange + light canvas + Inter is constant across S6, S7 and S1. S6 is the hottest
  (electric blue/cyan, `#ff7a18`), S7's tokens are the closest to S1's (`#142036`/`#ff8a1f`/`#f4f7fb` vs
  `#172c44`/`#ff982f`/`#f5f7fa`), so S1's palette is a toned-down S7.
