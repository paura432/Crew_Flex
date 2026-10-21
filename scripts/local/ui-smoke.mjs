/* eslint-disable no-console -- CLI smoke script: console output is its report */
// Local UI smoke against the Docker stack (docs/qa/LOCAL_ENVIRONMENT.md §5). Synthetic seed accounts only.
// Usage: BASE=http://localhost:3001 PLAYWRIGHT_CORE=<dir with playwright-core/package.json> CHROME=<chromium binary> node scripts/local/ui-smoke.mjs
import { createRequire } from "node:module";
const require = createRequire(
  `${process.env.PLAYWRIGHT_CORE ?? process.cwd() + "/node_modules"}/playwright-core/package.json`,
);
const { chromium } = require("playwright-core");
const BASE = process.env.BASE ?? "http://localhost:3001";
const EVIDENCE = process.env.EVIDENCE_DIR ?? "docs/audit/evidence";
const PW = "crewflex-local-only";
// Preflight: Next.js loads `.env.production.local` for `next build`/`next start`; a remote backup under
// that name would silently point a production-mode run at the remote project. Refuse to run then.
import { existsSync, readFileSync } from "node:fs";
for (const f of [".env.production.local", ".env.production", ".env"]) {
  if (existsSync(f)) {
    console.error(`refusing: ${f} exists and could override .env.local for production-mode runs`);
    process.exit(2);
  }
}
const envLocal = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
if (!/NEXT_PUBLIC_SUPABASE_URL=http:\/\/(127\.0\.0\.1|localhost):\d+/.test(envLocal)) {
  console.error("refusing: .env.local does not point at a local Supabase stack");
  process.exit(2);
}
// Steps 20–22 exercise the platform-admin review, which the Next server hides unless enabled (OD-3).
if (!/^QUALIFICATION_REVIEW_ENABLED=true$/m.test(envLocal)) {
  console.error(
    "refusing: set QUALIFICATION_REVIEW_ENABLED=true in .env.local (local review flow)",
  );
  process.exit(2);
}
const results = [];
// Words that only exist in the English catalog. Seeing them while the UI is Spanish = untranslated text.
const EN_SENTINELS =
  /\b(Sign out|Sign in|Requirements|Availability|Qualifications|Workforce|Overview|Settings|Save changes|Declare|Passport|Dashboard|Create account|Not found|Eligible|Blockers|Pending review|Verified|Gap|Coverage)\b/;
async function expectSpanish(name) {
  const lang = await page.evaluate(() => document.documentElement.lang);
  const text = await page.locator("body").innerText();
  const hits = [...new Set(text.match(new RegExp(EN_SENTINELS.source, "g")) ?? [])];
  // "Verified"/"Pending review" may appear inside user data? No: codes and names are not English words.
  ok(
    `${name}: html lang=es and no English UI strings`,
    lang === "es" && hits.length === 0,
    `lang=${lang} ${hits.join(",")}`,
  );
}
const ok = (name, cond, detail = "") => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"} ${name} ${detail}`);
};

const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
const expectedErrorUrls = new Set(); // pages whose 404 is the behaviour under test (cross-org)
const isExpected404 = (text, url) =>
  /status of 404/.test(text) && [...expectedErrorUrls].some((u) => url.startsWith(u));
page.on("pageerror", (e) => errors.push(`${String(e)} @ ${page.url()}`));
const cspViolations = [];
page.on("console", (m) => {
  if (/Content Security Policy/.test(m.text())) cspViolations.push(`${m.text()} @ ${page.url()}`);
  if (m.type() === "error" && !isExpected404(m.text(), page.url()))
    errors.push(`${m.text()} @ ${page.url()}`);
});
const hosts = new Set();
page.on("request", (r) => hosts.add(new URL(r.url()).host));
const shot = (name) =>
  page.screenshot({
    path: `${EVIDENCE}/local-${name}.jpg`,
    type: "jpeg",
    quality: 70,
    fullPage: false,
  });
/** Same page at the three reference widths (docs/qa/QUALITY_GATES.md): 1440 / 768 / 390. */
async function responsiveShots(name) {
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: width < 800 ? 1100 : 900 });
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    ok(`${name} @${width}: no horizontal overflow`, !overflow, "");
    await shot(`${name}-${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

async function login(email, { ensureEnglish = true } = {}) {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", PW);
  await page.click("button[type=submit]");
  // `/app` itself redirects by account type; wait for the workspace route, not the redirect page.
  await page.waitForURL((u) => /^\/app\/(professional|organization)/.test(u.pathname), {
    timeout: 30000,
  });
  await page.waitForLoadState("networkidle");
  // The English checks below assume the account's persisted language is English (seed = none).
  if (ensureEnglish && (await page.evaluate(() => document.documentElement.lang)) !== "en") {
    await page.goto(`${BASE}/app/settings`);
    await page.waitForLoadState("networkidle");
    await page.locator("[role=radio][lang=en]").first().click();
    await page.waitForSelector("[role=status]:has-text('Language updated')", { timeout: 15000 });
    await page.goto(`${BASE}/app`);
    await page.waitForLoadState("networkidle");
  }
}
async function logout() {
  if (errors.length)
    console.log(
      "  (console errors so far:",
      errors
        .slice(-2)
        .map((e) => e.slice(0, 160))
        .join(" | "),
      ")",
    );
  // Submit the sign-out form directly: the Next dev overlay badge can intercept pointer events in headless runs.
  if (!(await page.locator("form:has(button:has-text('Sign out'))").count())) {
    await page.goto(`${BASE}/app`);
    await page.waitForLoadState("networkidle");
  }
  await page
    .locator("form:has(button:has-text('Sign out'))")
    .last()
    .evaluate((f) => f.requestSubmit());
  await page.waitForURL((u) => !u.pathname.startsWith("/app"), { timeout: 20000 });
}

const publishableKey = /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=(\S+)/.exec(envLocal)?.[1];
const supabaseUrl = /NEXT_PUBLIC_SUPABASE_URL=(\S+)/.exec(envLocal)?.[1];
/** Direct local API call as a seed account (used only to restore seed state after a UI change). */
async function asSeedUser(email, fn, { method = "GET", query = {}, body } = {}) {
  const auth = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: publishableKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PW }),
  }).then((r) => r.json());
  const url = new URL(`/functions/v1/${fn}`, supabaseUrl);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${auth.access_token}`,
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then((r) => r.json());
}

