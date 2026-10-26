/* eslint-disable no-console -- CLI evidence script: console output is its report */
// P03 «Disponibilidad» captures for 17-parity-matrix-v18.md §P03 (F3, 2026-10-26): delta's calendar of a month with a
// confirmed assignment (fixture through the local API, restored at the end) at five widths (es) and 1440 (en), plus
// the cycle preview that skips the assigned days. Each width is checked for horizontal overflow; below `lg` the v1.8
// dock must be fixed at the bottom with «Calendario» current. Local stack only; nothing of the seed is left changed.
// Usage: BASE=http://localhost:3203 EVID=docs/audit/evidence/parity/P03 PLAYWRIGHT_CORE=<dir> CHROME=<chromium>
//        node scripts/local/p03-captures.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require(`${process.env.PLAYWRIGHT_CORE}/playwright-core`);
const BASE = process.env.BASE ?? "http://localhost:3203";
const EVID = process.env.EVID ?? "docs/audit/evidence/parity/P03";
const PW = "crewflex-local-only";
const MONTH = "2027-01";
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

// Fixture: a need on 18–19 January 2027 that delta applies to and the MRO confirms; an available window over
// 18–20, a blocked block on 4–7 and an «AOG only» day on the 12th, so every day state is on the capture.
const [mroOrg] = await seedRest(ADMIN, "organizations?select=id&name=eq.Demo%20MRO%20Madrid");
const hiringTypes = await seedRest(ADMIN, "qualification_types?select=id&code=in.(B1.1,TR-A320)");
const title = `Local P03 captures · ${Date.now()}`;
const need = await asSeedUser(ADMIN, "work-requirements", {
  method: "POST",
  headers: key(),
  body: {
    organizationId: mroOrg.id,
    title,
    location: "Madrid (MAD)",
    startsAt: `${MONTH}-18T06:00:00.000Z`,
    endsAt: `${MONTH}-19T18:00:00.000Z`,
    shift: "day",
    headcount: 2,
    urgency: "planned",
    qualifications: hiringTypes.map((q) => ({ qualificationTypeId: q.id, level: "hard" })),
  },
});
const windows = [];
for (const [startsAt, endsAt, status] of [
  [`${MONTH}-18T00:00:00.000Z`, `${MONTH}-21T00:00:00.000Z`, "available"],
  [`${MONTH}-04T00:00:00.000Z`, `${MONTH}-08T00:00:00.000Z`, "unavailable"],
  [`${MONTH}-12T00:00:00.000Z`, `${MONTH}-13T00:00:00.000Z`, "aog_only"],
]) {
  const w = await asSeedUser(DELTA, "professional-availability", {
    method: "POST",
    headers: key(),
    body: { startsAt, endsAt, status },
  });
  if (w.data?.window) windows.push(w.data.window.id);
}
const applied = await asSeedUser(DELTA, "applications", {
  method: "POST",
  headers: key(),
  body: { requirementId: need.data?.requirement.id, shareConsent: true },
});
const app = { id: applied.data?.application.id, updatedAt: applied.data?.application.updatedAt };
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
await move(DELTA, "accepted", {
  proposalId: proposed.data?.transition.proposalId,
  acceptTerms: true,
});
const confirmed = await move(ADMIN, "confirmed");
ok(
  "fixture: three windows and a confirmed assignment on 18–19 January 2027",
  windows.length === 3 && confirmed.data?.transition.status === "confirmed",
  JSON.stringify(confirmed.error ?? need.error ?? ""),
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
async function open(width) {
  await page.setViewportSize({ width, height: width < 800 ? 1100 : 900 });
  await page.goto(`${BASE}/app/professional/availability?month=${MONTH}`);
  await page.waitForLoadState("networkidle");
}
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
    await open(width);
    ok(`availability es @${width}: no horizontal overflow`, !(await overflow()));
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
        `dock es @${width}: fixed at the bottom with «Calendario» current (SHOT-02 #6)`,
        dock?.position === "fixed" && dock.bottom === 1100 && dock.current === "Calendario",
        JSON.stringify(dock),
      );
    }
    await shot(`P03-availability-after-${width}`);
  }
  await open(1440);
  const main = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  const cell = page.locator(`main button[aria-label^='${MONTH}-18:']`);
  const label = (await cell.getAttribute("aria-label")) ?? "";
  ok(
    "1440 es: v1.8 literals («Tu calendario», «Tu tiempo, a tu manera.», «Planifica tu ciclo», «Previsualizar ciclo en el mes»), the assigned day disabled with «Una asignación confirmada está protegida.»",
    /Tu calendario/i.test(main) &&
      /Tu tiempo, a tu manera\./.test(main) &&
      /Planifica tu ciclo/.test(main) &&
      /Previsualizar ciclo en el mes/.test(main) &&
      (await cell.isDisabled()) &&
      label ===
        `${MONTH}-18: Disponible, asignación confirmada. Una asignación confirmada está protegida.`,
    label,
  );
  // The cycle preview with «Reemplazar…» drafts the month but never the assigned days (BR-4.9).
  await page
    .getByRole("checkbox", { name: "Reemplazar también los días que ya he guardado en este mes" })
    .check();
  await page.getByRole("button", { name: "Previsualizar ciclo en el mes" }).click();
  await page.waitForSelector("main [role=status]", { timeout: 15000 });
  const drafted = await page.locator("main button[aria-label*='sin guardar']").count();
  const assignedDrafted = await page
    .locator(`main button[aria-label^='${MONTH}-1'][aria-label*='sin guardar']`)
    .evaluateAll((els) =>
      els.map((e) => e.getAttribute("aria-label")).filter((l) => /^\d{4}-\d{2}-(18|19):/.test(l)),
    );
  ok(
    "preview es: the month is drafted (dashed days, «sin guardar») except the two assigned days",
    drafted > 0 && assignedDrafted.length === 0,
    `${drafted} drafted`,
  );
  await shot("P03-availability-preview-after-1440");
  await page.getByRole("button", { name: "Descartar cambios" }).click();
  await setLang("en");
  await open(1440);
  ok("availability en @1440: no horizontal overflow", !(await overflow()));
  await shot("P03-availability-after-1440-en");
  await setLang("es");
} finally {
  await browser.close();
  // Restore: the assignment is cancelled, then its windows can go and the need is closed.
  const cancelled = await move(DELTA, "cancelled", { reason: "Local P03 captures: restore" });
  const deleted = [];
  for (const id of windows)
    deleted.push(
      (await asSeedUser(DELTA, "professional-availability", { method: "DELETE", query: { id } }))
        .data?.deleted === true,
    );
  const closed = await asSeedUser(ADMIN, "work-requirements", {
    method: "PATCH",
    body: { id: need.data?.requirement.id, status: "closed" },
  });
  ok(
    "restore: assignment cancelled, the three windows deleted, the need closed",
    cancelled.data?.transition.status === "cancelled" &&
      deleted.length === 3 &&
      deleted.every(Boolean) &&
      closed.data?.requirement?.status === "closed",
    JSON.stringify([cancelled.error, deleted, closed.error ?? closed.data?.requirement?.status]),
  );
}
ok("zero console/page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
console.log(`\nSUMMARY ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
