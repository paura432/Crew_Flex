/* eslint-disable no-console -- CLI evidence script: console output is its report */
// P02 «Mi pasaporte» captures for 17-parity-matrix-v18.md §P02 (F3, 2026-10-26): delta's passport at five widths
// (es), 1440 (en), the «Empezar desde cero» dialog and the empty draft, the qualifications page; each width is
// checked for horizontal overflow. Nothing is saved (the draft is never submitted). Local stack only.
// Usage: BASE=http://localhost:3202 EVID=docs/audit/evidence/parity/P02 PLAYWRIGHT_CORE=<dir> CHROME=<chromium>
//        node scripts/local/p02-captures.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(`${process.env.PLAYWRIGHT_CORE}/playwright-core`);
const BASE = process.env.BASE ?? "http://localhost:3202";
const EVID = process.env.EVID ?? "docs/audit/evidence/parity/P02";
const PW = "crewflex-local-only";
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
  if (m.type() === "error") errors.push(m.text());
});

async function setLang(lang) {
  await page.goto(`${BASE}/app/settings`);
  await page.waitForLoadState("networkidle");
  if ((await page.evaluate(() => document.documentElement.lang)) === lang) return;
  await page.locator(`[role=radio][lang=${lang}]`).first().click();
  await page.waitForSelector("[role=status]", { timeout: 15000 });
}
async function open(path, width) {
  await page.setViewportSize({ width, height: width < 800 ? 1100 : 900 });
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState("networkidle");
}
const overflow = () =>
  page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
const shot = (name, fullPage = true) =>
  page.screenshot({ path: `${EVID}/${name}.jpg`, type: "jpeg", quality: 70, fullPage });

await page.goto(`${BASE}/login`);
await page.fill("#email", "delta@crewflex.test");
await page.fill("#password", PW);
await page.click("button[type=submit]");
await page.waitForURL((u) => u.pathname.startsWith("/app/"), { timeout: 30000 });
await setLang("es");
for (const width of [1440, 1024, 768, 390, 360]) {
  await open("/app/professional/profile", width);
  ok(`passport es @${width}: no horizontal overflow`, !(await overflow()));
  if ([1440, 390].includes(width)) await shot(`P02-passport-after-${width}`);
}
await open("/app/professional/profile", 1440);
await page.getByRole("button", { name: "Empezar perfil vacío" }).click();
await page.getByRole("dialog", { name: "Empezar desde cero" }).waitFor();
await shot("P02-passport-dialog-after-1440", false);
await page.getByRole("button", { name: "Preparar borrador" }).click();
await page.waitForSelector("[role=status]:has-text('Borrador vacío preparado')", {
  timeout: 15000,
});
ok(
  "empty draft: name cleared, nothing saved (the form is never submitted here)",
  (await page.inputValue("#displayName")) === "",
);
await shot("P02-passport-draft-after-1440");
await open("/app/professional/qualifications", 1440);
ok("qualifications es @1440: no horizontal overflow", !(await overflow()));
await shot("P02-qualifications-after-1440");
await setLang("en");
await open("/app/professional/profile", 1440);
ok("passport en @1440: no horizontal overflow", !(await overflow()));
await shot("P02-passport-after-1440-en");
await setLang("es");
await browser.close();
ok("zero console/page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
console.log(`\nSUMMARY ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