/** Golf's B1.1 is the seed's "pending" case; an interrupted earlier run may have left it verified. */
async function ensureGolfPending() {
  const own = await asSeedUser("golf@crewflex.test", "professional-qualifications");
  const b11 = own.data.qualifications.find((q) => q.type.code === "B1.1");
  if (b11.verificationStatus === "pending") return true;
  for (const expiresAt of ["2029-06-29", b11.expiresAt]) {
    await asSeedUser("golf@crewflex.test", "professional-qualifications", {
      method: "PATCH",
      query: { id: b11.id },
      body: { issuedAt: b11.issuedAt, expiresAt, status: "active" },
    });
  }
  const again = await asSeedUser("golf@crewflex.test", "professional-qualifications");
  return (
    again.data.qualifications.find((q) => q.type.code === "B1.1").verificationStatus === "pending"
  );
}

ok("0 seed precondition: Golf's B1.1 is pending", await ensureGolfPending(), "");

// 1. Technician: login, profile, availability CRUD + reload, logout
const loginResponse = await page.goto(`${BASE}/login`);
const cspHeader = loginResponse?.headers()["content-security-policy-report-only"] ?? "";
ok(
  "0 CSP report-only header with a nonce and strict-dynamic (T18)",
  /script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/.test(cspHeader) &&
    /frame-ancestors 'none'/.test(cspHeader),
  cspHeader.slice(0, 80),
);
await login("delta@crewflex.test");
ok(
  "1 login delta (external professional) → /app/professional",
  page.url().includes("/app/professional"),
  page.url(),
);
const cookies = await ctx.cookies();
ok(
  "1b auth cookie bound to local project (sb-*-auth-token)",
  cookies.some((c) => /^sb-.*-auth-token/.test(c.name)),
  cookies
    .filter((c) => c.name.startsWith("sb-"))
    .map((c) => c.name)
    .join(","),
);
await page.goto(`${BASE}/app/professional`);
await page.waitForLoadState("networkidle");
const profileText = await page.locator("main").innerText();
ok(
  "2 profile overview shows own data (Barcelona, 5 qualifications, anonymous)",
  /Barcelona \(BCN\)/.test(profileText) &&
    /Anonymous/.test(profileText) &&
    /QUALIFICATIONS\s*5/i.test(profileText),
  "",
);
ok(
  "2g TD-44 review panel present with its «declared dates» hint (rows depend on the clock)",
  /Documents and courses to review/.test(profileText) &&
    /Based on the dates you declared/.test(profileText),
  "",
);
await shot("01-technician-overview");
// Batch 3 (M02, V1.8 TechnicianHome): full status checklist + read-only month calendar.
const checklist = page
  .locator("main section", { hasText: /Profile completeness · / })
  .locator("li");
const today = new Date().toISOString().slice(0, 10);
const todayCell = page.locator(`main li[aria-current=date]`);
ok(
  "2b overview: 7-item checklist with links for the missing ones; today marked in the month",
  (await checklist.count()) === 7 &&
    (await todayCell.getAttribute("aria-label")) === `${today}: Available`,
  `${await checklist.count()} items · ${await todayCell.getAttribute("aria-label")}`,
);
await page.getByRole("link", { name: "Next month" }).click();
await page.waitForURL(/month=\d{4}-\d{2}/);
const nextMonthDay = await page
  .locator("main ol[aria-label] li[aria-label]")
  .first()
  .getAttribute("aria-label");
ok(
  "2c month navigation by link (next month: no windows → Rest)",
  /: Rest$/.test(nextMonthDay ?? ""),
  nextMonthDay,
);
// 2e (batch 11, V1.8 hides the progress when complete): Delta is at 100 % → list folded, one click away.
ok(
  "2e complete profile: checklist folded behind «The 7 profile items»",
  (await page.getByText("The 7 profile items").isVisible()) &&
    !(await checklist.first().isVisible()),
);
// 2d (batch 7, V1.8 colours): AOG legend swatch is orange (warn-bg), the partial day is hatched.
const swatch = (label) =>
  page
    .locator("main li:has(> span.size-3)", { hasText: label })
    .locator("span[aria-hidden]")
    .first()
    .evaluate((el) => {
      const cs = getComputedStyle(el);
      return `${cs.backgroundColor}|${cs.backgroundImage}`;
    });
const aogSwatch = await swatch("AOG only");
const partialSwatch = await swatch("Partial");
ok(
  "2d calendar colours: AOG orange (not red), partial day hatched",
  aogSwatch.startsWith("rgb(255, 240, 225)") && /repeating-linear-gradient/.test(partialSwatch),
  `${aogSwatch} · ${partialSwatch}`,
);
await page.goto(`${BASE}/app/professional/availability`);
await page.waitForLoadState("networkidle");
const before = await page.locator("li:has(button:has-text('Delete'))").count();
await page.fill("#startsAt", "2031-05-10T08:00");
await page.fill("#endsAt", "2031-05-12T08:00");
await page.selectOption("#status", "available");
await page.click("form button[type=submit]:has-text('Add')");
await page.waitForTimeout(2500);
let after = await page.locator("li:has(button:has-text('Delete'))").count();
ok("3 create window (count +1)", after === before + 1, `${before}→${after}`);
await shot("02-availability-created");
const row = page.locator("li:has(button:has-text('Delete'))").filter({ hasText: "2031" }).first();
await row.locator("button:has-text('Edit')").click();
await page.selectOption("#status", "unavailable");
await page.fill("#endsAt", "2031-05-13T08:00");
await page.click("form button[type=submit]:has-text('Save')");
await page.waitForTimeout(2500);
await page.reload();
await page.waitForLoadState("networkidle");
const persisted = await page
  .locator("li:has(button:has-text('Delete'))")
  .filter({ hasText: "2031" })
  .first()
  .innerText();
