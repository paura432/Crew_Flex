/* eslint-disable no-console -- CLI evidence script: console output is its report */
// P04 «Oportunidades» captures for 17-parity-matrix-v18.md §P04 (F3, 2026-10-26): delta's list with one published need
// that states terms and logistics (fixture through the local API, dates derived from today, restored at the end) at
// five widths (es) and 1440 (en), its detail (es, 1440 and 390: facts, terms, eligibility, Candidate Pack preview and
// consent) and the «Mi espacio» feed row with the tile and «{tarifa} / h». Each width is checked for horizontal
// overflow; below `lg` the v1.8 dock must be fixed at the bottom with «Ofertas» current. Local stack only; nothing of
// the seed is left changed.
// Usage: BASE=http://localhost:3204 EVID=docs/audit/evidence/parity/P04 PLAYWRIGHT_CORE=<dir> CHROME=<chromium>
//        node scripts/local/p04-captures.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require(`${process.env.PLAYWRIGHT_CORE}/playwright-core`);
const BASE = process.env.BASE ?? "http://localhost:3204";
const EVID = process.env.EVID ?? "docs/audit/evidence/parity/P04";
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

// Fixture: a 2-day need ≥ 35 days ahead on days free of delta's windows (then covered by one), with the v1.8 terms
// and logistics, so the card and the detail show every line; a second need a week later on a private rest.
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
const restN = free(n + 7);
const [mroOrg] = await seedRest(ADMIN, "organizations?select=id&name=eq.Demo%20MRO%20Madrid");
const hiringTypes = await seedRest(ADMIN, "qualification_types?select=id&code=in.(B1.1,TR-A320)");
const suffix = Date.now();
const title = `Local P04 captures · revisión de línea A320 ${suffix}`;
const restTitle = `Local P04 captures · descanso ${suffix}`;
const body = (t, startsAt, endsAt, extra = {}) => ({
  organizationId: mroOrg.id,
  title: t,
  location: "Madrid (MAD)",
  startsAt,
  endsAt,
  shift: "day",
  headcount: 2,
  urgency: "planned",
  country: "ES",
  timeZone: "Europe/Madrid",
  qualifications: hiringTypes.map((q) => ({ qualificationTypeId: q.id, level: "hard" })),
  ...extra,
});
const post = (b) =>
  asSeedUser(ADMIN, "work-requirements", { method: "POST", headers: key(), body: b });
const need = await post(
  body(title, `${day(n)}T06:00:00.000Z`, `${day(n + 1)}T18:00:00.000Z`, {
    description: "Revisión programada de línea en hangar; se valora experiencia previa en A320.",
    conditions: {
      hourlyRate: 50,
      shiftHours: 8,
      perDiem: 30,
      overtimeRate: 60,
      contractType: "contractor",
      arrival: "Antes del inicio del turno",
      maxMobilizationHours: 48,
      budgetMandatory: false,
      flights: true,
      accommodation: true,
      localTransport: true,
      meals: false,
      ownTools: false,
    },
  }),
);
const rest = await post(
  body(restTitle, `${day(restN)}T06:00:00.000Z`, `${day(restN + 1)}T18:00:00.000Z`),
);
const id = need.data?.requirement?.id;
const restId = rest.data?.requirement?.id;
const window = await asSeedUser(DELTA, "professional-availability", {
  method: "POST",
  headers: key(),
  body: {
    startsAt: `${day(n)}T00:00:00.000Z`,
    endsAt: `${day(n + 2)}T00:00:00.000Z`,
    status: "available",
  },
});
ok(
  "fixture: a published need with terms (delta's window covers it) and a rest-day need, ≥ 35 days ahead",
  Boolean(id && restId && window.data?.window),
  JSON.stringify([need.error, rest.error, window.error].filter(Boolean)),
);

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
const list = `/app/professional/opportunities?q=${encodeURIComponent(title)}`;
const overflow = () =>
  page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
const shot = (name, fullPage = true) =>
  page.screenshot({ path: `${EVID}/${name}.jpg`, type: "jpeg", quality: 70, fullPage });

