/* eslint-disable no-console -- CLI evidence script: console output is its report */
// P05 «Candidaturas» captures for 17-parity-matrix-v18.md §P05 (F3, 2026-10-26): delta's «Mis candidaturas» with one
// proposed application to a need that states two shifts and terms (fixture through the local API, dates derived from
// today, restored at the end) at 1440 and 390 (es) and 1440 (en), the same card with «Ver expediente» open, and the
// organization's «Candidaturas» filtered by that need at 1440 and 390 (es) plus the need's own page (es). Each width is
// checked for horizontal overflow; below `lg` the v1.8 dock must be fixed at the bottom with «Candidaturas» current.
// Local stack only; nothing of the seed is left changed.
// Usage: BASE=http://localhost:3205 EVID=docs/audit/evidence/parity/P05 PLAYWRIGHT_CORE=<dir> CHROME=<chromium>
//        node scripts/local/p05-captures.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require(`${process.env.PLAYWRIGHT_CORE}/playwright-core`);
const BASE = process.env.BASE ?? "http://localhost:3205";
const EVID = process.env.EVID ?? "docs/audit/evidence/parity/P05";
const PW = "crewflex-local-only";
let pass = 0,
  fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` · ${detail}` : ""}`);
};

// Local API as a seed account (the same helpers as ui-smoke.mjs): fixture and restore only.
const envLocal = readFileSync(".env.local", "utf8");
const supabaseUrl = /NEXT_PUBLIC_SUPABASE_URL=(\S+)/.exec(envLocal)?.[1];
const publishableKey = /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=(\S+)/.exec(envLocal)?.[1];
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(supabaseUrl ?? "")) {
  console.error("refusing: .env.local does not point at a local Supabase stack");
  process.exit(2);
}
const seedHeaders = async (email) => {
  const auth = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: publishableKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PW }),
  }).then((r) => r.json());
  return {
    Authorization: `Bearer ${auth.access_token}`,
    apikey: publishableKey,
    "Content-Type": "application/json",
  };
};
async function asSeedUser(email, fn, { method = "GET", query = {}, body, headers = {} } = {}) {
  const url = new URL(`/functions/v1/${fn}`, supabaseUrl);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return fetch(url, {
    method,
    headers: { ...(await seedHeaders(email)), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then((r) => r.json());
}
const seedRest = async (email, path) =>
  fetch(new URL(`/rest/v1/${path}`, supabaseUrl), { headers: await seedHeaders(email) }).then((r) =>
    r.json(),
  );
const key = () => ({ "Idempotency-Key": crypto.randomUUID() });
const DELTA = "delta@crewflex.test";
const ADMIN = "admin.mro@crewflex.test";
const day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

// Fixture: a 1-seat need ≥ 35 days ahead on days free of delta's windows, with two 8 h shifts and the v1.8 terms, so
// the proposal shows every line («16 h × 50 €/h = 800 €», «2 jornadas»); delta applies and is proposed version 1.
const windows = (await asSeedUser(DELTA, "professional-availability")).data?.windows ?? [];
const free = (from) => {
  for (let n = from; n < from + 180; n++) {
    const s = Date.parse(`${day(n)}T00:00:00.000Z`);
    const e = s + 3 * 86_400_000;
    if (!windows.some((w) => Date.parse(w.startsAt) < e && Date.parse(w.endsAt) > s)) return n;
  }
  return from;
};
const n = free(35);
const start = day(n);
const end = day(n + 1);
const [mroOrg] = await seedRest(ADMIN, "organizations?select=id&name=eq.Demo%20MRO%20Madrid");
const hiringTypes = await seedRest(ADMIN, "qualification_types?select=id&code=in.(B1.1,TR-A320)");
const title = `Local P05 captures · revisión de línea A320 ${Date.now()}`;
// Filled inside the `try` so a failed fixture is still restored by the `finally`.
let id, window, app;

const browser = await chromium.launch({ executablePath: process.env.CHROME });
const ctx = await browser.newContext({ locale: "es-ES", viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

async function setLang(lang) {
  await page.goto(`${BASE}/app/settings`);
  await page.waitForLoadState("networkidle");
  if ((await page.evaluate(() => document.documentElement.lang)) === lang) return;
  await page.locator(`[role=radio][lang=${lang}]`).first().click();
  await page.waitForSelector("[role=status]", { timeout: 15000 });
}
async function open(path, width = 1440) {
  await page.setViewportSize({ width, height: width < 800 ? 1100 : 900 });
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState("networkidle");
}
async function login(email) {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", PW);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => u.pathname.startsWith("/app/"), { timeout: 30000 });
}
async function logout() {
  await page
    .locator("form:has(button:has-text('Sign out')), form:has(button:has-text('Cerrar sesión'))")
    .last()
    .evaluate((f) => f.requestSubmit());
  await page.waitForURL((u) => !u.pathname.startsWith("/app"), { timeout: 20000 });
}
const overflow = () =>
  page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
const dockCheck = async (width) => {
  const dock = await page.evaluate(() => {
    const nav = document.querySelector("nav[aria-label='Accesos rápidos']");
    if (!nav) return null;
    const current = nav.querySelector("a[aria-current=page]");
    return {
      position: getComputedStyle(nav).position,
      bottom: Math.round(nav.getBoundingClientRect().bottom),
      current: current?.textContent?.trim() ?? "",
    };
  });
  ok(
    `dock es @${width}: fixed at the bottom with «Candidaturas» current`,
    dock?.position === "fixed" && dock.bottom === 1100 && dock.current === "Candidaturas",
    JSON.stringify(dock),
  );
};
const shot = (name, fullPage = true) =>
  page.screenshot({ path: `${EVID}/${name}.jpg`, type: "jpeg", quality: 70, fullPage });

try {
  const need = await asSeedUser(ADMIN, "work-requirements", {
    method: "POST",
    headers: key(),
    body: {
      organizationId: mroOrg.id,
      title,
      location: "Madrid (MAD)",
      startsAt: `${start}T06:00:00.000Z`,
      endsAt: `${end}T18:00:00.000Z`,
      shift: "day",
      headcount: 1,
      urgency: "planned",
      country: "ES",
      timeZone: "Europe/Madrid",
      qualifications: hiringTypes.map((q) => ({ qualificationTypeId: q.id, level: "hard" })),
      description: "Revisión programada de línea en hangar; se valora experiencia previa en A320.",
      shifts: [
        { startsAt: `${start}T06:00:00.000Z`, endsAt: `${start}T14:00:00.000Z`, baseHours: 8 },
        { startsAt: `${end}T10:00:00.000Z`, endsAt: `${end}T18:00:00.000Z`, baseHours: 8 },
      ],
      conditions: {
        hourlyRate: 50,
        shiftHours: 8,
        perDiem: 30,
        overtimeRate: 60,
        contractType: "contractor",
        flights: true,
        accommodation: true,
        localTransport: true,
        meals: false,
      },
    },
  });
  id = need.data?.requirement?.id;
  window = await asSeedUser(DELTA, "professional-availability", {
    method: "POST",
    headers: key(),
    body: {
      startsAt: `${start}T00:00:00.000Z`,
      endsAt: `${day(n + 2)}T00:00:00.000Z`,
      status: "available",
    },
  });
  const applied = await asSeedUser(DELTA, "applications", {
    method: "POST",
    headers: key(),
    body: { requirementId: id, shareConsent: true },
  });
  app = { id: applied.data?.application?.id, updatedAt: applied.data?.application?.updatedAt };
  const move = async (email, to, extra = {}) => {
    const res = await asSeedUser(email, "applications", {
      method: "PATCH",
      headers: key(),
      body: { applicationId: app.id, to, expectedUpdatedAt: app.updatedAt, ...extra },
    });
    if (res.data) app.updatedAt = res.data.transition.updatedAt;
    return res;
  };
  await move(ADMIN, "shortlisted");
  const proposed = await move(ADMIN, "proposed");
  ok(
    "fixture: a 1-seat need with two shifts and terms (delta's window covers it); delta's application proposed v1",
    Boolean(id && window.data?.window && app.id) &&
      proposed.data?.transition?.status === "proposed",
    JSON.stringify([need.error, window.error, applied.error, proposed.error].filter(Boolean)),
  );

  await login(DELTA);
  await setLang("es");
  const mine = "/app/professional/applications";
  for (const width of [1440, 390]) {
    await open(mine, width);
    ok(`applications es @${width}: no horizontal overflow`, !(await overflow()));
    if (width < 1024) await dockCheck(width);
    await shot(`P05-applications-after-${width}`);
  }
  await open(`${mine}?pack=${app.id}`);
  ok(
    "1440 es: the dated copy is open under the card («Copia del perfil:»)",
    /Copia del perfil:/.test(await page.locator(`#pack-${app.id}`).innerText()),
  );
  await shot("P05-applications-pack-after-1440");
  await setLang("en");
  await open(mine);
  ok("applications en @1440: no horizontal overflow", !(await overflow()));
  await shot("P05-applications-after-1440-en");
  await logout();

  await login(ADMIN);
  await setLang("es");
  const org = `/app/organization/applications?requirementId=${id}`;
  for (const width of [1440, 390]) {
    await open(org, width);
    ok(`organization applications es @${width}: no horizontal overflow`, !(await overflow()));
    if (width < 1024) await dockCheck(width);
    await shot(`P05-org-applications-after-${width}`);
  }
  await open(`/app/organization/requirements/${id}/applications`);
  ok("need's applications es @1440: no horizontal overflow", !(await overflow()));
  await shot("P05-org-need-applications-after-1440");
  await setLang("en");
  await logout();
} finally {
  // Seed state back whatever happened: both accounts in English, the application withdrawn, the window deleted,
  // the need closed and archived.
  const locales = [];
  for (const email of [DELTA, ADMIN])
    locales.push(
      (await asSeedUser(email, "user-preferences", { method: "PATCH", body: { locale: "en" } }))
        .data?.preferences?.locale === "en",
    );
  const mine = (await asSeedUser(DELTA, "applications")).data?.applications ?? [];
  const current = mine.find((a) => a.requirementId === id);
  const withdrawn = current
    ? (
        await asSeedUser(DELTA, "applications", {
          method: "PATCH",
          headers: key(),
          body: {
            applicationId: current.id,
            to: "withdrawn",
            expectedUpdatedAt: current.updatedAt,
          },
        })
      ).data?.transition?.status === "withdrawn"
    : false;
  const deleted = window?.data?.window
    ? (
        await asSeedUser(DELTA, "professional-availability", {
          method: "DELETE",
          query: { id: window.data.window.id },
        })
      ).data?.deleted === true
    : false;
  const closed = id
    ? (
        await asSeedUser(ADMIN, "work-requirements", {
          method: "PATCH",
          body: { id, status: "closed" },
        })
      ).ok === true
    : false;
  const archived = closed
    ? (
        await asSeedUser(ADMIN, "work-requirements", {
          method: "PATCH",
          body: { id, archive: true },
        })
      ).ok === true
    : false;
  ok(
    "restore: both accounts in English, the application withdrawn, the window deleted, the need closed and archived",
    locales.every(Boolean) && withdrawn && deleted && closed && archived,
    JSON.stringify({ locales, withdrawn, deleted, closed, archived }),
  );
  await browser.close();
}
console.log(
  `\nSUMMARY ${pass}/${pass + fail} passed${errors.length ? ` · page errors: ${errors.length}` : ""}`,
);
process.exit(fail ? 1 : 0);