ok(
  "4 edit + reload persists (unavailable, 13 May)",
  /unavailable/i.test(persisted) && /13/.test(persisted),
  persisted.replace(/\s+/g, " ").slice(0, 100),
);
await shot("03-availability-edited-after-reload");
// Batch 4 (M04, V1.8 planner): the custom cycle can start from the alternating 7–3 / 7–4 rotation.
await page.selectOption("#cycle-pattern", "custom");
await page.getByRole("button", { name: "Use 7–3 / 7–4 as base" }).click();
ok(
  "3b custom cycle from 7–3 / 7–4: 21 days, 14 working",
  (await page.inputValue("#cycle-length")) === "21" &&
    (await page
      .locator('[role=group][aria-label^="Days of the custom cycle"] button[aria-pressed="true"]')
      .count()) === 14,
  `${await page.inputValue("#cycle-length")} days`,
);
// Batch 4 (M10, V1.8 documentStatus): expiry chips — expires soon ≤45 days, valid after. Nothing kept.
const inDays = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
await page.goto(`${BASE}/app/professional/documents`);
await page.waitForLoadState("networkidle");
await page.setInputFiles("#file", {
  name: "smoke.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\n%smoke\n"),
});
await page.fill("#title", "Smoke expiry check");
await page.fill("#expiresAt", inDays(10));
await page.getByRole("button", { name: "Upload document" }).click();
const docRow = page.locator("main li", { hasText: "Smoke expiry check" });
await docRow.waitFor({ timeout: 15_000 });
const soonChip = await docRow.innerText();
await docRow.getByRole("button", { name: "Edit" }).click();
// In edit mode the title moves into an input, so target the row's edit form.
const editForm = page.locator("main li form");
await editForm.locator('input[name="expiresAt"]').fill(inDays(100));
await editForm.getByRole("button", { name: "Save" }).click();
await page
  .locator("main li", { hasText: "Smoke expiry check" })
  .getByText("Valid")
  .waitFor({ timeout: 15_000 });
ok(
  "3c document expiry: «Expires soon» at +10 d, «Valid» at +100 d",
  /Expires soon/i.test(soonChip),
  "",
);
const row2 = page.locator("main li", { hasText: "Smoke expiry check" });
await row2.getByRole("button", { name: "Delete" }).click();
await row2.getByRole("button", { name: "Confirm delete" }).click();
await row2.waitFor({ state: "detached", timeout: 15_000 });
await page.goto(`${BASE}/app/professional/availability`); // back to where the next step continues
await page.waitForLoadState("networkidle");
await page
  .locator("li:has(button:has-text('Delete'))")
  .filter({ hasText: "2031" })
  .first()
  .locator("button:has-text('Delete')")
  .click();
await page.waitForTimeout(2500);
after = await page.locator("li:has(button:has-text('Delete'))").filter({ hasText: "2031" }).count();
ok("5 delete window", after === 0, `${after} rows with 2031 left`);

// 1b. Passport: edit → save → reload persists → restore seed values
await page.goto(`${BASE}/app/professional/profile`);
await page.waitForLoadState("networkidle");
const originalYears = await page.inputValue("#yearsExperience");
const originalBase = await page.inputValue("#baseLocation");
await responsiveShots("10-passport");
await page.fill("#baseLocation", "Valencia (VLC)");
await page.fill("#yearsExperience", String(Number(originalYears || 0) + 1));
await page.selectOption("#currentStatus", "between_contracts");
await page.click("main form button[type=submit]");
await page.waitForSelector("[role=status]:has-text('Passport updated')", { timeout: 15000 });
await page.reload();
await page.waitForLoadState("networkidle");
ok(
  "5b passport edit persists after reload (base, years, status)",
  (await page.inputValue("#baseLocation")) === "Valencia (VLC)" &&
    (await page.inputValue("#yearsExperience")) === String(Number(originalYears || 0) + 1) &&
    (await page.inputValue("#currentStatus")) === "between_contracts",
  `${await page.inputValue("#baseLocation")} / ${await page.inputValue("#yearsExperience")}`,
);
await shot("11-passport-edited-after-reload");
await page.fill("#displayName", "");
await page.click("main form button[type=submit]");
ok(
  "5c client validation blocks an empty professional name",
  (await page.locator("#displayName-error").count()) === 1,
  "",
);
await page.goto(`${BASE}/app/professional/profile`);
await page.waitForLoadState("networkidle");
await page.fill("#baseLocation", originalBase);
await page.fill("#yearsExperience", originalYears);
await page.selectOption("#currentStatus", "contractor");
await page.click("main form button[type=submit]");
await page.waitForSelector("[role=status]:has-text('Passport updated')", { timeout: 15000 });

// 1c. Qualifications: declare (pending) → edit expiry → reload persists → remove
await page.goto(`${BASE}/app/professional/qualifications`);
await page.waitForLoadState("networkidle");
const qualsBefore = await page.locator("li:has(button:has-text('Remove'))").count();
await responsiveShots("12-qualifications");
await page.selectOption("#qualificationTypeId", { label: "B2 · Part-66 B2 — Avionics" });
await page.click("main form button[type=submit]:has-text('Declare')");
ok(
  "5d BR-2.7: B2 without expiry is refused client-side",
  /requires an expiry date/.test(
    await page
      .locator("#expiresAt-error")
      .innerText()
      .catch(() => ""),
  ),
  "",
);
await page.fill("#issuedAt", "2024-01-15");
await page.fill("#expiresAt", "2031-01-15");
await page.click("main form button[type=submit]:has-text('Declare')");
await page.waitForSelector("[role=status]:has-text('B2 declared')", { timeout: 15000 });
await page.reload();
await page.waitForLoadState("networkidle");
const b2Row = page
  .locator("li:has(button:has-text('Remove'))")
  .filter({ has: page.locator("span.font-mono", { hasText: /^B2$/ }) })
  .first();
