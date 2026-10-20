# 03 · Business rules: V1.3 demo vs V1.3 server vs Next

> Phase 0.8 (2026-10-15). Sources read line by line: `src/business.js` (demo), `server/rules.mjs`
>
> - `server/app.mjs` (beta server), `src/domain/*.ts` + `supabase/migrations/*` (Next).
>   **No Next rule was changed because V1.3 behaves differently.** Resolutions marked "keep Next"
>   follow the source priority in the phase brief (security → current product rules → verified
>   implementation → V1.3 behaviour → V1.3 docs → historical docs).

## 1. Engine comparison

### Qualifications

| Rule                | V1.3 Demo (`business.js`)                                                                                          | V1.3 Server (`rules.mjs`/`app.mjs`)                                                                                | Next (`src/domain`)                                                                                   | Resolution                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Category / licence  | `p.categories.includes(j.category)` (string)                                                                       | `profile.category === job.category` (single string)                                                                | Catalog type `LICENSE`, held + **verified** + valid                                                   | Keep Next                                                       |
| Aircraft            | `j.aircraft.some(a => p.aircraft.includes(a))` (any-of)                                                            | Comma-split string, case-insensitive equality                                                                      | One TYPE_RATING per required type (all-of)                                                            | Keep Next; add any-of groups later (05 §R3, C-10)               |
| Type rating         | Required only if `requireType`: rating for that aircraft **and** category, valid to `endDate`, **no restrictions** | `requiresLicense` parsed but **ignored by `eligible()`**; only checked at confirmation (reviewed licence document) | TYPE_RATING hard requirement, verified, valid for the period; no category pairing, no restrictions    | **R-02**                                                        |
| Validity            | `expiry >= endDate` (demo dates, Europe/Madrid "today")                                                            | `expires >= last shift end date`                                                                                   | `validityForPeriod`: expired / expires_during / valid against `[startsAt, endsAt)`, UTC day inclusive | Equivalent intent; keep Next (explicit `expires_during` reason) |
| Verification        | **Not checked** — self-declared ratings/courses satisfy hard requirements                                          | **Not checked by `eligible()`**; profile `review` + document review only gate **confirmation**                     | Hard: only `verified`; soft: verified or pending (flagged)                                            | **R-01** keep Next                                              |
| Restrictions        | Non-empty `restrictions` on the rating ⇒ not eligible                                                              | Free-text profile `restrictions` blocks outreach and confirmation, **not** applying                                | No field                                                                                              | **R-02**                                                        |
| Mandatory training  | `courses[]` valid to end                                                                                           | `requiredCourses` valid to last shift                                                                              | TRAINING type hard                                                                                    | Equivalent                                                      |
| Experience          | Hard `years >= minYears`                                                                                           | Hard `years >= minYears`                                                                                           | Informational (BR-5.4)                                                                                | **R-04**                                                        |
| Skills              | `hardSkills` hard, `softSkills` soft (strings)                                                                     | `requiredSkills` hard (strings)                                                                                    | SKILL catalog rows hard/soft                                                                          | Keep Next (catalog, no free text)                               |
| Tools               | `ownTools` hard                                                                                                    | —                                                                                                                  | —                                                                                                     | Later (C-9)                                                     |
| Work permit country | Hard `workCountries.includes(country)`                                                                             | Hard `countries.includes(country)` (EU-27)                                                                         | —                                                                                                     | **R-05**                                                        |
| Engines             | Hard if listed                                                                                                     | —                                                                                                                  | —                                                                                                     | C-10                                                            |

### Matching

