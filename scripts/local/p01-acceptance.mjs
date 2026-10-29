/* eslint-disable no-console -- CLI acceptance script: console output is its report */
// P01 «Mi espacio» acceptance (F2.2, 2026-10-26): v1.8 rows of 17-parity-matrix-v18.md §P01 in the browser.
// Modes: main (delta, ES + EN, 5 widths, dialog, day filter) · empty (a fresh professional) · error (run it with
// `functions serve` stopped). Local stack only. Usage: BASE=http://localhost:3002 EVID=docs/audit/evidence/parity/P01
// PLAYWRIGHT_CORE=<dir> CHROME=<chromium> node scripts/local/p01-acceptance.mjs [main|empty|error]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(`${process.env.PLAYWRIGHT_CORE}/playwright-core`);
const BASE = process.env.BASE ?? "http://localhost:3002";
const EVID = process.env.EVID;
const MAILPIT = "http://127.0.0.1:56324";
const PW = "crewflex-local-only";
const MODE = process.argv[2] ?? "main";
let pass = 0,
  fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` · ${detail}` : ""}`);
};

const browser = await chromium.launch({ executablePath: process.env.CHROME });
const ctx = await browser.newContext({ locale: "es-ES", viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (
    m.type() === "error" &&
    !(MODE === "error" && /status of 5\d\d|Failed to fetch/.test(m.text()))
  )
    errors.push(m.text());
});

async function login(email, password = PW) {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => u.pathname.startsWith("/app/"), { timeout: 30000 });
  await page.waitForLoadState("networkidle");
}
async function setLang(lang) {
  await page.goto(`${BASE}/app/settings`);
  await page.waitForLoadState("networkidle");
  if ((await page.evaluate(() => document.documentElement.lang)) === lang) return;
  await page.locator(`[role=radio][lang=${lang}]`).first().click();
  await page.waitForSelector("[role=status]", { timeout: 15000 });
}
async function home(width = 1440) {
  await page.setViewportSize({ width, height: width < 800 ? 1100 : 900 });
  await page.goto(`${BASE}/app/professional`);
  await page.waitForLoadState("networkidle");
  return page.locator("main").innerText();
}
const overflow = () =>
  page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
const shot = (name) =>
  EVID &&
  page.screenshot({ path: `${EVID}/${name}.jpg`, type: "jpeg", quality: 70, fullPage: true });
const top = (loc) => loc.first().evaluate((e) => e.getBoundingClientRect().top + window.scrollY);
const left = (loc) => loc.first().evaluate((e) => e.getBoundingClientRect().left);

if (MODE === "main") {
  await login("delta@crewflex.test");
  await setLang("es");
  const es = await home(1440);
  const has = (s) => es.includes(s);
  ok("P01-01 kicker «Mi espacio»", /mi espacio/i.test(es));
  ok(
    "P01-02 h1 «Tu perfil. Tu tiempo.» + «Tu próxima oportunidad.»",
    has("Tu perfil. Tu tiempo.") && has("Tu próxima oportunidad."),
  );
  ok(
    "P01-03 «Herramientas» with an icon",
    (await page.locator("main a", { hasText: "Herramientas" }).first().locator("svg").count()) > 0,
  );
  ok(
    "P01-07 «Editar perfil» with an icon",
    (await page.locator("main a", { hasText: "Editar perfil" }).first().locator("svg").count()) > 0,
  );
  ok(
    "P01-11 counters «oportunidades compatibles» / «asignaciones confirmadas»",
    has("oportunidades compatibles") && has("asignaciones confirmadas"),
  );
  ok("P01-13 calendar kicker «Tu disponibilidad»", /tu disponibilidad/i.test(es));
  const monthH2 = await page
    .locator("main h2")
    .filter({ hasText: /\b20\d\d\b/ })
    .count();
  ok("P01-13 the month is an h2 of the calendar card", monthH2 >= 1, `${monthH2} h2 with a year`);
  const legend = (
    await page.locator("main ul:has(> li > span.size-3)").first().innerText()
  ).replace(/\s+/g, " ");
  const order = [
    "Bloqueado",
    "Descanso",
    "Disponible",
    "Solo AOG",
    "Parcial",
    "Asignado",
    "Oportunidades",
  ].map((w) => legend.indexOf(w));
  ok(
    "P01-18 legend in the v1.8 order (Bloqueado · Descanso · Disponible · Solo AOG · Parcial · Asignado · ● Oportunidades)",
    order.every((x, i) => x >= 0 && (i === 0 || x > order[i - 1])),
    legend.slice(0, 120),
  );
  ok("P01-15 week header L M X J V S D", /L\s+M\s+X\s+J\s+V\s+S\s+D/.test(es.replace(/\n/g, " ")));
  ok("P01-20 «Actualizar disponibilidad»", has("Actualizar disponibilidad"));
  ok(
    "P01-21 «Encuentra tu siguiente paso» + «Oportunidades para ti» + «Ver todas»",
    /encuentra tu siguiente paso/i.test(es) && has("Oportunidades para ti") && has("Ver todas"),
  );
  ok(
    "P01-25 «Tu actividad» + «Mis candidaturas»",
    /tu actividad/i.test(es) && has("Mis candidaturas"),
  );
  // P01-28 order: hero → [card | calendar] → opportunities → applications
  const yHero = await top(page.locator("main h1"));
  const yCal = await top(page.getByText(/tu disponibilidad/i));
  const yOpp = await top(page.getByRole("heading", { name: "Oportunidades para ti" }));
  const yApp = await top(page.getByRole("heading", { name: "Mis candidaturas" }));
  ok(
    "P01-28 order hero → calendar → «Oportunidades para ti» → «Mis candidaturas»",
    yHero < yCal && yCal < yOpp && yOpp < yApp,
    `${yHero}/${yCal}/${yOpp}/${yApp}`,
  );
  // P01-12 grid: passport progress block («Tu pasaporte está al» or counters) beside the calendar at 1440, stacked at 1024
  const cardX = await left(page.getByText("oportunidades compatibles")),
    calX = await left(page.getByText(/tu disponibilidad/i));
  ok(
    "P01-12 card | calendar in two columns at 1440 (calendar to the right)",
    calX > cardX + 200,
    `card x ${cardX} cal x ${calX}`,
  );
  await shot("P01-home-after-1440-es");
  for (const w of [1024, 768, 390, 360]) {
    await home(w);
    ok(`P01-29 no horizontal overflow @${w}`, !(await overflow()));
    if (w === 1024) {
      const cx = await left(page.getByText("oportunidades compatibles")),
        kx = await left(page.getByText(/tu disponibilidad/i));
      const c = await top(page.getByText("oportunidades compatibles")),
        k = await top(page.getByText(/tu disponibilidad/i));
      ok(
        "P01-12 one column below xl (1024): calendar below the card, same left edge band",
        k > c && Math.abs(kx - cx) < 120,
        `card ${cx},${c} cal ${kx},${k}`,
      );
    }
    if (w === 390) {
      const name = page
        .locator("main h2, main p")
        .filter({ hasText: /^Delta/ })
        .first();
      const avatar = page.locator("main [aria-hidden=true], main img").first();
      ok(
        "P01-29 identity stacked at 390 (avatar above the name)",
        (await name.count()) === 0 || (await top(avatar)) < (await top(name)),
      );
    }
    await shot(`P01-home-after-${w}-es`);
  }
  await home(1440);
  ok("P01-29 no horizontal overflow @1440", !(await overflow()));
  // P01-09/30 dialog: open, Escape, focus back
  const status = page.getByRole("button", { name: /Estado de mi perfil/ });
  await status.click();
  const dlg = page.locator("dialog[open]");
  ok(
    "P01-09 «Estado de mi perfil» opens a dialog with the percentage",
    (await dlg.count()) === 1 && /%/.test(await dlg.innerText()),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  ok(
    "P01-30 Escape closes it and focus returns to the button",
    (await dlg.count()) === 0 && (await status.evaluate((e) => e === document.activeElement)),
  );
  // P01-16/17 day filter
  const days = page.locator("button[aria-pressed]");
  const nDays = await days.count();
  let filtered = false;
  for (let i = 0; i < nDays && !filtered; i++) {
    const d = days.nth(i);
    if (await d.isDisabled()) continue;
    await d.click();
    await page.waitForTimeout(250);
    const text = await page.locator("main").innerText();
    if (/Oportunidades · /.test(text) && text.includes("Quitar selección de fecha"))
      filtered = (await d.getAttribute("aria-pressed")) === "true";
  }
  ok(
    "P01-16/17 a day button (aria-pressed) filters the feed: «Oportunidades · {día}» + «Quitar selección de fecha»",
    filtered,
    `${nDays} day buttons`,
  );
  // EN
  await setLang("en");
  const en = await home(1440);
  ok(
    "ES/EN: English home renders the same sections",
    /opportunities for you/i.test(en) &&
      /my applications/i.test(en) &&
      !en.includes("Oportunidades para ti"),
  );
  await shot("P01-home-after-1440-en");
  await home(390);
  ok("P01-29 EN no horizontal overflow @390", !(await overflow()));
  await shot("P01-home-after-390-en");
  await setLang("es");
}

if (MODE === "empty") {
  const email = `p01-empty-${Date.now()}@crewflex.test`;
  await page.goto(`${BASE}/register`);
  await page.waitForLoadState("networkidle");
  await page.check("input[name=accountType][value=professional]");
  await page.fill("#displayName", "P01 Vacío");
  await page.fill("#email", email);
  await page.fill("#password", "p01-empty-state-pass");
  await page.locator("button[type=submit]").click();
  let link = null;
  for (let i = 0; i < 40 && !link; i++) {
    await page.waitForTimeout(500);
    const found = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
    ).then((r) => r.json());
    const id = found.messages?.[0]?.ID;
    if (id)
      link = /href="([^"]+)"/
        .exec(
          (await fetch(`${MAILPIT}/api/v1/message/${id}`).then((r) => r.json())).HTML ?? "",
        )?.[1]
        ?.replaceAll("&amp;", "&");
  }
  if (link) {
    await page.goto(link);
    await page.waitForLoadState("networkidle");
  }
  await login(email, "p01-empty-state-pass");
  const t = await home(1440);
  ok(
    "P01-24 empty: «Todavía no hay oportunidades compatibles» + «Abrir mi calendario»",
    t.includes("Todavía no hay oportunidades compatibles") && t.includes("Abrir mi calendario"),
  );
  ok(
    "P01-27 empty: «Tu próxima candidatura empieza aquí» + «Buscar oportunidades»",
    t.includes("Tu próxima candidatura empieza aquí") && t.includes("Buscar oportunidades"),
  );
  await shot("P01-home-empty-1440-es");
  await home(390);
  ok("empty @390 no horizontal overflow", !(await overflow()));
  await shot("P01-home-empty-390-es");
  console.log(`EMPTY_ACCOUNT=${email}`);
}

if (MODE === "error") {
  await login("delta@crewflex.test");
  const resp = await page.goto(`${BASE}/app/professional`);
  await page.waitForLoadState("networkidle");
  const t = await page.locator("main").innerText();
  ok(
    "P01-31 Edge Functions down: the page still answers 200 with the hero",
    resp.status() === 200 && t.includes("Tu perfil. Tu tiempo."),
    `status ${resp.status()}`,
  );
  ok(
    "P01-31 each failed read says «No se ha podido cargar ahora. Recarga para reintentar.»",
    t.includes("No se ha podido cargar ahora. Recarga para reintentar."),
  );
  ok("P01-31 counters show «—» instead of a number", t.includes("—"));
  await shot("P01-home-error-1440-es");
}

ok(`no console errors (${MODE})`, errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
console.log(`SUMMARY ${pass}/${pass + fail} passed (${MODE})`);
process.exit(fail ? 1 : 0);