ok(
  "5e declared B2 persists after reload as Held · Pending review",
  (await page.locator("li:has(button:has-text('Remove'))").count()) === qualsBefore + 1 &&
    /pending review/i.test(await b2Row.innerText()) &&
    /\bheld\b/i.test(await b2Row.innerText()),
  (await b2Row.innerText().catch(() => "no row")).replace(/\s+/g, " ").slice(0, 120),
);
await shot("13-qualification-declared");
await b2Row.locator("button:has-text('Edit')").click();
await page.fill("#expiresAt", "2032-01-15");
await page.click("main form button[type=submit]:has-text('Save')");
await page.waitForSelector("[role=status]:has-text('B2 updated')", { timeout: 15000 });
await page.reload();
await page.waitForLoadState("networkidle");
ok(
  "5f edited expiry persists after reload",
  /15 Jan 2032/.test(await b2Row.innerText()),
  (await b2Row.innerText()).replace(/\s+/g, " ").slice(0, 120),
);
// Batch 14 (TD-44 / BR-12): an expiry 30 days out shows the «Expires soon» chip on the row and the
// overview lists it under «Documents and courses to review» with a link back.
const dayOffset = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
await b2Row.locator("button:has-text('Edit')").click();
await page.fill("#expiresAt", dayOffset(-1));
await page.click("main form button[type=submit]:has-text('Save')");
await page.waitForSelector("[role=status]:has-text('B2 updated')", { timeout: 15000 });
await page.reload();
await page.waitForLoadState("networkidle");
ok(
  "5f1 BR-12 chip on the qualification row: Expired",
  /Expired\b/.test(await b2Row.innerText()), // «…2026Expired»: no word boundary before the chip
  (await b2Row.innerText()).replace(/\s+/g, " ").slice(0, 120),
);
await page.goto(`${BASE}/app/professional`);
await page.waitForLoadState("networkidle");
ok(
  "5f1b TD-44 overview lists the expired B2 first as «Date passed»",
  /B2 · Part-66 B2/.test(
    await page
      .locator("li", { hasText: /Date passed/ })
      .first()
      .innerText(),
  ),
  "",
);
await page.goto(`${BASE}/app/professional/qualifications`);
await page.waitForLoadState("networkidle");
await b2Row.locator("button:has-text('Edit')").click();
await page.fill("#expiresAt", dayOffset(30));
await page.click("main form button[type=submit]:has-text('Save')");
await page.waitForSelector("[role=status]:has-text('B2 updated')", { timeout: 15000 });
await page.reload();
await page.waitForLoadState("networkidle");
ok(
  "5f2 BR-12 chip on the qualification row: Expires soon",
  /Expires soon/.test(await b2Row.innerText()),
  (await b2Row.innerText()).replace(/\s+/g, " ").slice(0, 120),
);
await page.goto(`${BASE}/app/professional`);
await page.waitForLoadState("networkidle");
const reviewRow = page
  .locator("li", { hasText: /B2 · Part-66 B2/ })
  .filter({ hasText: /Next 60 days/ });
ok(
  "5f3 TD-44 overview lists B2 under «Documents and courses to review» with a link",
  (await reviewRow.count()) === 1 &&
    (await reviewRow.locator("a[href='/app/professional/qualifications']").count()) === 1,
  (await page.locator("main").innerText()).match(
    /Documents and courses to review[\s\S]{0,160}/,
  )?.[0] ?? "",
);
await page.goto(`${BASE}/app/professional/qualifications`);
await page.waitForLoadState("networkidle");
await b2Row.locator("button:has-text('Remove')").click();
await page.waitForSelector("[role=status]:has-text('B2 removed')", { timeout: 15000 });
await page.reload();
await page.waitForLoadState("networkidle");
ok(
  "5g removed B2 is gone (seed state restored)",
  (await page.locator("li:has(button:has-text('Remove'))").count()) === qualsBefore,
  "",
);
// 1d. Settings: Spanish → navigate → reload → still Spanish (flow 6); screenshots in Spanish
await page.goto(`${BASE}/app/settings`);
await page.waitForLoadState("networkidle");
ok(
  "5h settings page reachable from the professional nav",
  /Language \/ Idioma|Idioma \/ Language/.test(await page.locator("main").innerText()),
  "",
);
await responsiveShots("14-settings-en");
await page.locator("[role=radio][lang=es]").first().click();
await page.waitForSelector("[role=status]:has-text('Idioma actualizado')", { timeout: 15000 });
await page.goto(`${BASE}/app/professional`);
await page.waitForLoadState("networkidle");
await expectSpanish("5i overview after switching to Spanish");
await responsiveShots("15-overview-es");
await page.goto(`${BASE}/app/professional/qualifications`);
await page.waitForLoadState("networkidle");
await expectSpanish("5j qualifications in Spanish");
await responsiveShots("16-qualifications-es");
await page.goto(`${BASE}/app/professional/availability`);
await page.waitForLoadState("networkidle");
await expectSpanish("5k availability in Spanish");
await shot("17-availability-es");
await page.reload();
await page.waitForLoadState("networkidle");
await expectSpanish("5l Spanish persists after reload (flow 6)");
// Flow 7 (inverse): English → sign out → sign in → still English (preference, not just the cookie)
await page.goto(`${BASE}/app/settings`);
await page.waitForLoadState("networkidle");
await page.locator("[role=radio][lang=en]").first().click();
await page.waitForSelector("[role=status]:has-text('Language updated')", { timeout: 15000 });
await ctx.clearCookies();
await login("delta@crewflex.test", { ensureEnglish: false });
await page.goto(`${BASE}/app/professional`);
await page.waitForLoadState("networkidle");
ok(
  "5m English persists after sign out/in with cookies cleared (flow 7, DB preference)",
  (await page.evaluate(() => document.documentElement.lang)) === "en" &&
    /your profile\. your time\./i.test(await page.locator("main").innerText()),
  await page.evaluate(() => document.documentElement.lang),
);

await page.goto(`${BASE}/app/organization`);
await page.waitForLoadState("networkidle");
ok(
  "6 external professional cannot use the organization area",
  !page.url().includes("/app/organization") ||
    /not found|404|no organization|not a member/i.test(await page.locator("body").innerText()),
  page.url(),
);
await logout();
ok("7 logout", !page.url().includes("/app"), page.url());

// 2. Organization admin: dashboard, requirements, capacity, matches, create
await login("admin.mro@crewflex.test");
ok("8 login admin.mro → /app/organization", page.url().includes("/app/organization"), page.url());
await shot("04-organization-dashboard");
await page.goto(`${BASE}/app/organization/requirements`);
await page.waitForLoadState("networkidle");
const list = await page.locator("main").innerText();
ok(
  "9 requirements list shows MAD need and cancelled one, not other orgs",
  /A320 line maintenance/.test(list) &&
    /cancelled/i.test(list) &&
    !/A330 avionics/.test(list) &&
    !/B737 AOG/.test(list),
  "",
);
await shot("05-requirements-list");
const madHref = await page
  .locator("a:has-text('A320 line maintenance')")
  .first()
  .getAttribute("href");