| Rule              | V1.3 Demo                                                                      | V1.3 Server                                       | Next                                           | Resolution                            |
| ----------------- | ------------------------------------------------------------------------------ | ------------------------------------------------- | ---------------------------------------------- | ------------------------------------- |
| Hard requirements | `eligible = hard.every(ok)`                                                    | `eligible()` returns error list; apply needs none | `eligible = blockers.length === 0`             | Same principle                        |
| Soft requirements | Budget, base-or-mobility, English ≥ B2, soft skills                            | —                                                 | Soft qualifications only                       | Keep Next until C-10                  |
| Score             | `75 × hardOk/hard + 25 × softOk/soft` — **non-zero for ineligible candidates** | None                                              | `softScore` 0–100, **0 if ineligible**         | **R-03** keep Next                    |
| Explanations      | Labels per check (Spanish strings)                                             | Error strings                                     | Typed blockers/reasons (codes), i18n in the UI | Keep Next                             |
| Blocks            | `canSeeCandidate` (privacy, blocked employer) before matching                  | `visible`, `blocked[]`, restrictions              | Pool RPC: private excluded, members internal   | Add blocked orgs to the RPC (V13-P24) |
| Ordering          | By affinity                                                                    | —                                                 | eligible → softScore desc → id                 | Keep Next (deterministic)             |
| Budget            | Soft; hard only if `rateMandatory`                                             | —                                                 | —                                              | OD-7/C-9                              |

### Availability

| Rule                  | V1.3 Demo                                                            | V1.3 Server                                                    | Next                                                     | Resolution                                                    |
| --------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| Model                 | Per-day map `available/off/aog/working/assigned`                     | List of `{start,end}` UTC intervals (≤100)                     | `availability_windows` intervals `available/unavailable` | Keep Next                                                     |
| Overlaps              | n/a (one state per day)                                              | A **single** window must contain each shift (no merge)         | Merge overlapping/adjacent available windows             | Keep Next (strictly more correct)                             |
| Unavailable periods   | `off` ≠ available                                                    | No unavailable concept                                         | `unavailable` overrides `available` (BR-4.2)             | Keep Next                                                     |
| Partial               | `split` jobs accept a subset ≥ `minDays`, consecutive blocks         | `allowPartial` + `minShifts` + consecutive                     | Partial = **not eligible**, reported with % (BR-4.4)     | **R-06**                                                      |
| Days / shifts         | Job `days[]` subset                                                  | `shifts[]` ≤24 h, one per local date                           | One continuous period                                    | C-9 (05 §R4)                                                  |
| Confirmed assignments | Confirmed days become `assigned`; matching ignores days already full | Overlap with another confirmed application blocks confirmation | None (no assignments)                                    | Block 3 must subtract confirmed assignments from availability |
| AOG-only              | `aog` day usable only when job urgency is AOG **and** `aogOptIn`     | Opt-in for alerts only                                         | None                                                     | **R-07**                                                      |
| Time base             | Europe/Madrid calendar days                                          | IANA zone per job; UTC instants                                | UTC instants; expiry by UTC day                          | Keep Next; display zone is UI-only                            |

### Contracting

| Rule                 | V1.3 Demo                                                                                              | V1.3 Server                                                                                                                 | Next | Resolution                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------- |
| States               | Recibida, Preseleccionada, Propuesta, Aceptada, Confirmada, Finalizada, Rechazada, Retirada, Cancelada | received, shortlisted, proposed, accepted, confirmed, finished, withdrawn, rejected, cancelled                              | —    | Adopt the server names (English enum) — **R-08**           |
| Transitions          | Aceptada → Propuesta (re-proposal) allowed; Aceptada → Cancelada **not** allowed                       | accepted → cancelled allowed; no re-proposal                                                                                | —    | **R-08**                                                   |
| Actors               | Tech: Aceptada, Retirada; company: the rest; both: Cancelada                                           | Tech: accepted, withdrawn; owner: the rest                                                                                  | —    | Same; tech may not cancel a confirmed assignment in server |
| Reasons              | Cancelada needs reason                                                                                 | rejected and cancelled need reason (1–1000)                                                                                 | —    | Server rule                                                |
| Confirmation checks  | Published, future days, no tech overlap, per-day headcount                                             | + org reviewed, profile reviewed without restrictions, eligibility, not blocked, licence/course evidence reviewed and clean | —    | Server list + Next verified-qualification rule             |
| Finalisation         | After last day                                                                                         | After last shift end; creates draft invoice                                                                                 | —    | No invoices (OUT)                                          |
| Seats / day coverage | Distinct confirmed people per day ≤ people                                                             | Per shift ≤ headcount                                                                                                       | —    | Per-shift coverage (block 3)                               |
| Idempotency          | Commit queue                                                                                           | `BEGIN IMMEDIATE`, one active application per job                                                                           | —    | Unique (requirement, technician) active + idempotency key  |