try {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", DELTA);
  await page.fill("#password", PW);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => u.pathname.startsWith("/app/"), { timeout: 30000 });
  await setLang("es");
  for (const width of [1440, 1024, 768, 390, 360]) {
    await open(list, width);
    ok(`opportunities es @${width}: no horizontal overflow`, !(await overflow()));
    if (width < 1024) {
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
        `dock es @${width}: fixed at the bottom with «Ofertas» current (MKT-03 #1)`,
        dock?.position === "fixed" && dock.bottom === 1100 && dock.current === "Ofertas",
        JSON.stringify(dock),
      );
    }
    await shot(`P04-opportunities-after-${width}`);
  }
  await open(list);
  const card = (await page.locator("main article").first().innerText()).replace(/\s+/g, " ");
  ok(
    "1440 es: the v1.8 card («400 € / día · 50 € / h», «2 días · 2 personas · Bloque completo», the verdict, «Ver detalle» / «Preparar candidatura»)",
    /400 € \/ día · 50 € \/ h/.test(card) &&
      /2 días · 2 personas · Bloque completo/.test(card) &&
      /Cumples requisitos y disponibilidad/.test(card) &&
      /Ver detalle Preparar candidatura/.test(card),
    card.slice(0, 200),
  );
  for (const width of [1440, 390]) {
    await open(`/app/professional/opportunities/${id}`, width);
    ok(`opportunity detail es @${width}: no horizontal overflow`, !(await overflow()));
    await shot(`P04-opportunity-after-${width}`);
  }
  const detail = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  ok(
    "detail es: terms, logistics, eligibility, preview and consent on one page (MKT-04, MKT-05)",
    /Tarifa\s*50 € \/ h · 400 € \/ día/i.test(detail) &&
      /Vuelos: incluido/.test(detail) &&
      /Cumples los requisitos obligatorios y la disponibilidad\./.test(detail) &&
      /Qué compartes con Demo MRO Madrid/.test(detail) &&
      /Autorizo compartir con Demo MRO Madrid estos datos para esta necesidad\./.test(detail),
    detail.slice(0, 160),
  );
  // «Mi espacio»: the day of the need filters the feed; the row shows the tile and the hourly rate (P01-22/23).
  await open(`/app/professional?month=${day(n).slice(0, 7)}`);
  await page.locator(`main ol[aria-label] button[aria-label^='${day(n)}:']`).click();
  const row = page.locator("main li", { hasText: title }).first();
  const rowText = (await row.innerText()).replace(/\s+/g, " ");
  ok(
    "home es: the feed row with «50 € / h» and «Ver oferta» for the selected day (P01-22/P01-23)",
    /50 € \/ h/.test(rowText) && /Ver oferta/.test(rowText),
    rowText.slice(0, 160),
  );
  await shot("P04-home-feed-after-1440");
  await setLang("en");
  await open(list);
  ok("opportunities en @1440: no horizontal overflow", !(await overflow()));
  await shot("P04-opportunities-after-1440-en");
} finally {
  await browser.close();
  // Restore: delta back to English, the window deleted, both needs closed and archived.
  await asSeedUser(DELTA, "user-preferences", { method: "PATCH", body: { locale: "en" } });
  const deleted = window.data?.window
    ? (
        await asSeedUser(DELTA, "professional-availability", {
          method: "DELETE",
          query: { id: window.data.window.id },
        })
      ).data?.deleted === true
    : false;
  const archived = [];
  for (const needId of [id, restId]) {
    if (!needId) continue;
    const closed = await asSeedUser(ADMIN, "work-requirements", {
      method: "PATCH",
      body: { id: needId, status: "closed" },
    });
    const done = closed.ok
      ? await asSeedUser(ADMIN, "work-requirements", {
          method: "PATCH",
          body: { id: needId, archive: true },
        })
      : closed;
    archived.push(done.ok === true);
  }
  ok(
    "restore: the window deleted, both needs closed and archived, delta in English",
    deleted && archived.length === 2 && archived.every(Boolean),
    JSON.stringify([deleted, archived]),
  );
}
ok("zero console/page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
console.log(`\nSUMMARY ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