await page.goto(`${BASE}${madHref}`);
await page.waitForLoadState("networkidle");
const madUrl = page.url();
const detail = await page.locator("main").innerText();
ok(
  "10 capacity: internal workforce shown with gap (Alpha eligible, Bravo FTS expired)",
  /gap/i.test(detail) &&
    /Bravo/.test(detail) &&
    /Alpha/.test(detail) &&
    /Internal workforce \(4\)/.test(detail),
  detail.match(/gap[^\n]*/i)?.[0] ?? detail.slice(0, 200),
);
await shot("06-requirement-capacity");
await page.goto(`${madUrl}/matches`);
await page.waitForLoadState("networkidle");
const matches = await page.locator("main").innerText();
ok(
  "11 matching: 3 eligible of 10, explainable blockers, anonymous refs, no private Hotel",
  /3\s*eligible of\s*10/.test(matches) &&
    /CF-[0-9A-F]{10}/.test(matches) &&
    !/Hotel/.test(matches) &&
    /Echo|Juliett|Quebec/.test(matches),
  matches.match(/\d+\s*eligible of\s*\d+ evaluated/)?.[0] ??
    "summary not found: " + matches.slice(0, 200),
);
ok(
  "11b blockers explained: pending, rejected, missing (withdrawn/TR), partial availability",
  /not verified \(pending review\)/.test(matches) &&
    /not verified \(rejected\)/.test(matches) &&
    /Missing (B1\.1|TR-A320)/.test(matches) &&
    /Available for only \d+(\.\d+)?% of the requirement period/.test(matches),
  [
    ...matches.matchAll(
      /(not verified \([a-z]+\)|Missing [A-Z0-9.\-]+|Available for only [\d.]+%)/g,
    ),
  ]
    .map((m) => m[1])
    .join("; "),
);
// Batch 2 (M06, V1.8 CandidateDirectory): eligible-only, sort, search, compare — native GET forms.
const cards = () => page.locator("main article");
// The list streams in after `load` (Suspense, loading.tsx): wait for the first card.
const listed = () => page.locator("main article").first().waitFor({ timeout: 15_000 });
await page.locator('input[name="eligible"]').check();
await Promise.all([
  page.waitForURL(/eligible=1/),
  page.getByRole("button", { name: "Apply" }).click(),
]);
await listed();
ok(
  "11h eligible-only keeps the 3 eligible",
  (await cards().count()) === 3,
  `${await cards().count()} cards`,
);
await page.goto(`${madUrl}/matches`);
await page.selectOption('select[name="sort"]', "years");
await Promise.all([
  page.waitForURL(/sort=years/),
  page.getByRole("button", { name: "Apply" }).click(),
]);
await listed();
const years = (await cards().allInnerTexts()).map((t) => Number(/(\d+) years?/.exec(t)?.[1] ?? -1));
ok(
  "11i sort by experience: non-increasing",
  years.length === 10 && years.every((y, i) => i === 0 || y <= years[i - 1]),
  years.join(","),
);
const firstRef = /CF-[0-9A-F]{10}/.exec(await cards().first().innerText())?.[0];
await page.goto(`${madUrl}/matches?q=${firstRef?.toLowerCase()}`);
await listed();
ok(
  "11j search by pseudonym (case-insensitive) finds exactly it",
  (await cards().count()) === 1,
  firstRef,
);
await page.goto(`${madUrl}/matches`);
await listed();
await cards().nth(0).getByLabel("Compare").check();
await cards().nth(1).getByLabel("Compare").check();
await Promise.all([
  page.waitForURL(/compare=.*compare=/),
  page.getByRole("button", { name: /Compare selected/ }).click(),
]);
const compare = page.locator("section[aria-labelledby=compare-title]");
await compare.waitFor({ timeout: 15_000 });
ok(
  "11k compare: side-by-side table of the 2 selected, cleared by its link",
  (await compare.locator("thead th").count()) === 3 && /Verdict/.test(await compare.innerText()),
);
await compare.getByRole("link", { name: "Clear comparison" }).click();
await page.waitForURL((u) => !u.search.includes("compare"));
// 11l (second audit 2026-10-20): candidates selected earlier stay selected when the filter hides
// them — pick 2 non-eligible, filter eligible-only, add 1 eligible → 3 compared; then the cap.
await cards().nth(8).getByLabel("Compare").check();
await cards().nth(9).getByLabel("Compare").check();
await Promise.all([
  page.waitForURL(/compare=.*compare=/),
  page.getByRole("button", { name: /Compare selected/ }).click(),
]);
await listed();
await page.locator('input[name="eligible"]').check();
await Promise.all([
  page.waitForURL(/eligible=1/),
  page.getByRole("button", { name: "Apply" }).click(),
]);
await listed();
const hiddenSelected = await page
  .locator('#compare-form input[type=hidden][name="compare"]')
  .count();
await cards().nth(0).getByLabel("Compare").check();
await Promise.all([
  page.waitForURL((u) => u.searchParams.getAll("compare").length === 3),
  page.getByRole("button", { name: /Compare selected/ }).click(),
]);
await compare.waitFor({ timeout: 15_000 });
ok(
  "11l compare keeps selections hidden by the filter (3 compared)",
  hiddenSelected === 2 && (await compare.locator("thead th").count()) === 4,
  `${hiddenSelected} carried hidden, ${await compare.locator("thead th").count()} header cells`,
);
await listed();
ok(
  "11m with 3 selected the other compare boxes are disabled",
  (await cards().nth(1).locator('input[name="compare"]').isDisabled()) &&
    !(await cards().nth(0).locator('input[name="compare"]').isDisabled()),
);
await compare.getByRole("link", { name: "Clear comparison" }).click();
await page.waitForURL((u) => !u.search.includes("compare"));
await shot("07-matching-results");
// Organization admin in Spanish (flow 6 for the organization role) → dashboard, matches, form
await page.goto(`${BASE}/app/settings`);
await page.waitForLoadState("networkidle");
await page.locator("[role=radio][lang=es]").first().click();
await page.waitForSelector("[role=status]:has-text('Idioma actualizado')", { timeout: 15000 });
await page.goto(`${BASE}/app/organization`);
await page.waitForLoadState("networkidle");
await expectSpanish("11c organization dashboard in Spanish");
await responsiveShots("18-organization-es");
await page.goto(`${madUrl}/matches`);
await page.waitForLoadState("networkidle");
await expectSpanish("11d matching results in Spanish");
const matchesEs = await page.locator("main").innerText();
ok(
  "11e matching logic identical in Spanish (3 elegibles de 10, bloqueos explicados)",
  /3\s*elegibles de\s*10/.test(matchesEs) &&
    /Falta TR-A320/.test(matchesEs) &&
    /no verificada \(verificación pendiente\)/i.test(matchesEs),
  matchesEs.match(/\d+\s*elegibles de\s*\d+ evaluados/)?.[0] ?? matchesEs.slice(0, 120),
);
await responsiveShots("19-matches-es");
await page.goto(`${BASE}/app/organization/requirements/new`);
await page.waitForLoadState("networkidle");
await expectSpanish("11f requirement form in Spanish");
await page.click("main form button[type=submit]");
ok(
  "11g validation messages in Spanish",
  /El título/.test(
    await page
      .locator("#title-error")
      .innerText()
      .catch(() => ""),
  ),
  "",
);
await shot("20-requirement-form-es-validation");
await page.goto(`${BASE}/app/settings`);
await page.waitForLoadState("networkidle");
await page.locator("[role=radio][lang=en]").first().click();
await page.waitForSelector("[role=status]:has-text('Language updated')", { timeout: 15000 });