### Privacy

| Rule                   | V1.3 Demo                                             | V1.3 Server                                                            | Next                                                                       | Resolution                                                                                           |
| ---------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Private                | Never visible                                         | `visible:false`                                                        | Excluded from external pool; **visible to own org admins/managers** (OD-4) | Keep Next; OD-4 still open                                                                           |
| Anonymous              | `Técnico <code>`                                      | `T-<8 hex of user id>` (stable, derived from internal id)              | `CF-<sha256(req:profile)>` per requirement                                 | Keep Next (non-linkable across requirements)                                                         |
| Open                   | Name visible                                          | —                                                                      | Name visible                                                               | Same                                                                                                 |
| Verified organizations | Visible only to `o.verified` (self-set in demo!)      | —                                                                      | —                                                                          | OD-5/C-14                                                                                            |
| Contact                | Unlocked after Aceptada + explicit `contactConsent`   | Email after accepted + `consentContact`                                | Never exposed                                                              | Adopt demo rule in block 3                                                                           |
| Identity documents     | Protected placeholders until unlock (`projectedPack`) | Download needs `consentPack && consentContact` + accepted + clean scan | —                                                                          | Adopt `projectedPack` semantics; tie files to **pack** consent + acceptance (not contact) — **R-09** |
| Consent                | Two checkboxes per application                        | `consentPack` required, `consentContact` optional                      | —                                                                          | Block 3                                                                                              |

## 2. Conflicts that need a resolution

Each item: current behaviour · V1.3 behaviour · impact · risk · alternatives · recommendation · decision.

### R-01 — Self-declared qualifications satisfy hard requirements in V1.3

- **Next:** hard requirements accept only `verified` (BR-3, C-3).
- **V1.3:** neither engine checks verification; the server checks reviewed documents only at confirmation.
- **Impact:** with Next's rule, **no newly registered professional can be eligible** until a verifier exists (no verifier path in the product: no grant on `verification_status`, no function, no UI).
- **Risk:** low safety risk (strict), high product risk (empty results in production).
- **Alternatives:** (a) keep strict, build platform-admin verification (V1_SCOPE NEXT); (b) accept pending for hard requirements with a warning (unsafe, contradicts C-3); (c) show "eligible pending verification" as a separate, non-eligible tier.
- **Recommendation:** (a) + (c): keep eligibility strict, add a **reported** tier "would be eligible once verified" (no score, no eligibility) so companies see real supply. Needs OD-3 (who verifies).
- **Decision:** PENDING — OD-3 (`08-product-decisions.md` D-01).

### R-02 — Rating ↔ category pairing and restrictions

- **Next:** a TYPE_RATING row is independent of the licence category; no restriction field.
- **V1.3 demo:** rating must be for the required aircraft **and** category; any non-empty restriction makes it ineligible (regression test).
- **Impact:** Next may accept a B2 technician's A320 rating for a B1 need when both are required separately (it requires both rows, so the pairing is approximated but not exact). A restricted rating would count as valid.
- **Risk:** medium (operational: certifying privileges are category-specific).
- **Recommendation:** add `restrictions text` (owner-editable, editing resets verification like dates) and treat non-empty restrictions as a hard blocker `HARD_QUALIFICATION_RESTRICTED`; optional `licence_category_type_id` on type ratings after domain review. Schema change → checkpoint.
- **Decision:** PENDING — D-02.

### R-03 — Affinity score for ineligible candidates

- **V1.3 demo:** 75/25 formula gives e.g. 80 % to an ineligible candidate (the docs then forbid applying).
- **Next:** score only for eligible candidates (C-2, BR-5.1).
- **Resolution:** keep Next. No decision needed (already decided by C-2).

### R-04 — Minimum experience is informational in Next

- **V1.3:** hard gate in both engines. **Next:** displayed only (BR-5.4).
- **Recommendation:** optional `min_years_experience` on the requirement as a hard rule with blocker `INSUFFICIENT_EXPERIENCE`; `years_experience` stays self-declared (not verifiable → document as such). **Decision:** PENDING — D-03 (part of C-10).

