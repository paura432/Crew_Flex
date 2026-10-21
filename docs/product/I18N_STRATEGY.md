# Internationalization strategy (ES / EN)

Status: **IMPLEMENTED locally (phase 1.5, 2026-10-11)**. Decision C-5 / OD-6 (language part) is closed:
Crew Flex is bilingual, Spanish and English, with full functional coverage in both. Launch countries
(the other half of OD-6) remain open.

## 1. Library and shape

- **next-intl 4.14** on the App Router, **without i18n routing**: there is one set of routes
  (`/app/professional`, `/app/organization/...`); the locale is resolved per request on the server
  (`src/i18n/request.ts`) and never appears in the URL. No duplicated screens, no `[locale]` segment.
- Why a library: it covers Server and Client Components with one API (`getTranslations` /
  `useTranslations`), ICU plurals and rich text, strict key typing (`src/i18n/global.d.ts` binds the
  message schema to `messages/en.json`), and a per-request locale without a custom context. Building the
  same by hand would duplicate ~400 lines of plumbing we would then have to test.
- Catalogs: `messages/en.json` and `messages/es.json`, same key tree (`tests/i18n/messages.test.ts`
  fails the gate when a key, placeholder or rich tag differs). Namespaces: `common`, `meta`, `nav`,
  `landing`, `locale`, `auth`, `api`, `v` (validation), `domain` (enum labels), `professional`,
  `qualifications`, `availability`, `organization`, `capacity`, `matching`, `settings`.

## 2. What is translated and what is not

| Layer                                                                                                                                                                                                                             | Treatment                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Interface copy (titles, labels, hints, buttons, empty/loading/error states, toasts, aria-labels, metadata titles)                                                                                                                 | Catalogs.                                                                                                                                                                                                                                                                                                    |
| Domain enums stored in PostgreSQL (`shift`, `urgency`, `requirement_status`, `verification_status`, `qualification_status`, `mobility`, `technician_status`, `profile_visibility`, `qualification_category`, `organization_role`) | Stored values never change; **labels** come from `domain.*`.                                                                                                                                                                                                                                                 |
| Validation messages (Zod schemas shared with the Edge Functions)                                                                                                                                                                  | Schemas emit stable keys `v.*`; the UI resolves them (`src/i18n/validation.ts`). The API returns the keys in `issues[].message`.                                                                                                                                                                             |
| Edge Function `error.message`                                                                                                                                                                                                     | English server message kept for logs/API clients; the UI shows copy keyed by `error.code` (`api.*`), never the raw message: `actionErrorCopy` (`src/components/ui/Notice.tsx`) falls back to `common.checkFields` or `api.<CODE>.description`, and server actions return keys (`common.checkFields`, `v.*`). |
| Matching explanations                                                                                                                                                                                                             | `src/features/matching/explain.ts` returns `{ key, params }`; the card renders them in the active locale. Blockers and checks are identical in both languages — only the words change.                                                                                                                       |
| Codes, acronyms, names, user data (B1.1, TR-A320, EWIS, HF, FTS, SMS, AOG, MRO, EASA, Part-66, display names, locations, organization names, titles)                                                                              | **Never translated** (glossary: `AVIATION_GLOSSARY_ES_EN.md`).                                                                                                                                                                                                                                               |
| Dates and times                                                                                                                                                                                                                   | `src/i18n/format.ts`: day · month · year in both languages (`en-GB` / `es-ES` patterns), always **UTC** (BR-10). Timestamps are never altered.                                                                                                                                                               |

## 3. Locale precedence (`src/i18n/resolve.ts`, tested)

1. **Persisted preference** of the authenticated user (`profiles.preferred_locale`, es/en, nullable).
2. **Cookie** `crewflex-locale` (1 year, SameSite=Lax, not HttpOnly): written by every switch, so the
   choice also works before sign-in and on the public pages.
3. **Browser** `Accept-Language` (quality-ordered; `es-ES` → `es`, `en-GB` → `en`).
4. **Fallback `en`** — explicit; aviation maintenance is English-first and the existing docs/brief use English.

Manual selection always wins over detection: it writes the cookie and, when signed in, the profile.

## 4. Persistence and security

- Migration `20261011120000_preferred_locale.sql`: nullable `profiles.preferred_locale` with a CHECK
  (`es`|`en`) and a column grant; the existing `profiles_update_own` policy applies (RLS tests G).
- Edge Function **`user-preferences`** (GET, PATCH `{ locale }`), one function for professionals and
  organization users; owner = JWT subject; strict schema (`v.locale.invalid`, unknown fields → 400).
- Server action `setLocaleAction`: validates, sets the cookie, calls the function when a session
  exists, revalidates the layout. The client calls `router.refresh()`: the route, the session and page
  state are kept; only the rendered tree re-renders. No full reload, no sign-out.

## 5. Settings

`/app/settings` for every signed-in account, in the "Account" nav section: Language / Idioma (two
cards, `radiogroup`, `lang` attribute per option) and the account facts. Public pages (landing, login,
register) carry a compact ES | EN switcher.

## 6. Accessibility and rendering

`<html lang>` is set from the resolved locale on the server, so the first render is already correct and
there is no hydration mismatch (the provider in `src/app/layout.tsx` passes the same locale and messages
to Client Components). The switcher keeps focus on the pressed option; status messages use
`role="status"`, errors `role="alert"`. Spanish copy is longer: the smoke checks 1440/768/390 px for
horizontal overflow in both languages.

## 7. Adding a language

Add the code to `LOCALES` (and the DB CHECK with a non-destructive migration), a catalog file, the
`INTL_LOCALE` entry in `src/i18n/format.ts`, and the `locale.<code>` label in every catalog. The parity
test enforces completeness.