await page.goto(`${BASE}/app/organization/requirements/new`);
await page.waitForLoadState("networkidle");
await page.fill("#title", "Local UI check · B2 A330");
await page.fill("#location", "Madrid (MAD)");
await page.fill("#headcount", "1");
await page.fill("#startsAt", "2026-12-01T08:00");
await page.fill("#endsAt", "2026-12-03T08:00");
await page.locator("label:has-text('B2')").first().click();
await page.locator("label:has-text('TR-A330')").first().click();
await page.click("main form button[type=submit]");
await page.waitForURL((u) => /\/requirements\/[0-9a-f-]{36}$/.test(u.pathname), { timeout: 30000 });
await page.waitForLoadState("networkidle");
ok(
  "12 create requirement as admin → detail page",
  /Local UI check/.test(await page.locator("main").innerText()),
  page.url(),
);
await shot("08-requirement-created");
// 12b (batch 6, V1.8 job.status): close with a confirmation step; terminal after reload.
await page.getByRole("button", { name: "Close requirement" }).click();
await page.getByRole("button", { name: "Yes, close it" }).click();
await page.getByText("can no longer be reopened").waitFor({ timeout: 15_000 });
await page.reload();
await page.waitForLoadState("networkidle");
const closedText = await page.locator("main").innerText();
ok(
  "12b close requirement: confirmed, status closed after reload, no close button left",
  /no longer be reopened/.test(closedText) &&
    (await page.getByRole("button", { name: "Close requirement" }).count()) === 0,
);
// 12c (batch 9, V1.8 «Vencida»): an open need whose period ended shows «Expired» (derived, not stored)
// and can still be closed.
await page.goto(`${BASE}/app/organization/requirements/new`);
await page.waitForLoadState("networkidle");
await page.fill("#title", "Local UI check · expired");
await page.fill("#location", "Madrid (MAD)");
await page.fill("#headcount", "1");
await page.fill("#startsAt", "2026-01-05T08:00");
await page.fill("#endsAt", "2026-01-06T08:00");
await page.locator("label:has-text('B2')").first().click();
await page.click("main form button[type=submit]");
await page.waitForURL((u) => /\/requirements\/[0-9a-f-]{36}$/.test(u.pathname), { timeout: 30000 });
await page.waitForLoadState("networkidle");
const expiredChip = await page.locator("main").getByText("Expired", { exact: true }).count();
await page.getByRole("button", { name: "Close requirement" }).click();
await page.getByRole("button", { name: "Yes, close it" }).click();
await page.getByText("can no longer be reopened").waitFor({ timeout: 15_000 });
ok(
  "12c expired need: «Expired» shown (derived), still closable → Closed",
  expiredChip === 1 &&
    (await page.locator("main").getByText("Expired", { exact: true }).count()) === 0,
);
await logout();

// 3. Cross-organization: admin.other cannot open the MAD requirement
await login("admin.other@crewflex.test");
expectedErrorUrls.add(madUrl);
await page.goto(madUrl);
await page.waitForLoadState("networkidle");
const foreign = await page.locator("body").innerText();
ok(
  "13 other org admin gets 404 on MAD requirement",
  /not found|404/i.test(foreign) && !/A320 line maintenance/.test(foreign),
  "",
);
await page.goto(`${madUrl}/matches`);
await page.waitForLoadState("networkidle");
ok("13b …and on its matches", /not found|404/i.test(await page.locator("body").innerText()), "");
await shot("09-cross-org-404");
expectedErrorUrls.delete(madUrl);
await logout();

// 4. Manager role can see capacity; plain member cannot
await login("charlie@crewflex.test");
await page.goto(madUrl);
await page.waitForLoadState("networkidle");
const memberView = await page.locator("main").innerText();
ok(
  "14 plain member sees requirement but no capacity analysis",
  /A320 line maintenance/.test(memberView) && /available to managers and admins/i.test(memberView),
  "",
);
await logout();
await login("manager.mro@crewflex.test");
await page.goto(madUrl);
await page.waitForLoadState("networkidle");
ok(
  "15 manager sees capacity analysis",
  /Internal workforce/i.test(await page.locator("main").innerText()),
  "",
);
await logout();

// 6. Remediation 2026-10-15 (docs/audit/CREWFLEX_REMEDIATION_2026_10_15.md)
// 6a. Matching states how complete the external evaluation was (candidate-pool finding)
await login("manager.mro@crewflex.test");
await page.goto(`${madUrl}/matches`);
await page.waitForLoadState("networkidle");
ok(
  "18 matching states the external evaluation is exhaustive (10 of 10)",
  /Every professional in the network who holds at least one required qualification was evaluated \(10\)/.test(
    await page.locator("main").innerText(),
  ),
  "",
);
// 6b. The review queue is not reachable for organization roles (404) and not in their navigation
await page.goto(`${BASE}/app/admin/verifications`);
await page.waitForLoadState("networkidle");
ok(
  "19 manager: /app/admin/verifications is a 404 and has no nav entry",
  /not found/i.test(await page.locator("body").innerText()) &&
    (await page.locator("nav a[href='/app/admin/verifications']").count()) === 0,
  "",
);
await logout();

