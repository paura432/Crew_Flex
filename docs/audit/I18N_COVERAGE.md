# I18N coverage — ES / EN (phase 1.5, 2026-10-11)

How coverage is proven: (1) `tests/i18n/messages.test.ts` — identical key trees, placeholders and rich
tags in both catalogs, every `v.*` key emitted by the schemas/functions exists, every domain enum and API
code has a label; (2) `src/i18n/global.d.ts` — unknown keys fail `tsc`; (3) browser smoke in Spanish with a
sentinel list of English-only UI words (`scripts/local/ui-smoke.mjs`, `expectSpanish`) on the overview,
qualifications, availability, organization dashboard, matching and requirement form; (4) a grep for
capitalised English sentences inside JSX (`FULL_FUNCTIONAL_REVIEW.md` §4) — none left.

## Screens

| Area         | Screen / component                                                                                                                | ES  | EN  | Evidence                                                      |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------- | --- | --- | ------------------------------------------------------------- |
| Public       | Landing `/`                                                                                                                       | ✓   | ✓   | curl `Accept-Language`/cookie checks; `landing.*`             |
| Public       | `/login`, `/register` (+ compact switcher)                                                                                        | ✓   | ✓   | smoke 16a (`local-21-login-es.jpg`); `auth.*`                 |
| Public       | 404 (`not-found.tsx`), app error boundary, loading                                                                                | ✓   | ✓   | `common.*`                                                    |
| Shell        | Sidebar (sections, links, Settings), sign-out, skip link, brand tag                                                               | ✓   | ✓   | `nav.*`, `common.*`                                           |
| Professional | Overview (passport %, next step, metrics, facts)                                                                                  | ✓   | ✓   | smoke 5i (`local-15-overview-es-*.jpg`)                       |
| Professional | Passport form (3 sections, visibility cards, notices, validation)                                                                 | ✓   | ✓   | smoke 5b/5c, `local-10/11`                                    |
| Professional | Qualifications (declare, edit, chips, hints, group titles)                                                                        | ✓   | ✓   | smoke 5j (`local-16-qualifications-es-*.jpg`)                 |
| Professional | Availability (metrics, picker, calendar, weekdays, month name, form, list)                                                        | ✓   | ✓   | smoke 5k (`local-17-availability-es.jpg`)                     |
| Organization | Dashboard (capacity panel, metrics, list, empty states)                                                                           | ✓   | ✓   | smoke 11c (`local-18-organization-es-*.jpg`)                  |
| Organization | Requirements list (table + mobile list, chips)                                                                                    | ✓   | ✓   | smoke 9 / ES dashboard list                                   |
| Organization | Requirement form (sections, fields, placeholders, level select, errors)                                                           | ✓   | ✓   | smoke 11f/11g (`local-20-requirement-form-es-validation.jpg`) |
| Organization | Requirement detail (facts, capacity, internal cards)                                                                              | ✓   | ✓   | smoke 10 + ES matches share `MatchCard`                       |
| Organization | Matching (summary, cards, checks, blockers, availability)                                                                         | ✓   | ✓   | smoke 11d/11e (`local-19-matches-es-*.jpg`)                   |
| Organization | Workforce (roles, chips, dates, empty states)                                                                                     | ✓   | ✓   | `organization.workforce.*`, `domain.role.*`                   |
| Settings     | `/app/settings` (language cards, account facts)                                                                                   | ✓   | ✓   | smoke 5h, `local-14-settings-en-*.jpg`                        |
| Shared       | API error states (9 codes), action notices, references                                                                            | ✓   | ✓   | `api.*`                                                       |
| Shared       | Validation messages (54 keys)                                                                                                     | ✓   | ✓   | `tests/i18n` "every validation key"                           |
| Shared       | Domain labels (shift, urgency, status, verification, held, visibility, mobility, technician status, category, role, account type) | ✓   | ✓   | `tests/i18n` "every domain enum value"                        |
| Metadata     | `<title>` per page, site description, `<html lang>`                                                                               | ✓   | ✓   | `meta.*`; smoke `lang` checks                                 |

## Formats

| Item        | EN (`en-GB` pattern)   | ES (`es-ES` pattern)  | Note                                                      |
| ----------- | ---------------------- | --------------------- | --------------------------------------------------------- |
| Date        | 15 Jan 2032            | 15 ene 2032           | day · month · year in both (aviation convention)          |
| Date + time | 10 May 2031, 08:00 UTC | 10 may 2031, 8:00 UTC | always UTC (BR-10); `hourCycle: h23`                      |
| Period      | 18 OCT → 22 OCT        | 18 OCT → 22 OCT       | uppercase short month                                     |
| Month title | October 2026           | octubre de 2026       | calendar header                                           |
| Plurals     | 1 year / 12 years      | 1 año / 12 años       | ICU plural (`professional.facts.years`, `matching.years`) |
| Numbers / % | 48.78%                 | 48.78%                | percent values come from the domain unchanged             |
| Currency    | —                      | —                     | not modelled (OD C-9)                                     |

## Not translated on purpose

Licence codes and catalog names (`B1.1`, `Part-66 B1.1 — Aeroplanes, turbine`), type ratings, training
acronyms, AOG/MRO, organization and display names, locations, requirement titles, requirement ids and
pseudonymous references. The catalog `qualification_types.name` is English-only reference data
(`docs/product/AVIATION_GLOSSARY_ES_EN.md`); translating it would need a `name_es` column (not requested).

## Pending / known limits

- Supabase Auth provider messages are mapped to codes (`auth.errors.*`); unknown codes show the generic
  message in the active language. Confirmation e-mails sent by Supabase are not localized (template config).
- Zod built-in messages (e.g. wrong JSON types from a tampered client) fall back to English; every rule the
  forms can trigger has a `v.*` key.
- `qualification_types.name` stays English (see above).