### R-05 — Work permit / country

- **V1.3:** hard gate on declared work countries (server limits to EU-27).
- **Next:** no country on requirements or profiles.
- **Recommendation:** `country` (ISO-2) on requirements + declared `work_countries` on the passport, hard rule; self-declared → never "verified". Depends on OD-6 (launch countries). **Decision:** PENDING — D-04.

### R-06 — Partial availability

- **V1.3:** split/partial jobs with minimum blocks; candidates can cover subsets.
- **Next:** partial is never eligible (BR-4.4, C-4); partial coverage across technicians is LATER.
- **Resolution:** keep Next for V1; partial staffing requires shifts (05 §R4) and assignments (block 3). No change now.

### R-07 — AOG derived from lead time

- **V1.3:** `classifyUrgency`: start ≤ 10 days ⇒ "AOG", 11–39 ⇒ Urgente, ≥ 40 ⇒ Planificado; it drives fees (10/4/2.3 %) and the AOG-only availability.
- **Next:** urgency is declared by the organization, informational.
- **Impact:** an aircraft-on-ground event is an operational state, not a calendar distance; a planned C-check starting in 9 days is not AOG.
- **Recommendation:** never derive AOG from lead time. Separate (a) commercial lead-time band (if OD-7 needs one) from (b) operational urgency declared by the requester with a reason, and (c) technician opt-in `aog_only` windows. **Decision:** PENDING — D-05 (C-8, OD-7).

### R-08 — Application state machine

- Demo allows re-proposal from Aceptada and no cancellation before confirmation; server allows accepted → cancelled.
- **Recommendation:** server names; transitions: received→{shortlisted,rejected,withdrawn}; shortlisted→{proposed,rejected,withdrawn}; proposed→{accepted,rejected,withdrawn}; accepted→{confirmed,proposed (re-proposal clears acceptance),rejected,withdrawn}; confirmed→{finished,cancelled}. Reasons required for rejected/cancelled. **Decision:** versioning (re-proposal = new version, explicit acceptance, never retroactive) **DECIDED 2026-10-19**; the transition set follows `APPLICATIONS_STATE_MACHINE.md` §2 — Q2–Q6 pending ratification, and `accepted → rejected` (listed here, absent from the diagram) is open as **Q7**.

### R-09 — What unlocks identity documents

- **Server:** downloads need `consentContact`; **demo:** files unlocked with identity after acceptance + contact consent.
- **Recommendation:** documents shared in a pack become readable by the requesting organization only after (pack consent) ∧ (status ∈ accepted/confirmed/finished), through short-lived signed URLs, audited per access. Contact consent unlocks contact fields only. **Decision:** PENDING — D-07.

### R-10 — Completeness percentage

- **V1.3:** 10 equal criteria incl. rate and uploaded document. **Next:** 7 explicit criteria (BR-11).
- **Resolution:** keep BR-11 (documented, derived from explicit rules). No decision needed.

### R-11 — External pool cap before eligibility (Next-only finding)

- `get_requirement_candidate_pool` returns at most 100 external rows ordered by `profile_id`, prefiltered by holding **any** required type (hard or soft, any verification state) — **before** `evaluateMatch`. With >100 such holders, eligible professionals can be silently dropped, always the same ones (uuid order).
- **Recommendation:** prefilter on holding **every hard type as active** (a necessary condition — does not duplicate the engine), then cap; report `truncated: true` to the UI. RPC change → migration + RLS test. **Decision:** technical, no product decision; scheduled in `06` (E-2).

### R-12 — Rules enforced only in Edge Functions (Next-only finding) — RESOLVED 2026-10-15

BR-2.7, type immutability, 366-day windows and technician-profile creation were enforced only by
Edge Functions while table grants allowed direct PostgREST writes with the user's JWT. Migration
`20261015120000_integrity_hardening.sql` moves them into the database (tests: RLS section I).
Still open: BR-1.4 (≥1 hard qualification) is enforced in `create_work_requirement`, but a manager
can insert/delete `work_requirement_qualifications` directly → planned in `06` (E-3).