// 6c. Platform admin verifies Golf's pending B1.1 → matching changes → seed restored
await login("platform.admin@crewflex.test");
ok(
  "20 platform admin sees the Verifications entry",
  (await page.locator("a[href='/app/admin/verifications']").count()) > 0,
  "",
);
await page.goto(`${BASE}/app/admin/verifications`);
await page.waitForLoadState("networkidle");
const golfCard = page
  .locator("li")
  .filter({ hasText: "Technician Golf" })
  .filter({ hasText: "B1.1" });
ok("21 Golf's pending B1.1 is in the queue", (await golfCard.count()) === 1, "");
await responsiveShots("22-verifications");
await golfCard.locator("button[value=rejected]").click();
ok(
  "21b rejecting without a reason is refused before any request",
  /Give a reason to reject/.test(await golfCard.innerText()),
  "",
);
await golfCard.locator("textarea[name=note]").fill("Smoke: checked against the authority register");
await golfCard.locator("button[value=verified]").click();
await page.waitForSelector("[role=status]:has-text('Verified. The qualification now counts')", {
  timeout: 15000,
});
ok("21c verify confirmed only after the server answered", true, "");
await page.reload();
await page.waitForLoadState("networkidle");
ok(
  "21d decision persisted: Golf's B1.1 left the queue and the history shows it",
  (await page
    .locator("li")
    .filter({ hasText: "Technician Golf" })
    .filter({ hasText: "B1.1" })
    .count()) === 0 &&
    /Latest decisions[\s\S]*Verified/i.test(await page.locator("main").innerText()),
  "",
);
await logout();
await login("manager.mro@crewflex.test");
await page.goto(`${madUrl}/matches`);
await page.waitForLoadState("networkidle");
ok(
  "21e matching after verification: 4 eligible of 10",
  /4 eligible of 10 evaluated/.test(await page.locator("main").innerText()),
  "",
);
await logout();
// Restore: re-dating a reviewed qualification sends it back to pending (BR-2.8).
ok("21f seed restored (Golf's B1.1 pending again)", await ensureGolfPending(), "");

// 6d. Passport saved in two tabs: the second save is a conflict, nothing is overwritten (I-3)
await login("foxtrot@crewflex.test");
const tab2 = await ctx.newPage();
await page.goto(`${BASE}/app/professional/profile`);
await tab2.goto(`${BASE}/app/professional/profile`);
await Promise.all([page.waitForLoadState("networkidle"), tab2.waitForLoadState("networkidle")]);
const foxtrotBase = await page.inputValue("#baseLocation");
await page.fill("#baseLocation", "Sevilla (SVQ)");
await page.click("main form button[type=submit]");
await page.waitForSelector("[role=status]:has-text('Passport updated')", { timeout: 15000 });
await tab2.fill("#baseLocation", "Bilbao (BIO)");
await tab2.click("main form button[type=submit]");
await tab2.waitForSelector("[role=alert]:has-text('changed in another window')", {
  timeout: 15000,
});
await page.reload();
await page.waitForLoadState("networkidle");
ok(
  "22 second tab gets a conflict; the first save is kept, the form keeps the user's input",
  (await page.inputValue("#baseLocation")) === "Sevilla (SVQ)" &&
    (await tab2.inputValue("#baseLocation")) === "Bilbao (BIO)",
  "",
);
await tab2.close();
await page.fill("#baseLocation", foxtrotBase);
await page.click("main form button[type=submit]");
await page.waitForSelector("[role=status]:has-text('Passport updated')", { timeout: 15000 });

// 6e. Overview separates profile completeness from verification (8.2); mobile nav shows every item (8.3)
await page.goto(`${BASE}/app/professional`);
await page.waitForLoadState("networkidle");
const overviewText = await page.locator("main").innerText();
ok(
  "23 overview: completeness is labelled as such and verification is shown as 'N of M'",
  /Profile completeness/i.test(overviewText) && /\d+ of \d+/.test(overviewText),
  "",
);
for (const width of [360, 390]) {
  await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(300);
  // 24c (batch 11, V1.8 ≤ 760 px drawer): the menu starts closed and opens on demand.
  const menu = page.getByRole("button", { name: "Menu" });
  const closedFirst =
    (await menu.getAttribute("aria-expanded")) === "false" &&
    !(await page.locator("aside nav a").first().isVisible());
  await menu.click();
  ok(
    `24c nav @${width}: «Menu» starts closed, opens the sections`,
    closedFirst &&
      (await menu.getAttribute("aria-expanded")) === "true" &&
      (await page.locator("aside nav a").first().isVisible()),
  );
  const clipped = await page.evaluate((w) => {
    return [...document.querySelectorAll("aside nav a")]
      .map((a) => ({ text: a.textContent, box: a.getBoundingClientRect() }))
      .filter(({ box }) => box.right > w + 0.5 || box.left < -0.5)
      .map(({ text }) => text);
  }, width);
  ok(
    `24 nav @${width}: every item fully visible (no clipped tab)`,
    clipped.length === 0,
    clipped.join(","),
  );
  const spilling = await page.evaluate(() =>
    [...document.querySelectorAll("main .rounded-xl")]
      .filter((card) => card.scrollWidth > card.clientWidth + 1)
      .map((card) => card.textContent?.slice(0, 40)),
  );
  ok(
    `24b cards @${width}: no content spills out of a card`,
    spilling.length === 0,
    spilling.join(" | "),
  );
  await shot(`23-overview-nav-${width}`);
  await page.locator("aside nav a", { hasText: "Passport" }).click();
  await page.waitForURL(/\/profile/);
  await page.goBack();
  await page.waitForURL(/\/app\/professional$/);
  ok(
    `24d nav @${width}: following a link and going back leaves the menu closed`,
    (await menu.getAttribute("aria-expanded")) === "false",
  );
}
await page.setViewportSize({ width: 1440, height: 900 });
await logout();

