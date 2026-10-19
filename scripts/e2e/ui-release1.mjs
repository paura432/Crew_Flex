/* eslint-disable no-console -- CLI check script: console output is its report */
// Release-1 browser checks (tools, «AOG only» option, cycle-planner draft) as professional A.
// READ-ONLY: it signs in, previews, undoes and discards — it never saves. Any Server Action call
// after sign-in (a save would be one) fails the run. Same target as the API suite:
//   local:      BASE=http://localhost:3001 node --env-file=.env.e2e scripts/e2e/ui-release1.mjs
//   production: BASE=https://crew-flex.vercel.app node --env-file=.env.e2e.production scripts/e2e/ui-release1.mjs
// PLAYWRIGHT_CORE=<dir containing playwright-core/package.json> CHROME=<chromium binary> as in
// scripts/local/ui-smoke.mjs. Remote targets only accept synthetic accounts (e2e…@ / …+e2e…@).
import { createRequire } from "node:module";

const BASE = process.env.BASE ?? "http://localhost:3001";
const EMAIL = process.env.E2E_PRO_A_EMAIL;
const PASSWORD = process.env.E2E_PRO_A_PASSWORD;
const local = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(BASE);
if (!EMAIL || !PASSWORD) throw new Error("E2E_PRO_A_EMAIL / E2E_PRO_A_PASSWORD are required");
if (!local && !/^e2e[^@]*@|\+e2e[^@]*@/.test(EMAIL)) {
  console.error("refusing: remote runs only sign in with a synthetic account");
  process.exit(2);
}
const require = createRequire(
  `${process.env.PLAYWRIGHT_CORE ?? process.cwd() + "/node_modules"}/playwright-core/package.json`,
);
const { chromium } = require("playwright-core");

const results = [];
const ok = (name, cond, detail = "") => {
  results.push(!!cond);
  console.log(`${cond ? "PASS" : "FAIL"} ${name} ${detail}`);
};
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "en-US" });
await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
let signedIn = false;
const actions = [];
page.on("request", (r) => {
  if (signedIn && r.method() === "POST" && r.headers()["next-action"]) actions.push(r.url());
});
const result = () => page.locator('[aria-live="polite"] strong').first().innerText();
const noOverflow = () =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

try {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await Promise.all([
    page.waitForURL(/\/app/, { timeout: 30_000 }),
    page.click("form:has(#email) button[type=submit]"),
  ]);
  signedIn = true;
  ok("1 sign-in as professional A", page.url().includes("/app"));

  await page.goto(`${BASE}/app/tools`);
  for (const tool of ["torque", "convert", "duration"]) {
    ok(
      `2 tools hub links /app/tools/${tool}`,
      await page.locator(`a[href$="/app/tools/${tool}"]`).count(),
    );
  }

  await page.goto(`${BASE}/app/tools/torque`);
  await page.selectOption("#tool-from", "lbf_in");
  await page.selectOption("#tool-to", "lbf_ft");
  await page.fill("#tool-value", "120");
  ok("3 torque 120 lbf·in = 10 lbf·ft", (await result()).trim() === "10", await result());
  ok("3 torque shows the safety note", await page.locator('[role="note"]').isVisible());
  await page.getByRole("button", { name: /Copy with units|Copiar con unidades/ }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  ok(
    "3 copy includes value, units and the torque note",
    /120 lbf·in = 10 lbf·ft/.test(copied) && copied.includes("·"),
    copied,
  );

  await page.goto(`${BASE}/app/tools/convert`);
  await page.fill("#tool-value", "abc");
  ok("4 invalid input shows an error", await page.locator('p[role="status"]').first().isVisible());
  await page.fill("#tool-value", "1");
  const from = await page.locator("#tool-from").inputValue();
  const to = await page.locator("#tool-to").inputValue();
  ok(
    "4 conversion renders a number",
    /^[\d.,\s]+$/.test((await result()).trim()),
    `${from}→${to} = ${await result()}`,
  );

  await page.goto(`${BASE}/app/tools/duration`);
  await page.selectOption("#duration-mode", "clock");
  await page.fill("#duration-input", "1:30");
  ok("5 duration 1:30 = 1.5 h", /^1[.,]5$/.test((await result()).trim()), await result());
  await page.fill("#duration-input", "1:75");
  ok("5 invalid clock is rejected", await page.locator('p[role="status"]').first().isVisible());

  await page.goto(`${BASE}/app/professional/availability`);
  ok(
    "6 «AOG only» status is offered",
    await page.locator('select option[value="aog_only"]').count(),
  );
  const pendingNote = page.locator('p[role="status"]', {
    hasText: /not saved|sin guardar|no guardad/i,
  });
  await page.selectOption("#cycle-pattern", "5x2");
  await page.fill("#cycle-anchor", new Date().toISOString().slice(0, 10));
  // Days already saved this month are only planned over when «replace» is ticked.
  await page.getByLabel(/Also replace days|Reemplazar también/).check();
  await page.getByRole("button", { name: /Preview the cycle|Previsualizar ciclo/ }).click();
  ok("7 preview creates an unsaved draft", await pendingNote.isVisible());
  const draftText = await pendingNote.innerText();
  ok(
    "7 month navigation is locked while a draft exists",
    await page.getByRole("button", { name: /Next month|Mes siguiente/ }).isDisabled(),
  );
  // Undo must restore the exact draft: compare the clicked day's state before, after and undone.
  const freeDay = page.locator('button[aria-label^="20"]:not([disabled])').last();
  const dayBefore = await freeDay.getAttribute("aria-label");
  await freeDay.click();
  const dayAfter = await freeDay.getAttribute("aria-label");
  ok("7 a day click changes the draft", dayAfter !== dayBefore, `${dayBefore} → ${dayAfter}`);
  await page.getByRole("button", { name: /Undo last change|Deshacer último cambio/ }).click();
  ok(
    "7 undo restores the previous draft",
    (await freeDay.getAttribute("aria-label")) === dayBefore &&
      (await pendingNote.innerText()) === draftText,
  );
  await page.getByRole("button", { name: /Discard changes|Descartar cambios/ }).click();
  ok("7 discard clears the draft", !(await pendingNote.isVisible()));
  await page.reload();
  ok("7 nothing was saved (no draft after reload)", !(await pendingNote.isVisible()));

  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [
    "/app/tools",
    "/app/tools/torque",
    "/app/tools/duration",
    "/app/professional/availability",
  ]) {
    await page.goto(`${BASE}${path}`);
    ok(`8 390px without horizontal overflow ${path}`, await noOverflow());
  }
} catch (e) {
  ok("unexpected error", false, String(e));
}
ok("9 no Server Action (save) was called after sign-in", actions.length === 0, actions.join(" "));
ok("9 no client errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
