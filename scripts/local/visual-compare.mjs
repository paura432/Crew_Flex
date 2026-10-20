/* eslint-disable no-console -- CLI check script: console output is its report */
// Side-by-side captures: CrewFlex v1.8 reference (demo build from tmp/CrewFlex_v1.8.zip, served on
// 127.0.0.1 only) vs the local Next.js app. Isolation: fresh ephemeral browser context (no profile),
// service workers blocked, every HTTP(S) request outside 127.0.0.1/localhost aborted and logged,
// WebSockets closed, and DNS for any other host fails (--host-resolver-rules: no preconnect/prefetch).
// Usage (from the repo root, local stack + `next start -p 3001` running):
//   python3 -I -m http.server 56380 --bind 127.0.0.1 --directory <extracted zip>/CrewFlex-v1.8/dist &
//   PLAYWRIGHT_CORE=… CHROME=… OUT=docs/audit/evidence/v18-compare node scripts/local/visual-compare.mjs
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const V18 = "http://127.0.0.1:56380/";
const NEXT = process.env.BASE ?? "http://localhost:3001";
const OUT = process.env.OUT ?? "docs/audit/evidence/v18-compare";
const ALL = [1440, 1024, 768, 390, 360];
const TWO = [1440, 390];
const require = createRequire(`${process.env.PLAYWRIGHT_CORE}/playwright-core/package.json`);
const { chromium } = require("playwright-core");
const blocked = new Set();
const browser = await chromium.launch({
  executablePath: process.env.CHROME,
  headless: true,
  args: ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost"],
});

async function context() {
  const ctx = await browser.newContext({ serviceWorkers: "block", locale: "es-ES" });
  await ctx.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (["127.0.0.1", "localhost"].includes(u.hostname)) return route.continue();
    blocked.add(u.origin);
    return route.abort();
  });
  await ctx.routeWebSocket(/.*/, (ws) => {
    blocked.add(`ws:${ws.url()}`);
    ws.close();
  });
  return ctx;
}
async function shoot(page, side, name, widths) {
  mkdirSync(`${OUT}/${side}`, { recursive: true });
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/${side}/${name}-${w}.jpg`, type: "jpeg", quality: 55 });
  }
  console.log(`${side} ${name} ${widths.join("/")}`);
}

// v1.8 demo: technician (default role), then company via «Probar como».
const ref = await (await context()).newPage();
const v18 = async (hash, name, widths) => {
  await ref.goto(`${V18}#${hash}`);
  await ref.waitForLoadState("networkidle");
  await shoot(ref, "v18", name, widths);
};
await ref.goto(V18);
await ref.waitForLoadState("networkidle");
await v18("home", "tech-home", ALL);
await v18("profile", "tech-passport", TWO);
await v18("calendar", "tech-availability", ALL);
await v18("jobs", "tech-opportunities", TWO);
await v18("applications", "tech-applications", TWO);
await v18("docs", "tech-documents", TWO);
await v18("tools", "tools", TWO);
await ref.setViewportSize({ width: 1440, height: 900 }); // the role picker is desktop-only
await ref.goto(`${V18}#home`);
const roleSelect = ref
  .locator("select")
  .filter({ has: ref.locator("option", { hasText: /Empresa/ }) });
const label = await roleSelect
  .first()
  .locator("option", { hasText: /Empresa/ })
  .first()
  .innerText();
await roleSelect.first().selectOption({ label });
await v18("home", "org-home", ALL);
await v18("create", "org-new-requirement", TWO);
await v18("manage", "org-requirements", TWO);
await v18("candidates", "org-matches", ALL);

// Next.js (local stack, seed accounts).
const app = await (await context()).newPage();
const login = async (email) => {
  await app.goto(`${NEXT}/login`);
  await app.fill("#email", email);
  await app.fill("#password", "crewflex-local-only");
  await Promise.all([app.waitForURL(/\/app/), app.click("form button[type=submit]")]);
};
const next = async (path, name, widths) => {
  await app.goto(`${NEXT}${path}`);
  await app.waitForLoadState("networkidle");
  await shoot(app, "next", name, widths);
};
await login("delta@crewflex.test");
await next("/app/professional", "tech-home", ALL);
await next("/app/professional/profile", "tech-passport", TWO);
await next("/app/professional/availability", "tech-availability", ALL);
await next("/app/professional/documents", "tech-documents", TWO);
await next("/app/tools", "tools", TWO);
await app.context().clearCookies();
await login("admin.mro@crewflex.test");
await next("/app/organization", "org-home", ALL);
await next("/app/organization/requirements/new", "org-new-requirement", TWO);
await next("/app/organization/requirements", "org-requirements", TWO);
const mad = await app
  .locator("main a[href*='/requirements/']", { hasText: "A320 line maintenance" })
  .first()
  .getAttribute("href");
await next(`${mad}/matches`, "org-matches", ALL);

console.log(`blocked external origins: ${[...blocked].join(", ") || "none"}`);
await browser.close();