// 5b. Public pages: the compact switcher works before sign-in (cookie only) and the login page follows it
await page.goto(`${BASE}/login`);
await page.waitForLoadState("networkidle");
await page.locator("[role=radio][lang=es]").first().click();
await page.waitForTimeout(1500);
await page.reload();
await page.waitForLoadState("networkidle");
ok(
  "16a login page in Spanish before sign-in (cookie)",
  (await page.evaluate(() => document.documentElement.lang)) === "es" &&
    /Iniciar sesión/.test(await page.locator("main").innerText()),
  "",
);
await shot("21-login-es");
await page.locator("[role=radio][lang=en]").first().click();
await page.waitForTimeout(1500);

// 18 (batch 10, V1.8 v12.css min-height 44): on a touch screen every control of the main flows
// is at least 44 px tall (desktop keeps its density).
const touch = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
const tp = await touch.newPage();
await tp.goto(`${BASE}/login`);
await tp.fill("#email", "delta@crewflex.test");
await tp.fill("#password", "crewflex-local-only");
await Promise.all([tp.waitForURL(/\/app/), tp.click("form button[type=submit]")]);
const small = [];
for (const path of [
  "/app/professional",
  "/app/professional/availability",
  "/app/professional/profile",
  "/app/tools/convert",
]) {
  await tp.goto(`${BASE}${path}`);
  await tp.waitForLoadState("networkidle");
  await tp.getByRole("button", { name: "Menu" }).click(); // measure the nav links too
  small.push(
    ...(await tp.evaluate(() =>
      [
        ...document.querySelectorAll(
          "button, select, input:not([type=checkbox]):not([type=radio]):not([type=hidden]), nav a",
        ),
      ]
        .filter((el) => el.offsetParent !== null && el.getBoundingClientRect().height < 43.5)
        .map(
          (el) =>
            `${location.pathname} ${el.tagName} «${(el.textContent || el.getAttribute("name") || "").trim().slice(0, 20)}» ${Math.round(el.getBoundingClientRect().height)}px`,
        ),
    )),
  );
}
ok(
  "25 touch targets ≥ 44 px on a touch screen (overview, availability, passport, converter, nav)",
  small.length === 0,
  small.slice(0, 5).join(" | "),
);
await touch.close();

// 5. Only localhost was used
const nonLocal = [...hosts].filter((h) => !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(h));
ok(
  "16 browser only talked to localhost",
  nonLocal.length === 0,
  nonLocal.join(",") || `${new URL(BASE).host} only`,
);
ok("17 zero console/page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
// Playwright's own `page.evaluate` is an eval in the page and trips the report-only CSP, so the
// instrumented run may only show that message; a fresh, uninstrumented context must show nothing.
ok(
  "17b instrumented run: no CSP violation other than Playwright's own evaluate (T18)",
  cspViolations.every((v) => /Evaluating a string as JavaScript/.test(v)),
  cspViolations
    .filter((v) => !/Evaluating a string as JavaScript/.test(v))
    .slice(0, 3)
    .join(" | "),
);
{
  const clean = [];
  const cctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const cpage = await cctx.newPage();
  cpage.on("console", (m) => {
    if (/Content Security Policy/.test(m.text()))
      clean.push(`${m.text().slice(0, 120)} @ ${cpage.url()}`);
  });
  const visit = async (routes) => {
    for (const r of routes) {
      await cpage.goto(`${BASE}${r}`);
      await cpage.waitForLoadState("networkidle");
    }
  };
  const signIn = async (email) => {
    await cpage.goto(`${BASE}/login`);
    await cpage.fill("#email", email);
    await cpage.fill("#password", PW);
    await cpage.click("button[type=submit]");
    await cpage.waitForURL(/\/app/);
  };
  await visit(["/", "/login", "/register", "/forgot-password", "/reset-password"]);
  await signIn("delta@crewflex.test");
  await visit([
    "/app/professional",
    "/app/professional/profile",
    "/app/professional/qualifications",
    "/app/professional/availability",
    "/app/professional/documents",
    "/app/tools",
    "/app/tools/torque",
    "/app/tools/convert",
    "/app/tools/duration",
    "/app/settings",
    "/app",
  ]);
  await cpage.setViewportSize({ width: 390, height: 800 });
  await visit(["/app/professional", "/app/professional/availability"]);
  await cctx.close();
  const octx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const opage = await octx.newPage();
  opage.on("console", (m) => {
    if (/Content Security Policy/.test(m.text()))
      clean.push(`${m.text().slice(0, 120)} @ ${opage.url()}`);
  });
  await opage.goto(`${BASE}/login`);
  await opage.fill("#email", "admin.mro@crewflex.test");
  await opage.fill("#password", PW);
  await opage.click("button[type=submit]");
  await opage.waitForURL(/\/app/);
  for (const r of [
    "/app/organization",
    "/app/organization/requirements",
    "/app/organization/requirements/new",
    "/app/organization/workforce",
  ]) {
    await opage.goto(`${BASE}${r}`);
    await opage.waitForLoadState("networkidle");
  }
  await opage.goto(`${BASE}/app/organization/requirements`);
  await opage.waitForLoadState("networkidle");
  const detail = await opage
    .locator("main a[href*='/app/organization/requirements/']", {
      hasText: "A320 line maintenance",
    })
    .first()
    .getAttribute("href");
  for (const r of [
    detail,
    `${detail}/matches`,
    `${detail}/matches?page=2&compare=nobody&eligible=1&q=a`,
  ]) {
    await opage.goto(`${BASE}${r}`);
    await opage.waitForLoadState("networkidle");
  }
  await octx.close();
  const actx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const apage = await actx.newPage();
  apage.on("console", (m) => {
    if (/Content Security Policy/.test(m.text()))
      clean.push(`${m.text().slice(0, 120)} @ ${apage.url()}`);
  });
  await apage.goto(`${BASE}/login`);
  await apage.fill("#email", "platform.admin@crewflex.test");
  await apage.fill("#password", PW);
  await apage.click("button[type=submit]");
  await apage.waitForURL(/\/app/);
  await apage.goto(`${BASE}/app/admin/verifications`);
  await apage.waitForLoadState("networkidle");
  await actx.close();
  ok(
    "17c uninstrumented pass over 26 routes (3 roles, 1440 + 390, incl. detail/matches/admin): zero CSP violations (T18)",
    clean.length === 0,
    clean.slice(0, 3).join(" | "),
  );
}
await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\nSUMMARY ${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
