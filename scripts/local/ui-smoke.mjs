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
  /\b(Sign out|Sign in|Requirements|Availability|Qualifications|Workforce|Overview|Settings|Save changes|Declare|Passport|Dashboard|Create account|Not found|Eligible|Blockers|Pending review|Verified|Gap|Coverage|Internal coverage)\b/;
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
let expectOffline = false; // 2h aborts a request on purpose: its console error is the test
let expectBadLink = false; // wallet-extras 3 answers the signed URL with 400 on purpose (expired link)
const isExpected404 = (text, url) =>
  /status of 404/.test(text) && [...expectedErrorUrls].some((u) => url.startsWith(u));
page.on("pageerror", (e) => errors.push(`${String(e)} @ ${page.url()}`));
const cspViolations = [];
page.on("console", (m) => {
  if (/Content Security Policy/.test(m.text())) cspViolations.push(`${m.text()} @ ${page.url()}`);
  if (
    m.type() === "error" &&
    !isExpected404(m.text(), page.url()) &&
    !(expectOffline && /ERR_INTERNET_DISCONNECTED/.test(m.text())) &&
    !(expectBadLink && /status of 400/.test(m.text()))
  )
    errors.push(`${m.text()} @ ${page.url()}`);
});
const hosts = new Set();
page.on("request", (r) => {
  // Chromium's built-in PDF viewer (chrome-extension://…, N-21 blob frame) is not a network host.
  const u = new URL(r.url());
  if (/^https?:$/.test(u.protocol)) hosts.add(u.host);
});
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
  await page.waitForURL(
    (u) => /^\/app\/(professional|organization|admin|recruiter)/.test(u.pathname),
    {
      timeout: 30000,
    },
  );
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
  // The account may be in Spanish at this point (PKG P05 logs out from «Cerrar sesión»).
  const signOut =
    "form:has(button:has-text('Sign out')), form:has(button:has-text('Cerrar sesión'))";
  if (!(await page.locator(signOut).count())) {
    await page.goto(`${BASE}/app`);
    await page.waitForLoadState("networkidle");
  }
  await page
    .locator(signOut)
    .last()
    .evaluate((f) => f.requestSubmit());
  await page.waitForURL((u) => !u.pathname.startsWith("/app"), { timeout: 20000 });
}

const publishableKey = /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=(\S+)/.exec(envLocal)?.[1];
const supabaseUrl = /NEXT_PUBLIC_SUPABASE_URL=(\S+)/.exec(envLocal)?.[1];
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

/** Direct local API call as a seed account (used only to restore seed state after a UI change). */
async function asSeedUser(email, fn, { method = "GET", query = {}, body, headers = {} } = {}) {
  const url = new URL(`/functions/v1/${fn}`, supabaseUrl);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return fetch(url, {
    method,
    headers: { ...(await seedHeaders(email)), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then((r) => r.json());
}

/** Direct local PostgREST call as a seed account (RLS applies): GET without a body, POST with one. */
async function seedRest(email, path, body) {
  return fetch(new URL(`/rest/v1/${path}`, supabaseUrl), {
    method: body === undefined ? "GET" : "POST",
    headers: await seedHeaders(email),
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
  "0 CSP report-only header with a nonce and strict-dynamic (T18); style attributes only React's display:none",
  /script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/.test(cspHeader) &&
    /frame-ancestors 'none'/.test(cspHeader) &&
    /style-src-attr 'unsafe-hashes' 'sha256-aqNNdDLnnrDOnTNdkJpYlAxKVJtLt9CtFLklmInuUAE='(;|$)/.test(
      cspHeader,
    ) &&
    !/unsafe-inline/.test(cspHeader),
  cspHeader.slice(0, 80),
);
// 0b (X-01) landing: «Sign in» was white on white (variant bg-white beat bg-transparent), and the
// compact ES/EN marked the checked option navy on navy. Computed colours, not class names.
await page.goto(`${BASE}/`);
const landing = await page.evaluate(() => {
  const style = (el) => el && getComputedStyle(el);
  const signIn = style(document.querySelector("main a[href='/login']"));
  const checked = style(document.querySelector("[role=radio][aria-checked=true]"));
  return { color: signIn?.color, bg: signIn?.backgroundColor, checkedBg: checked?.backgroundColor };
});
ok(
  "0b landing: «Sign in» white on the navy page, checked ES/EN white",
  landing.color === "rgb(255, 255, 255)" &&
    landing.bg === "rgba(0, 0, 0, 0)" &&
    landing.checkedBg === "rgb(255, 255, 255)",
  JSON.stringify(landing),
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
// Batch 3 (M02, V1.8 TechnicianHome): full status checklist + read-only month calendar. Since PKG
// shell-visual (N-18) the checklist is the «My profile status» dialog of the hero (closed: counted, not shown).
const checklist = page.locator("dialog[aria-labelledby=profile-status-title] li");
const today = new Date().toISOString().slice(0, 10);
// N-03 (PKG calendar): the day is a toggle button whose label also counts its opportunities.
const todayCell = page.locator(`main button[aria-current=date]`);
// T-36 (package passport): the ten v1.8 items; «Document provided» only counts with the wallet on.
const checklistItems = await checklist.count();
ok(
  "2b overview: 10-item checklist (9 without the wallet) with links for the missing ones; today marked in the month",
  [9, 10].includes(checklistItems) &&
    new RegExp(`^${today}: Available\\. `).test((await todayCell.getAttribute("aria-label")) ?? ""),
  `${checklistItems} items · ${await todayCell.getAttribute("aria-label")}`,
);
await page.getByRole("link", { name: "Next month" }).click();
await page.waitForURL(/month=\d{4}-\d{2}/);
const nextMonthDay = await page
  .locator("main ol[aria-label] button[aria-label]")
  .first()
  .getAttribute("aria-label");
ok(
  "2c month navigation by link (next month: no windows → Rest)",
  /: Rest\. /.test(nextMonthDay ?? ""),
  nextMonthDay,
);
// 2e (batch 11, V1.8 hides the progress when complete): the seed completes every item of Delta but
// the wallet document (package passport). Without the wallet: 100 % → no progress, the dialog says it is
// complete; with it: 90 %, and «Document provided» is the only item with a «Complete» link.
if (checklistItems === 9) {
  ok(
    "2e complete profile: no progress bar; the status dialog has no «Complete» link",
    (await page.locator("main progress").count()) === 0 &&
      (await checklist.filter({ has: page.locator("a") }).count()) === 0,
  );
} else {
  const pendingItems = checklist.filter({ has: page.locator("a", { hasText: "Complete" }) });
  ok(
    "2e Delta at 90 %: only «Document provided» is left (wallet on)",
    /Your passport is 90% complete/.test(await page.locator("main").innerText()) &&
      (await pendingItems.count()) === 1 &&
      /Document provided/.test(await pendingItems.first().innerText()),
    `${await pendingItems.count()} pending`,
  );
}
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
// 2h (X-02): the first save fails at the network → alert, page alive, form keeps the draft.
const dropAction = (route) =>
  route.request().method() === "POST" && route.request().headers()["next-action"]
    ? route.abort("internetdisconnected")
    : route.continue();
expectOffline = true;
await page.route("**/app/professional/availability", dropAction);
await page.click("form button[type=submit]:has-text('Add')");
const offlineAlert = await page
  .getByRole("alert")
  .filter({ hasText: "connection was lost" })
  .waitFor({ timeout: 15000 })
  .then(() => true)
  .catch(() => false);
ok(
  "2h save without network: alert, no error page, draft kept",
  offlineAlert &&
    (await page.locator("#startsAt").inputValue()) === "2031-05-10T08:00" &&
    !/could not be displayed/i.test(await page.locator("body").innerText()),
  "",
);
await page.unroute("**/app/professional/availability", dropAction);
expectOffline = false;
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
// N-19 (package wallet-extras): «Archive» moves it to the trash; it is deleted permanently from there.
await row2.getByRole("button", { name: "Archive Smoke expiry check" }).click();
await row2.waitFor({ state: "detached", timeout: 15_000 });
await page.goto(`${BASE}/app/professional/documents?view=trash`);
const trashed = page.locator("main li", { hasText: "Smoke expiry check" });
await trashed.getByRole("button", { name: "Delete permanently" }).click();
await trashed.getByRole("button", { name: "Confirm delete" }).click();
await trashed.waitFor({ state: "detached", timeout: 15_000 });
await page.goto(`${BASE}/app/professional/availability`); // back to where the next step continues
await page.waitForLoadState("networkidle");
await page
  .locator("li:has(button:has-text('Delete'))")
  .filter({ hasText: "2031" })
  .first()
  .locator("button:has-text('Delete')")
  .click();
await page.getByRole("button", { name: "Yes, delete it" }).click(); // W1-10 asks first
await page.waitForTimeout(2500);
after = await page.locator("li:has(button:has-text('Delete'))").filter({ hasText: "2031" }).count();
ok("5 delete window", after === 0, `${after} rows with 2031 left`);
// X-08: the row is gone; focus lands on the outcome notice, not <body>
ok(
  "5b focus after confirming a delete is on the notice",
  await page.evaluate(() => document.activeElement?.getAttribute("role") === "status"),
  "",
);

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
await page.getByRole("button", { name: "Yes, remove it" }).click(); // W1-10 asks first
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
// 9b (X-04): a page past the end lands on the last page (was PostgREST 416 → «Server error»)
await page.goto(`${BASE}/app/organization/requirements?page=999`);
await page.waitForLoadState("networkidle");
ok(
  "9b ?page=999 redirects to the last page",
  /[?&]page=\d+$/.test(page.url()) &&
    !page.url().endsWith("page=999") &&
    /A320 line maintenance|Previous/.test(await page.locator("main").innerText()),
  page.url(),
);
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
await page.goto(`${madUrl}/matches?eligible=0`); // v2-25: «Solo elegibles» is on by default
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
await page.getByRole("checkbox", { name: "Eligible only" }).check();
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
await page.goto(`${madUrl}/matches?eligible=0`); // v2-25: «Solo elegibles» is on by default
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
await page.goto(`${madUrl}/matches?eligible=0&q=${firstRef?.toLowerCase()}`);
await listed();
ok(
  "11j search by pseudonym (case-insensitive) finds exactly it",
  (await cards().count()) === 1,
  firstRef,
);
await page.goto(`${madUrl}/matches?eligible=0`); // v2-25: «Solo elegibles» is on by default
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
await page.getByRole("checkbox", { name: "Eligible only" }).check();
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
await page.goto(`${madUrl}/matches?eligible=0`); // v2-25: «Solo elegibles» is on by default
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
// and can still be closed. The form refuses a past start since W5-01, so the need is created through
// the local API as admin.mro (the database lets an open need end; only the input rule is new).
const [[madOrg], [b2Type]] = await Promise.all([
  seedRest("admin.mro@crewflex.test", "organizations?select=id&name=eq.Demo%20MRO%20Madrid"),
  seedRest("admin.mro@crewflex.test", "qualification_types?select=id&code=eq.B2"),
]);
const expiredId = await seedRest("admin.mro@crewflex.test", "rpc/create_work_requirement", {
  p_organization_id: madOrg.id,
  p_title: "Local UI check · expired",
  p_location: "Madrid (MAD)",
  p_starts_at: "2026-01-05T08:00:00Z",
  p_ends_at: "2026-01-06T08:00:00Z",
  p_shift: "day",
  p_headcount: 1,
  p_urgency: "planned",
  p_qualifications: [{ qualification_type_id: b2Type.id, requirement_level: "hard" }],
});
await page.goto(`${BASE}/app/organization/requirements/${expiredId}`);
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
expectedErrorUrls.add(`${BASE}/app/admin/verifications`); // a real HTTP 404 since X-11
await page.goto(`${BASE}/app/admin/verifications`);
await page.waitForLoadState("networkidle");
ok(
  "19 manager: /app/admin/verifications is a 404 and has no nav entry",
  /not found/i.test(await page.locator("body").innerText()) &&
    (await page.locator("nav a[href='/app/admin/verifications']").count()) === 0,
  "",
);
// The «View as» switcher and its admin-only views are not there for organization roles
const managerNoViews = (await page.getByRole("navigation", { name: "View as" }).count()) === 0;
// X-11: a real HTTP 404 with a neutral title (was 200 after the /app loading boundary streamed)
const denied = [];
for (const path of ["/app/admin", "/app/recruiter", "/app/admin/verifications"]) {
  expectedErrorUrls.add(`${BASE}${path}`);
  const response = await page.goto(`${BASE}${path}`);
  denied.push({
    path,
    status: response?.status(),
    title: await page.title(),
    notFound: /not found/i.test(await page.locator("body").innerText()),
  });
}
ok(
  "19b manager: no view switcher; admin, recruiter and verifications are HTTP 404, neutral title",
  managerNoViews && denied.every((d) => d.status === 404 && d.notFound && d.title === "CrewFlex"),
  JSON.stringify(denied),
);
await logout();

// 6c. Platform admin verifies Golf's pending B1.1 → matching changes → seed restored
await login("platform.admin@crewflex.test");
const viewSwitcher = page.getByRole("navigation", { name: "View as" });
ok(
  "20a platform admin lands on Administration with the four-view switcher (v1.8 «Probar como»)",
  new URL(page.url()).pathname === "/app/admin" &&
    (await viewSwitcher.locator("a").allInnerTexts()).join("|") ===
      "Technician|Company|Recruiter|Administration" &&
    (await viewSwitcher.locator("a[aria-current]").innerText()) === "Administration",
  page.url(),
);
ok(
  "20 platform admin sees the Verifications entry",
  (await page.locator("a[href='/app/admin/verifications']").count()) > 0,
  "",
);
// 20e (X-03): on a short desktop the sidebar scrolls inside the screen; the footer stays visible.
await page.setViewportSize({ width: 1280, height: 600 });
await page.goto(`${BASE}/app/tools`);
await page.waitForLoadState("networkidle");
const sidebar = await page.evaluate(() => {
  const aside = document.querySelector("aside");
  const nav = aside.querySelector("div[id]");
  nav.scrollTop = nav.scrollHeight;
  const last = [...aside.querySelectorAll("a")].at(-1).getBoundingClientRect().bottom;
  const footer = [...aside.querySelectorAll("form button")].at(-1).getBoundingClientRect().bottom;
  return { last, footer, scrolls: nav.scrollHeight > nav.clientHeight, vh: innerHeight };
});
ok(
  "20e sidebar at 1280×600: menu scrolls, last entry and footer sign-out on screen",
  sidebar.scrolls && sidebar.last <= sidebar.vh && sidebar.footer <= sidebar.vh,
  JSON.stringify(sidebar),
);
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${BASE}/app/admin`);
await page.waitForLoadState("networkidle");
await viewSwitcher.locator("a[href='/app/recruiter']").click();
await page.waitForURL(/\/app\/recruiter$/);
// The /app loading skeleton shows until the RSC payload streams in: wait for the text itself.
ok(
  "20b Recruiter view shows the admin's own account: no staffing agency membership, a note says so (PKG recruiter)",
  await page
    .locator("main")
    .getByText("Your account does not belong to a staffing agency")
    .waitFor({ timeout: 15000 })
    .then(() => true)
    .catch(() => false),
  "",
);
await viewSwitcher.locator("a[href='/app/organization']").click();
await page.waitForURL(/\/app\/organization$/);
await page.waitForLoadState("networkidle");
// The section label is uppercased by CSS, and innerText follows text-transform.
ok(
  "20c Company view is the admin's own organization",
  /CrewFlex Operaciones/i.test(await page.locator("aside").innerText()) &&
    (await viewSwitcher.locator("a[aria-current]").innerText()) === "Company" &&
    // v1.8 swaps the menu with the role: the professional section is gone in this view
    (await page.locator("aside a[href='/app/organization/requirements']").count()) === 1 &&
    (await page.locator("aside a[href='/app/professional/profile']").count()) === 0,
  "",
);
// PKG shell-visual (T-147): a real HTTP 404 now (the proxy decides before the stream), as 13/13b.
expectedErrorUrls.add(madUrl);
const madAsAdmin = await page.goto(madUrl);
ok(
  "20d Company view: another organization's requirement is a 404, even for a platform admin",
  /not found/i.test(await page.locator("body").innerText()) && madAsAdmin?.status() === 404,
  `${madUrl} ${madAsAdmin?.status()}`,
);
expectedErrorUrls.delete(madUrl);
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
  "21b rejecting without a reason is refused before any request (T-170: evidence or reason for every decision)",
  /Give the evidence or the reason of the review/.test(await golfCard.innerText()),
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

// 28 (area-40 v2 backlog L-1…L-4, T-3): the learning tools render and take one interaction each;
// nothing leaves localhost (the external translator link is checked, never followed).
await page.goto(`${BASE}/app/tools`);
await page.waitForLoadState("networkidle");
ok(
  "28a tools home: v1.8 tile order with the learning tools (fuel still out, D-11)",
  (await page.locator("main section:not([aria-labelledby]) h2").allInnerTexts()).join("|") ===
    "Daily challenge|Translator|Torque|Conversions|English and acronyms|Duration",
);
await page.goto(`${BASE}/app/tools/knowledge`);
await page.waitForLoadState("networkidle");
const knowledgeSearch = page.getByRole("searchbox", { name: "Search term, acronym or ATA" });
await knowledgeSearch.fill(" amm ");
await page.getByRole("button", { name: /^AMM/ }).first().click();
const knowledgeText = await page.locator("main").innerText();
ok(
  "28b English and acronyms: 102 entries, accent/space-free search, entry with «Copy entry»",
  /102 entries · 46 reference chapters/.test(knowledgeText) &&
    /Aircraft Maintenance Manual/.test(knowledgeText) &&
    (await page.getByRole("button", { name: "Copy entry" }).isVisible()),
);
await page.getByRole("button", { name: "ATA index" }).click();
await knowledgeSearch.fill("hidraulica");
ok(
  "28c ATA index ignores accents: «hidraulica» → 29 Energía hidráulica",
  (await page.locator("main ul[lang=es] li").allInnerTexts())
    .map((x) => x.replace(/\s+/g, " ").trim())
    .join("|") === "29 Energía hidráulica",
);
await page.goto(`${BASE}/app/tools/translator`);
await page.waitForLoadState("networkidle");
await page.fill("#translator-text", "torque");
await page.getByText("Translate free text with Google Translate").click();
const externalLink = page.locator("main a[href^='https://translate.google.com/']");
const linkBeforeConsent = await externalLink.count();
await page.getByLabel("I want to send this text to Google to translate it.").check();
ok(
  "28d translator: «torque» → «Par de apriete»; the external link only after the consent tick",
  /Par de apriete/.test(await page.locator("main [aria-live]").first().innerText()) &&
    linkBeforeConsent === 0 &&
    (await externalLink.getAttribute("href")) ===
      "https://translate.google.com/?sl=en&tl=es&text=torque&op=translate",
);
await page.goto(`${BASE}/app/tools/daily`);
await page.waitForLoadState("networkidle");
await page.getByRole("button", { name: "Start today's challenge" }).click();
await page.locator("main [role=group][aria-label=Answers] button").first().click();
await page.getByRole("button", { name: "Confirm answer" }).click();
const learningKeys = await page.evaluate(() =>
  Object.keys(localStorage).filter((k) => k.startsWith("crewflex-learning-")),
);
ok(
  "28e daily challenge: start, answer, explanation, progress stored under the user's id",
  /Question 2 of 5/.test(await page.locator("main").innerText()) &&
    /Previous answer correct|Review of the previous answer/.test(
      (await page.locator("main [role=status]").allInnerTexts()).join(" "),
    ) &&
    learningKeys.length === 1 &&
    /^crewflex-learning-[0-9a-f-]{36}$/.test(learningKeys[0]),
  learningKeys.join(","),
);
// T-3: the «▸/▾» drawn by `summary.flex::before` stays out of the accessible name (Chromium AX tree).
const axSession = await ctx.newCDPSession(page);
const disclosureNames = async () =>
  (await axSession.send("Accessibility.getFullAXTree")).nodes
    .filter((n) => n.role?.value === "DisclosureTriangle")
    .map((n) => n.name?.value ?? "");
await page.goto(`${BASE}/app/tools/convert`);
await page.waitForLoadState("networkidle");
const summaryNames = await disclosureNames();
await page.goto(`${BASE}/app/professional`);
await page.waitForLoadState("networkidle");
summaryNames.push(...(await disclosureNames()));
await axSession.detach();
// PKG shell-visual: «The N profile items» left Mi espacio for the «My profile status» dialog (N-18).
ok(
  "28f summaries named «Formula, sources and scope» (and any on Mi espacio), without ▸ or ▾ (T-3)",
  summaryNames.includes("Formula, sources and scope") && !summaryNames.some((n) => /[▸▾]/.test(n)),
  summaryNames.join(" | "),
);
ok(
  "28g Mi espacio: «Learning achievements» with the medals and the no-authority notice",
  await page
    .locator("main section", { hasText: "Learning achievements" })
    .getByText("grant no signing authority", { exact: false })
    .isVisible(),
);

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

// 26 (M07/M08, owner 2026-10-22): the hiring journey in the browser, both sides. The need is created
// and Delta's availability added through the local API (setup only); every step after that is a click.
const hiringTitle = `Local UI check · hiring ${Date.now()}`;
const [mroOrg] = await seedRest(
  "admin.mro@crewflex.test",
  "organizations?select=id&name=eq.Demo%20MRO%20Madrid",
);
const hiringTypes = await seedRest(
  "admin.mro@crewflex.test",
  "qualification_types?select=id&code=in.(B1.1,TR-A320)",
);
const hiringCreated = await asSeedUser("admin.mro@crewflex.test", "work-requirements", {
  method: "POST",
  headers: { "Idempotency-Key": crypto.randomUUID() },
  body: {
    organizationId: mroOrg.id,
    title: hiringTitle,
    location: "Madrid (MAD)",
    startsAt: "2026-12-07T06:00:00.000Z",
    endsAt: "2026-12-08T18:00:00.000Z",
    shift: "day",
    headcount: 1,
    urgency: "planned",
    qualifications: hiringTypes.map((q) => ({ qualificationTypeId: q.id, level: "hard" })),
  },
});
const hiringId = hiringCreated.data.requirement.id;
const deltaWindow = await asSeedUser("delta@crewflex.test", "professional-availability", {
  method: "POST",
  headers: { "Idempotency-Key": crypto.randomUUID() },
  body: {
    startsAt: "2026-12-07T00:00:00.000Z",
    endsAt: "2026-12-09T00:00:00.000Z",
    status: "available",
  },
});
await login("delta@crewflex.test");
await page.goto(
  `${BASE}/app/professional/opportunities?eligible=1&q=${encodeURIComponent(hiringTitle)}`,
);
await page.waitForLoadState("networkidle");
ok(
  "26a technician: the published need is listed as compatible, with the organization's name",
  /You meet the requirements and availability/.test(await page.locator("main").innerText()) &&
    /Demo MRO Madrid/.test(await page.locator("main").innerText()),
  "",
);
await page.locator("main a", { hasText: hiringTitle }).first().click();
await page.waitForURL(/\/app\/professional\/opportunities\/[0-9a-f-]{36}$/);
await page.getByRole("checkbox", { name: /I authorise sharing this data/ }).check();
await page.getByRole("button", { name: "Apply" }).click();
ok(
  "26b technician applies with the explicit consent",
  await page
    .getByRole("status")
    .filter({ hasText: "Application sent" })
    .waitFor({ timeout: 15000 })
    .then(() => true)
    .catch(() => false),
  "",
);
await logout();
await login("admin.mro@crewflex.test");
await page.goto(`${BASE}/app/organization/requirements/${hiringId}/applications`);
await page.waitForLoadState("networkidle");
const orgStep = async (button, confirm) => {
  await page.getByRole("button", { name: button }).first().click();
  if (confirm) await page.getByRole("group").getByRole("button", { name: confirm }).click();
  await page.getByRole("status").filter({ hasText: "Done" }).first().waitFor({ timeout: 15000 });
  await page.reload();
  await page.waitForLoadState("networkidle");
};
await orgStep("Shortlist");
await orgStep("Send proposal", "Send proposal");
ok(
  "26c organization shortlists and sends proposal v1 (the applicant is a pseudonym)",
  /Proposal · version 1/.test(await page.locator("main").innerText()) &&
    /CF-/.test(await page.locator("main").innerText()),
  "",
);
await logout();
await login("delta@crewflex.test");
await page.goto(`${BASE}/app/professional/applications`);
await page.waitForLoadState("networkidle");
const mineCard = page.locator("article", { hasText: hiringTitle });
await mineCard.getByRole("button", { name: "Accept proposal" }).click();
const acceptButton = mineCard.getByRole("group").getByRole("button", { name: "Accept proposal" });
const disabledBeforeTick = await acceptButton.isDisabled();
await mineCard
  .getByRole("checkbox", { name: /I accept exactly these terms \(version 1\)/ })
  .check();
await acceptButton.click();
await page.getByRole("status").filter({ hasText: "Done" }).first().waitFor({ timeout: 15000 });
ok("26d technician accepts version 1 only after ticking it (R-08)", disabledBeforeTick, "");
await logout();
await login("admin.mro@crewflex.test");
await page.goto(`${BASE}/app/organization/requirements/${hiringId}/applications`);
await page.waitForLoadState("networkidle");
await orgStep("Confirm assignment", "Confirm assignment");
ok(
  "26e organization confirms: the server re-checks and the need is covered (headcount 1)",
  /Confirmed/.test(await page.locator("main article").first().innerText()) &&
    /Covered/.test(await page.locator("main").innerText()),
  "",
);
await logout();
await login("delta@crewflex.test");
await page.goto(`${BASE}/app/professional/availability?month=2026-12`);
await page.waitForLoadState("networkidle");
ok(
  "26f the confirmed assignment is marked on its days in the calendar",
  (await page.locator("button[aria-label*='confirmed assignment']").count()) >= 2,
  "",
);
await page.goto(`${BASE}/app/professional/applications`);
await page.waitForLoadState("networkidle");
await mineCard.getByRole("button", { name: "Cancel assignment" }).click();
await mineCard.getByRole("textbox").fill("Local UI check: cancelled by the technician");
await mineCard.getByRole("group").getByRole("button", { name: "Cancel assignment" }).click();
await page.getByRole("status").filter({ hasText: "Done" }).first().waitFor({ timeout: 15000 });
await page.reload();
await page.waitForLoadState("networkidle");
ok(
  "26g technician cancels the confirmed assignment with a reason (Q3), visible on the card",
  /Cancelled/.test(await mineCard.innerText()) &&
    /cancelled by the technician/.test(await mineCard.innerText()),
  "",
);
await logout();
await asSeedUser("delta@crewflex.test", "professional-availability", {
  method: "DELETE",
  query: { id: deltaWindow.data.window.id },
});
// 27 (M05 edit, owner 2026-10-22): a need with applications cannot be edited; one without can.
await login("admin.mro@crewflex.test");
await page.goto(`${BASE}/app/organization/requirements/${hiringId}/edit`);
await page.waitForLoadState("networkidle");
const editRefused = /already received applications/.test(await page.locator("main").innerText());
const editable = await asSeedUser("admin.mro@crewflex.test", "work-requirements", {
  method: "POST",
  headers: { "Idempotency-Key": crypto.randomUUID() },
  body: {
    organizationId: mroOrg.id,
    title: "Local UI check · edit me",
    location: "Madrid (MAD)",
    startsAt: "2026-12-14T06:00:00.000Z",
    endsAt: "2026-12-15T18:00:00.000Z",
    shift: "day",
    headcount: 1,
    urgency: "planned",
    qualifications: hiringTypes.map((q) => ({ qualificationTypeId: q.id, level: "hard" })),
  },
});
const editableId = editable.data.requirement.id;
await page.goto(`${BASE}/app/organization/requirements/${editableId}`);
await page.waitForLoadState("networkidle");
await page.getByRole("link", { name: "Edit requirement" }).click();
await page.waitForURL(/\/edit$/);
await page.fill("#title", "Local UI check · edited");
await page.fill("#headcount", "2");
await page.getByRole("button", { name: "Save changes" }).click();
await page.waitForURL((u) => u.pathname === `/app/organization/requirements/${editableId}`, {
  timeout: 30000,
});
await page.waitForLoadState("networkidle");
ok(
  "27 edit: refused with applications; without them the form saves (title, headcount)",
  editRefused && /Local UI check · edited/.test(await page.locator("main").innerText()),
  JSON.stringify({ editRefused, url: page.url() }),
);
await logout();
await asSeedUser("admin.mro@crewflex.test", "work-requirements", {
  method: "PATCH",
  body: { id: editableId, status: "closed" },
});
await asSeedUser("admin.mro@crewflex.test", "work-requirements", {
  method: "PATCH",
  body: { id: hiringId, status: "closed" },
});

// PKG calendar (N-03/N-04/N-17/N-22, owner DEFAULTS 2026-10-22): a confirmed assignment protects its days
// in the calendar and on the server (BR-4.9, T-15/T-16) and shows as «Assigned» in «My space», whose days
// filter «Opportunities for you»; a need that only misses rest days is «Possible on a rest day» (BR-14.1).
// Everything it creates is restored at the end (assignment cancelled, window deleted, needs closed).
const calSuffix = Date.now();
const calNeedBody = (title, startsAt, endsAt) => ({
  organizationId: mroOrg.id,
  title,
  location: "Madrid (MAD)",
  startsAt,
  endsAt,
  shift: "day",
  headcount: 2, // stays open (listed) after one confirmation
  urgency: "planned",
  qualifications: hiringTypes.map((q) => ({ qualificationTypeId: q.id, level: "hard" })),
});
const calKey = () => ({ "Idempotency-Key": crypto.randomUUID() });
const calTitle = `Local UI check · calendar ${calSuffix}`;
const calRestTitle = `Local UI check · rest day ${calSuffix}`;
const calNeed = await asSeedUser("admin.mro@crewflex.test", "work-requirements", {
  method: "POST",
  headers: calKey(),
  body: calNeedBody(calTitle, "2026-12-21T06:00:00.000Z", "2026-12-22T18:00:00.000Z"),
});
const calRestNeed = await asSeedUser("admin.mro@crewflex.test", "work-requirements", {
  method: "POST",
  headers: calKey(),
  body: calNeedBody(calRestTitle, "2026-12-28T06:00:00.000Z", "2026-12-29T18:00:00.000Z"),
});
const calWindow = await asSeedUser("delta@crewflex.test", "professional-availability", {
  method: "POST",
  headers: calKey(),
  body: {
    startsAt: "2026-12-21T00:00:00.000Z",
    endsAt: "2026-12-23T00:00:00.000Z",
    status: "available",
  },
});
const calApplied = await asSeedUser("delta@crewflex.test", "applications", {
  method: "POST",
  headers: calKey(),
  body: { requirementId: calNeed.data?.requirement.id, shareConsent: true },
});
const calApp = {
  id: calApplied.data?.application.id,
  updatedAt: calApplied.data?.application.updatedAt,
};
const calMove = async (email, to, extra = {}) => {
  const res = await asSeedUser(email, "applications", {
    method: "PATCH",
    headers: calKey(),
    body: { applicationId: calApp.id, to, expectedUpdatedAt: calApp.updatedAt, ...extra },
  });
  if (res.data) calApp.updatedAt = res.data.transition.updatedAt;
  return res;
};
await calMove("admin.mro@crewflex.test", "shortlisted");
const calProposed = await calMove("admin.mro@crewflex.test", "proposed");
await calMove("delta@crewflex.test", "accepted", {
  proposalId: calProposed.data?.transition.proposalId,
  acceptTerms: true,
});
const calConfirmed = await calMove("admin.mro@crewflex.test", "confirmed");
ok(
  "pc1 setup (API): delta's application to the calendar need is confirmed",
  calConfirmed.data?.transition.status === "confirmed",
  JSON.stringify(calConfirmed.error ?? ""),
);
const calPut = await asSeedUser("delta@crewflex.test", "professional-availability", {
  method: "PUT",
  headers: calKey(),
  body: { days: [{ date: "2026-12-21", status: null }] },
});
const calDelete = await asSeedUser("delta@crewflex.test", "professional-availability", {
  method: "DELETE",
  query: { id: calWindow.data?.window.id },
});
ok(
  "pc2 N-04 server: a calendar save on an assigned day and deleting its window → 409 ASSIGNMENT_PROTECTED",
  [calPut, calDelete].every(
    (r) => r.error?.code === "CONFLICT" && r.error?.reason === "ASSIGNMENT_PROTECTED",
  ),
  JSON.stringify([calPut.error, calDelete.error]),
);
await login("delta@crewflex.test");
await page.goto(`${BASE}/app/professional/availability?month=2026-12`);
await page.waitForLoadState("networkidle");
const calCell = page.locator("main button[aria-label^='2026-12-21:']");
const calCellLabel = (await calCell.getAttribute("aria-label")) ?? "";
ok(
  "pc3 N-04 calendar: the assigned day is disabled and says why; the legend names the mark",
  (await calCell.isDisabled()) &&
    /confirmed assignment\. A confirmed assignment is protected\./.test(calCellLabel) &&
    /Dates with a confirmed assignment are protected on the server too/.test(
      await page.locator("main").innerText(),
    ),
  calCellLabel,
);
await page.getByRole("checkbox", { name: "Also replace days I already saved this month" }).check();
await page.getByRole("button", { name: "Preview the cycle in this month" }).click();
const calDrafted = await page.locator("main button[aria-label*='not saved']").count();
const calAfterPreview = (await calCell.getAttribute("aria-label")) ?? "";
ok(
  "pc4 N-04 generator: «replace» drafts the month but never the assigned days",
  calDrafted > 0 && !/not saved/.test(calAfterPreview),
  `${calDrafted} drafted · ${calAfterPreview}`,
);
await page.getByRole("button", { name: "Discard changes" }).click();
await page.goto(`${BASE}/app/professional?month=2026-12`);
await page.waitForLoadState("networkidle");
const miniDay = (date) => page.locator(`main ol[aria-label] button[aria-label^='${date}:']`);
const miniAssigned = (await miniDay("2026-12-21").getAttribute("aria-label")) ?? "";
const miniRest = (await miniDay("2026-12-28").getAttribute("aria-label")) ?? "";
const miniLegend = await page.locator("main ul:has(> li > span.size-3)").innerText();
ok(
  "pc5 N-03/N-17 mini calendar: «Assigned», dots counted, rest-day hint, legend with both",
  /^2026-12-21: Assigned\. \d+ opportunit/.test(miniAssigned) &&
    /possible opportunit.*review your rest-day publishing$/.test(miniRest) &&
    /Assigned/.test(miniLegend) &&
    /Opportunities/.test(miniLegend),
  `${miniAssigned} · ${miniRest}`,
);
await miniDay("2026-12-21").click();
const calPressed = await miniDay("2026-12-21").getAttribute("aria-pressed");
const calDayHeading = await page
  .getByRole("heading", { name: /^Opportunities · / })
  .isVisible()
  .catch(() => false);
const calOffer = await page.getByRole("link", { name: `View offer · ${calTitle}` }).count();
ok(
  "pc6 N-03/N-22 a day filters the feed: pressed, «Opportunities · {day}», row with base, licence and «View offer»",
  calPressed === "true" &&
    calDayHeading &&
    calOffer === 1 &&
    /Madrid \(MAD\) · B1\.1/.test(await page.locator("main").innerText()),
  `${calPressed} · ${calDayHeading} · ${calOffer}`,
);
await miniDay("2026-12-28").click();
const calReview = page.getByRole("link", { name: `Review dates · ${calRestTitle}` });
ok(
  "pc7 N-17 a rest day lists the possible need with «Review dates» → that month's calendar",
  (await calReview.getAttribute("href")) === "/app/professional/availability?month=2026-12" &&
    /Possible on a rest day: review and publish your dates/.test(
      await page.locator("main").innerText(),
    ),
  (await calReview.getAttribute("href")) ?? "",
);
await page.getByRole("button", { name: "Clear date selection" }).click();
const calCleared = await page
  .getByRole("heading", { name: "Opportunities for you" })
  .isVisible()
  .catch(() => false);
const calFocus = await page.evaluate(() => document.activeElement?.id ?? "");
ok(
  "pc8 «Clear date selection» restores the feed and returns the focus to the day",
  calCleared && calFocus === "mini-day-2026-12-28",
  `${calCleared} · ${calFocus}`,
);
ok(
  "pc9 N-22 «My applications»: one «Follow up» per row, to its card",
  (await page.getByRole("link", { name: `Follow up · ${calTitle}` }).getAttribute("href")) ===
    `/app/professional/applications#a-${calApp.id}`,
  "",
);
await logout();
await calMove("delta@crewflex.test", "cancelled", { reason: "Local UI check: calendar restore" });
const calDeleted = await asSeedUser("delta@crewflex.test", "professional-availability", {
  method: "DELETE",
  query: { id: calWindow.data?.window.id },
});
for (const need of [calNeed, calRestNeed])
  await asSeedUser("admin.mro@crewflex.test", "work-requirements", {
    method: "PATCH",
    body: { id: need.data?.requirement.id, status: "closed" },
  });
ok(
  "pc10 restore: once cancelled the window can go; both needs closed",
  calDeleted.data?.deleted === true,
  JSON.stringify(calDeleted.error ?? ""),
);

// PKG logbook — N-12 personal logbook (M14, BR-17): nav order, future date refused, create (the form
// empties), hours in the locale's format, selection flag, inline edit, archive → archive view → restore,
// delete; an organization admin of a member's org reads nothing. Restores: the smoke entry is deleted.
{
  const LB = "/app/professional/logbook";
  const AIRCRAFT = "A320 EC-QAA (smoke)";
  const madrid = (offsetDays) =>
    new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(
      new Date(Date.now() + offsetDays * 86_400_000),
    );
  const cleanup = async () => {
    for (const view of ["active", "archived"]) {
      const list = await asSeedUser("delta@crewflex.test", "professional-logbook", {
        query: { view },
      });
      for (const e of list.data?.entries ?? []) {
        if (e.aircraft === AIRCRAFT)
          await asSeedUser("delta@crewflex.test", "professional-logbook", {
            method: "DELETE",
            query: { id: e.id },
          });
      }
    }
  };
  await cleanup(); // an interrupted earlier run
  await login("delta@crewflex.test");
  await page.goto(`${BASE}${LB}`);
  await page.waitForLoadState("networkidle");
  const hrefs = await page.$$eval("nav a", (as) => as.map((a) => a.getAttribute("href")));
  const at = (h) => hrefs.indexOf(h);
  ok(
    "PKG logbook: nav entry after Mis candidaturas / Documents and before Tools; page heading",
    at(LB) > at("/app/professional/applications") &&
      at(LB) > at("/app/professional/documents") &&
      at(LB) < at("/app/tools") &&
      /Personal logbook/.test(await page.locator("h1").innerText()),
    hrefs.join(" "),
  );
  await page.fill("#entryDate", madrid(2));
  await page.fill("#aircraft", AIRCRAFT);
  await page.fill("#hours", "3.5");
  await page.fill("#description", "Local UI check · main wheel replaced.");
  await page.getByRole("button", { name: "Save entry" }).click();
  ok(
    "PKG logbook: a future date is refused («not future work»)",
    /not future work/.test(
      await page
        .locator("#entryDate-error")
        .innerText()
        .catch(() => ""),
    ),
    "",
  );
  await page.fill("#entryDate", madrid(0));
  await page.fill("#ata", "32");
  await page.selectOption("#category", "component_replacement");
  await page.getByRole("button", { name: "Save entry" }).click();
  await page.waitForSelector("[role=status]:has-text('Entry saved')", { timeout: 15000 });
  const row = page.locator("main li", { hasText: AIRCRAFT });
  ok(
    "PKG logbook: saved entry listed («aircraft · category», ATA · hours · environment, self-declared); form emptied",
    (await row.count()) === 1 &&
      /A320 EC-QAA \(smoke\) · Component Replacement/.test(await row.innerText()) &&
      /ATA 32 · 3\.5 h · Line Maintenance/.test(await row.innerText()) &&
      /Self-declared/.test(await row.innerText()) &&
      (await page.inputValue("#aircraft")) === "",
    (await row.innerText().catch(() => "no row")).replace(/\s+/g, " ").slice(0, 160),
  );
  await responsiveShots("pkg-logbook");
  const orgView = await asSeedUser("admin.mro@crewflex.test", "professional-logbook");
  const orgRest = await seedRest("admin.mro@crewflex.test", "logbook_entries?select=id");
  ok(
    "PKG logbook: owner only — an organization admin reads no entry (function and PostgREST)",
    Array.isArray(orgView.data?.entries) &&
      orgView.data.entries.length === 0 &&
      Array.isArray(orgRest) &&
      orgRest.length === 0,
    JSON.stringify(orgView).slice(0, 80),
  );
  await row.getByLabel("Selectable for the Candidate Pack").check();
  await page.waitForSelector("[role=status]:has-text('Logbook updated')", { timeout: 15000 });
  await page.reload();
  await page.waitForLoadState("networkidle");
  ok(
    "PKG logbook: «Selectable for the Candidate Pack» persists after reload",
    await row.getByLabel("Selectable for the Candidate Pack").isChecked(),
    "",
  );
  await row.getByRole("button", { name: "Edit" }).click();
  await page.fill("#edit-hours", "2");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForSelector("[role=status]:has-text('Logbook updated')", { timeout: 15000 });
  await row
    .filter({ hasText: "ATA 32 · 2 h ·" })
    .waitFor({ timeout: 15000 })
    .catch(() => {});
  ok(
    "PKG logbook: inline edit saves (2 h)",
    /ATA 32 · 2 h ·/.test(await row.innerText()),
    (await row.innerText()).replace(/\s+/g, " ").slice(0, 120),
  );
  await row.getByRole("button", { name: "Archive" }).click();
  await page.waitForSelector("[role=status]:has-text('Logbook updated')", { timeout: 15000 });
  await page.waitForFunction(
    (a) => !document.querySelector("main")?.innerText.includes(a),
    AIRCRAFT,
  );
  await page.getByRole("link", { name: "View archive" }).click();
  await page.waitForURL(/view=archived/);
  await page.waitForLoadState("networkidle");
  ok(
    "PKG logbook: archived entry is in «Archived entries», not in the history",
    /Archived entries/.test(await page.locator("main").innerText()) && (await row.count()) === 1,
    "",
  );
  await row.getByRole("button", { name: "Restore" }).click();
  await page.waitForSelector("[role=status]:has-text('Logbook updated')", { timeout: 15000 });
  await page.getByRole("link", { name: "View active" }).click();
  await page.waitForURL((u) => u.pathname === LB && !u.search.includes("archived"));
  await page.waitForLoadState("networkidle");
  ok("PKG logbook: restored entry is back in the history", (await row.count()) === 1, "");
  await row.getByRole("button", { name: "Archive" }).click();
  await page.waitForSelector("[role=status]:has-text('Logbook updated')", { timeout: 15000 });
  await page.goto(`${BASE}${LB}?view=archived`);
  await page.waitForLoadState("networkidle");
  await row.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await page.waitForSelector("[role=status]:has-text('Entry deleted')", { timeout: 15000 });
  await page.reload();
  await page.waitForLoadState("networkidle");
  ok("PKG logbook: deleted entry is gone (seed state restored)", (await row.count()) === 0, "");
  await logout();
  await cleanup();
}

// PKG admin-org (v2 diff 10 #5, #9, #13, #15): «Organization», organization review, platform figures,
// audit view and the «Verified organizations» visibility. Demo MRO Madrid's seed address is restored at
// the end, which also returns it to «Pending» (the seed state).
const AO_SEED_ADDRESS = "Calle Ficticia 1, 28042 Madrid";
const [aoMro] = await seedRest(
  "admin.mro@crewflex.test",
  "organizations?select=id&name=eq.Demo%20MRO%20Madrid",
);
/** An interrupted earlier run may have left the smoke address (and a review): put the seed back. */
async function aoRestoreMro() {
  const current = await asSeedUser("admin.mro@crewflex.test", "organization-profile", {
    query: { organizationId: aoMro.id },
  });
  const org = current.data?.organization;
  if (!org) return false;
  if (org.taxAddress !== AO_SEED_ADDRESS || org.reviewStatus !== "pending") {
    // Two saves when only the review is left: a real change is what returns it to pending.
    for (const taxAddress of org.taxAddress === AO_SEED_ADDRESS
      ? [`${AO_SEED_ADDRESS} ·`, AO_SEED_ADDRESS]
      : [AO_SEED_ADDRESS]) {
      const latest = await asSeedUser("admin.mro@crewflex.test", "organization-profile", {
        query: { organizationId: aoMro.id },
      });
      const o = latest.data.organization;
      await asSeedUser("admin.mro@crewflex.test", "organization-profile", {
        method: "PATCH",
        body: {
          organizationId: o.id,
          expectedUpdatedAt: o.updatedAt,
          name: o.name,
          type: o.type,
          country: o.country,
          taxId: o.taxId,
          taxAddress,
        },
      });
    }
  }
  const after = await asSeedUser("admin.mro@crewflex.test", "organization-profile", {
    query: { organizationId: aoMro.id },
  });
  return (
    after.data?.organization.taxAddress === AO_SEED_ADDRESS &&
    after.data?.organization.reviewStatus === "pending"
  );
}
ok(
  "PKG admin-org 0 precondition: Demo MRO Madrid has the seed data, pending",
  await aoRestoreMro(),
);

await login("admin.mro@crewflex.test");
await page.goto(`${BASE}/app/organization/settings`);
await page.waitForLoadState("networkidle");
ok(
  "PKG admin-org 1 «Organization» is in the menu, editable by the admin, pending review",
  (await page.locator("aside a[href='/app/organization/settings']").count()) > 0 &&
    /Pending/.test(await page.locator("main header").first().innerText()) &&
    (await page.inputValue("#taxId")) === "ESB00000000" &&
    (await page.locator("#country").inputValue()) === "ES",
  "",
);
await responsiveShots("pkg-admin-org-organization");
await page.fill("#taxAddress", `${AO_SEED_ADDRESS} (smoke)`);
await page.getByRole("button", { name: "Save organization" }).click();
await page.waitForSelector("[role=status]:has-text('Organization saved.')", { timeout: 15000 });
await page.reload();
await page.waitForLoadState("networkidle");
ok(
  "PKG admin-org 1b saved and persisted; the activity lists the change",
  (await page.inputValue("#taxAddress")) === `${AO_SEED_ADDRESS} (smoke)` &&
    /Organization data changed/.test(await page.locator("main").innerText()),
  "",
);
await logout();

await login("manager.mro@crewflex.test");
await page.goto(`${BASE}/app/organization/settings`);
await page.waitForLoadState("networkidle");
const aoManagerView = await page.locator("main").innerText();
const aoDenied = [];
for (const path of ["/app/admin/organizations", "/app/admin/audit"]) {
  expectedErrorUrls.add(`${BASE}${path}`);
  const response = await page.goto(`${BASE}${path}`);
  aoDenied.push(response?.status());
}
ok(
  "PKG admin-org 2 manager: read-only data; organization review and audit are HTTP 404",
  /Only the organization's admin can change this data/.test(aoManagerView) &&
    !/Save organization/.test(aoManagerView) &&
    aoDenied.every((s) => s === 404),
  JSON.stringify(aoDenied),
);
await logout();

await login("platform.admin@crewflex.test");
await page.waitForLoadState("networkidle");
const aoHome = await page.locator("main").innerText();
ok(
  "PKG admin-org 3 Administration shows the platform figures (counts, no money) and demand",
  /Your platform, in figures/.test(aoHome) &&
    /Registered technicians/i.test(aoHome) &&
    /AOG with vacancies/i.test(aoHome) &&
    /Demand by licence/.test(aoHome) &&
    !/€/.test(aoHome),
  "",
);
await page.goto(`${BASE}/app/admin/organizations`);
await page.waitForLoadState("networkidle");
const aoCard = page.locator("main li").filter({ hasText: "Demo MRO Madrid" });
const aoOwn = page.locator("main li").filter({ hasText: "CrewFlex Operaciones" });
ok(
  "PKG admin-org 4 review list: Demo MRO Madrid reviewable; own organization refused",
  (await aoCard.locator("button:has-text('Register review')").count()) === 1 &&
    /nobody reviews their own/.test(await aoOwn.innerText()),
  "",
);
await responsiveShots("pkg-admin-org-reviews");
await aoCard.locator("button:has-text('Register review')").click();
ok(
  "PKG admin-org 4b no evidence → refused before any request",
  /Record the evidence of the review/.test(await aoCard.innerText()),
  "",
);
await aoCard.locator("textarea[name=note]").fill("Smoke: companies register checked (synthetic)");
await aoCard.locator("button:has-text('Register review')").click();
await page.waitForSelector("[role=status]:has-text('Demo MRO Madrid: review registered.')", {
  timeout: 15000,
});
await page.reload();
await page.waitForLoadState("networkidle");
ok(
  "PKG admin-org 4c review persisted (no form left on the card)",
  /Review registered/.test(await aoCard.innerText()) &&
    (await aoCard.locator("textarea").count()) === 0,
  "",
);
await page.goto(`${BASE}/app/admin/audit`);
await page.waitForLoadState("networkidle");
ok(
  "PKG admin-org 5 audit view lists the review, newest first, ids only",
  /organization\.reviewed/.test(await page.locator("tbody tr").first().innerText()),
  "",
);
await responsiveShots("pkg-admin-org-audit");
await logout();

await login("admin.mro@crewflex.test");
await page.goto(`${BASE}/app/organization/settings`);
await page.waitForLoadState("networkidle");
ok(
  "PKG admin-org 6 the organization sees «Review registered»",
  /Review registered/.test(await page.locator("main header").first().innerText()),
  "",
);
await page.fill("#taxAddress", AO_SEED_ADDRESS);
await page.getByRole("button", { name: "Save organization" }).click();
await page.waitForSelector("[role=status]:has-text('Organization saved.')", { timeout: 15000 });
await page.reload();
await page.waitForLoadState("networkidle");
ok(
  "PKG admin-org 6b changing a field sends it back to Pending (seed restored)",
  /Pending/.test(await page.locator("main header").first().innerText()) &&
    (await page.inputValue("#taxAddress")) === AO_SEED_ADDRESS,
  "",
);
await logout();

await login("delta@crewflex.test");
await page.goto(`${BASE}/app/professional/profile`);
await page.waitForLoadState("networkidle");
ok(
  "PKG admin-org 7 passport: four visibility options, «Verified organizations» third (v1.8 order)",
  (await page.locator("[role=radiogroup] [role=radio]").allInnerTexts())
    .map((t) => t.split("\n")[0])
    .join("|") === "Private|Anonymous|Verified organizations|Open",
  "",
);
await logout();

// PKG passport (N-01, N-02, N-05…N-08, N-16, N-25; migrations 20261023100*): the v1.8 passport
// fields are offered, saved and reloaded; a rating on an unticked aircraft is refused before sending;
// the identity card and the organization's candidate card show the declarations. Delta's passport is
// restored through the local API at the end.
const deltaPassport = (await asSeedUser("delta@crewflex.test", "professional-profile")).data
  .profile;
await login("delta@crewflex.test");
await page.goto(`${BASE}/app/professional/profile`);
await page.waitForLoadState("networkidle");
const passportCounts = await page.evaluate(() =>
  Object.fromEntries(
    ["categories", "aircraft", "engines", "skills", "workPermits"].map((id) => [
      id,
      document.querySelectorAll(`fieldset#${id} input[type=checkbox]`).length,
    ]),
  ),
);
ok(
  "PKG passport 1 v1.8 catalogs (12 categories, 12 aircraft, 7 engines, 9 capabilities, 27 EU permits), main category, «% complete» badge",
  JSON.stringify(passportCounts) ===
    JSON.stringify({ categories: 12, aircraft: 12, engines: 7, skills: 9, workPermits: 27 }) &&
    (await page.inputValue("#primaryCategory")) === "B1.1" &&
    /\d+% complete/.test(await page.locator("main header").first().innerText()),
  JSON.stringify(passportCounts),
);
const passportBox = (fieldset, text) =>
  page.locator(`fieldset#${fieldset} label`, { hasText: text }).locator("input");
await passportBox("aircraft", "A350").check();
await page.getByRole("button", { name: "Add type rating" }).click();
await page.selectOption("#rating-2-aircraft", "A350");
await page.selectOption("#rating-2-category", "B2");
await page.fill("#rating-2-restrictions", "Smoke restriction");
await page.fill("#phone", "+34 600 111 222");
await page.selectOption("#englishLevel", "B2");
await page.fill("#minRate", "52.5");
await passportBox("workPermits", "Germany").check();
await passportBox("blockedOrganizationIds", "Demo Aero Services Lisbon").check();
await page.click("main form button[type=submit]");
await page.waitForSelector("[role=status]:has-text('Passport updated')", { timeout: 15000 });
await page.reload();
await page.waitForLoadState("networkidle");
ok(
  "PKG passport 2 saved and reloaded: aircraft, rating with restriction, phone, English, rate, permit, block",
  (await passportBox("aircraft", "A350").isChecked()) &&
    (await page.inputValue("#rating-2-aircraft")) === "A350" &&
    (await page.inputValue("#rating-2-restrictions")) === "Smoke restriction" &&
    (await page.inputValue("#phone")) === "+34 600 111 222" &&
    (await page.inputValue("#englishLevel")) === "B2" &&
    (await page.inputValue("#minRate")) === "52.5" &&
    (await passportBox("workPermits", "Germany").isChecked()) &&
    (await passportBox("blockedOrganizationIds", "Demo Aero Services Lisbon").isChecked()),
  "",
);
await passportBox("aircraft", "A350").uncheck();
await page.click("main form button[type=submit]");
ok(
  "PKG passport 3 a rating on an unticked aircraft is refused before anything is sent",
  await page
    .getByText("Each type rating must use an aircraft and a category you ticked.")
    .isVisible(),
  "",
);
await page.goto(`${BASE}/app/professional`);
await page.waitForLoadState("networkidle");
// PKG shell-visual (N-15): the identity card became the v1.8 hero; its medals summarise the
// declarations (the saved A350 · B2 rating with its restriction sits behind «+N»).
const heroMedals = page
  .getByRole("region", { name: "Your professional identity" })
  .getByRole("group", { name: "Profile badges" });
await heroMedals.getByRole("button", { name: /^Show \d+ more badges?$/ }).click();
const restricted = heroMedals.getByRole("button", { name: "A350 · B2: With restrictions" });
await restricted.click();
const restrictedDetail = await page
  .getByRole("status")
  .filter({ hasText: "A350 · B2 · With restrictions" })
  .innerText();
ok(
  "PKG passport 4 hero medals: main category, the declared rating with its restriction text",
  (await heroMedals.getByRole("button", { name: /^B1\.1: / }).count()) === 1 &&
    /Smoke restriction/.test(restrictedDetail),
  restrictedDetail.replace(/\s+/g, " ").slice(0, 120),
);
await logout();
const passportNow = (await asSeedUser("delta@crewflex.test", "professional-profile")).data.profile;
const passportSeed = { ...deltaPassport, expectedUpdatedAt: passportNow.updatedAt };
delete passportSeed.updatedAt;
const passportRestored = await asSeedUser("delta@crewflex.test", "professional-profile", {
  method: "PATCH",
  body: passportSeed,
});
ok(
  "PKG passport 5 Delta's seed passport restored",
  passportRestored.ok === true,
  passportRestored.error?.code ?? "",
);
await login("admin.mro@crewflex.test");
await page.goto(`${madUrl}/matches`);
await page.waitForLoadState("networkidle");
const echoCard = page.locator("main article", { hasText: "Technician Echo" }).first();
await echoCard.waitFor({ timeout: 15000 });
const echoText = await echoCard.innerText();
ok(
  "PKG passport 6 candidate card (Echo, open): declared category, aircraft, English, permits, «Restrictions declared»",
  /B1\.1 \(main\) · A320 Family · English B1 · Work permits: ES/.test(echoText) &&
    /Restrictions declared/.test(echoText),
  echoText.replace(/\s+/g, " ").slice(0, 160),
);
await logout();

// PKG P02 (passport parity, F3 — TEC-02 #5/#6/#9/#13, TEC-08 #9/#10/#12-13, SHOT-03 #1/#2; T-162): the v1.8
// header («Empezar perfil vacío» + «{%} completado · {n} evidencias»), the «Pasaporte visual» with its photo
// controls, medals, the folded 60-day review list and the learning achievements below; «Empezar desde cero»
// prepares an empty draft of the SAME version that saves nothing until «Guardar pasaporte» (the name is
// required, as v1.8); Escape and focus; the Spanish literals; and the refusal: an organization account has
// no passport (page and API). Nothing is written: the empty draft is never saved.
{
  await login("delta@crewflex.test");
  await page.goto(`${BASE}/app/professional/profile`);
  await page.waitForLoadState("networkidle");
  const p2Header = page.locator("main header").first();
  const p2Trigger = p2Header.getByRole("button", { name: "Start an empty profile" });
  const p2Visual = page.getByRole("region", { name: "Professional badges" });
  await p2Visual.locator("details > summary").click();
  const p2VisualText = (await p2Visual.innerText()).replace(/\s+/g, " ");
  ok(
    "PKG P02 1 header «Start an empty profile» + «{%} complete · {n} evidence»; visual passport: «Add photo», 4 medals, the folded 60-day list opens («Nothing declared expires…»), footnote; «Learning achievements» below",
    (await p2Trigger.count()) === 1 &&
      /\d+% complete · \d+ pieces? of evidence/.test(await p2Header.innerText()) &&
      /Add photo/.test(p2VisualText) &&
      (await p2Visual
        .getByRole("group", { name: "Profile badges" })
        .getByRole("button")
        .count()) === 4 &&
      /Documents and courses to review Nothing declared expires within the next 60 days/.test(
        p2VisualText,
      ) &&
      /grant no signing authority/.test(p2VisualText) &&
      (await page.getByRole("heading", { name: "Learning achievements" }).count()) === 1,
    p2VisualText.slice(0, 200),
  );
  // «Start from scratch»: Escape closes it with focus back; «Prepare draft» empties every field in place.
  await p2Trigger.click();
  const p2Dialog = page.getByRole("dialog", { name: "Start from scratch" });
  const p2DialogText = await p2Dialog.innerText();
  await page.keyboard.press("Escape");
  const p2Closed =
    !(await p2Dialog.isVisible()) &&
    (await p2Trigger.evaluate((el) => document.activeElement === el));
  // v1.8 keeps location, employer, English, tools and work countries (Professional2.jsx:113-128).
  const p2Kept = () =>
    page.evaluate(() => ({
      base: document.querySelector("#baseLocation").value,
      permits: document.querySelectorAll("fieldset#workPermits input:checked").length,
    }));
  const p2KeptBefore = await p2Kept();
  await p2Trigger.click();
  await p2Dialog.getByRole("button", { name: "Prepare draft" }).click();
  await page.waitForSelector("[role=status]:has-text('Empty draft prepared')", { timeout: 15000 });
  const p2Draft = await page.evaluate(() => ({
    name: document.querySelector("#displayName").value,
    phone: document.querySelector("#phone").value,
    years: document.querySelector("#yearsExperience").value,
    rate: document.querySelector("#minRate").value,
    primary: document.querySelector("#primaryCategory").value,
    ticked: document.querySelectorAll(
      "fieldset#categories input:checked, fieldset#aircraft input:checked, fieldset#engines input:checked, fieldset#skills input:checked",
    ).length,
    ratings: document.querySelectorAll("[id^='rating-'][id$='-aircraft']").length,
    visibility: document.querySelector("[role=radio][aria-checked=true]")?.textContent ?? "",
  }));
  ok(
    "PKG P02 2 «Start from scratch»: the v1.8 text; Escape closes it (focus back); «Prepare draft» empties name, phone, years, rate, main category, the category/aircraft/engine/capability lists and the ratings, keeps base and permits (v1.8), visibility back to Private; a status says nothing is saved yet",
    /An empty draft will be prepared\. Your published profile is kept/.test(p2DialogText) &&
      p2Closed &&
      p2Draft.name === "" &&
      p2Draft.phone === "" &&
      p2Draft.years === "" &&
      p2Draft.rate === "" &&
      p2Draft.primary === "" &&
      p2Draft.ticked === 0 &&
      p2Draft.ratings === 0 &&
      /^Private/.test(p2Draft.visibility) &&
      JSON.stringify(await p2Kept()) === JSON.stringify(p2KeptBefore),
    JSON.stringify(p2Draft),
  );
  // Saving the empty draft fails on the name (v1.8 «Escribe tu nombre profesional.»): nothing is sent.
  const p2Before = (await asSeedUser("delta@crewflex.test", "professional-profile")).data.profile;
  await page.getByRole("button", { name: "Save passport" }).click();
  await page.waitForSelector("#displayName-error", { timeout: 15000 });
  const p2Error = await page.locator("#displayName-error").innerText();
  const p2After = (await asSeedUser("delta@crewflex.test", "professional-profile")).data.profile;
  await page.reload();
  await page.waitForLoadState("networkidle");
  ok(
    "PKG P02 3 «Save passport» on the empty draft: «Professional name is required», nothing sent (same name and version); a reload shows the saved passport again",
    /Professional name is required/.test(p2Error) &&
      p2After.displayName === "Technician Delta" &&
      p2After.updatedAt === p2Before.updatedAt &&
      (await page.inputValue("#displayName")) === "Technician Delta" &&
      (await page.inputValue("#primaryCategory")) === "B1.1",
    `${p2Error} · ${p2After.displayName}`,
  );
  // The Spanish literals of v1.8 (textContent: the kicker is upper-cased by CSS).
  await page.goto(`${BASE}/app/settings`);
  await page.waitForLoadState("networkidle");
  await page.locator("[role=radio][lang=es]").first().click();
  await page.waitForSelector("[role=status]:has-text('Idioma actualizado')", { timeout: 15000 });
  await page.goto(`${BASE}/app/professional/profile`);
  await page.waitForLoadState("networkidle");
  await expectSpanish("PKG P02 4 passport in Spanish");
  const p2Es = await page.locator("main").evaluate((el) => el.textContent.replace(/\s+/g, " "));
  ok(
    "PKG P02 5 v1.8 literals: «Empezar perfil vacío», «{%} completado · {n} evidencias», «Pasaporte visual», «Documentos y cursos próximos a revisar», «Logros de aprendizaje», the five step names as panels, «Guardar pasaporte»",
    [
      "Empezar perfil vacío",
      "Pasaporte visual",
      "Documentos y cursos próximos a revisar",
      "Logros de aprendizaje",
      "01 · Identidad",
      "02 · Cualificaciones",
      "03 · Experiencia y cursos",
      "04 · Tarifa y permisos de trabajo",
      "05 · Visibilidad en la red",
      "Guardar pasaporte",
    ].every((s) => p2Es.includes(s)) && /\d+% completado · \d+ evidencias?/.test(p2Es),
    p2Es.slice(0, 160),
  );
  await shot("P02-passport-es");
  // «Mi espacio» after the shared 60-day list (UpcomingReviews) and the red-dot note (P01-19, unverified in P01).
  await page.goto(`${BASE}/app/professional`);
  await page.waitForLoadState("networkidle");
  const p2Home = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  ok(
    "PKG P02 6 «Mi espacio» (es): the red-dot note of v1.8 with the connected prefix (P01-19) and the 60-day panel still there after the refactor",
    /Calendario en UTC\. El punto rojo señala oportunidades en días compatibles o descansos que podrías publicar\. No cambia tu disponibilidad\./.test(
      p2Home,
    ) &&
      /Documentos y cursos próximos a revisar Nada de lo declarado caduca en los próximos 60 días\./.test(
        p2Home,
      ),
    p2Home.slice(0, 120),
  );
  await page.goto(`${BASE}/app/settings`);
  await page.waitForLoadState("networkidle");
  await page.locator("[role=radio][lang=en]").first().click();
  await page.waitForSelector("[role=status]:has-text('Language updated')", { timeout: 15000 });
  await logout();
  // Negative: an organization account has no passport — the page says so and the API refuses (403).
  const p2Forbidden = await asSeedUser("admin.mro@crewflex.test", "professional-profile");
  await login("admin.mro@crewflex.test");
  await page.goto(`${BASE}/app/professional/profile`);
  await page.waitForLoadState("networkidle");
  ok(
    "PKG P02 7 an organization account: «No professional profile» on the passport page; GET professional-profile answers FORBIDDEN",
    /No professional profile/.test(await page.locator("main").innerText()) &&
      p2Forbidden.ok === false &&
      p2Forbidden.error?.code === "FORBIDDEN",
    p2Forbidden.error?.code ?? JSON.stringify(p2Forbidden).slice(0, 80),
  );
  await logout();
}

// PKG P03 (calendar parity, F3 — TEC-04 #3/#26/#39/#42-43/#50/#52/#58/#64, SHOT-02 #1/#6; BR-4.9, T-15): the
// availability page in Spanish with the v1.8 literals; the days of a confirmed assignment are disabled with
// «Una asignación confirmada está protegida.» and the cycle generator skips them even with «Reemplazar…»; a stale
// calendar save and a window delete that would uncover the assignment are refused with the v1.8 copy and nothing
// is lost; another professional and an organization can neither read nor write delta's windows (function,
// PostgREST, direct URL); the v1.8 dock below `lg`. Fixture through the local API (a need in January 2027,
// delta's application confirmed, three windows); everything is restored at the end, whatever happens.
{
  const P3 = "2027-01";
  const p3Key = () => ({ "Idempotency-Key": crypto.randomUUID() });
  const p3Title = `Local UI check · P03 calendar ${Date.now()}`;
  const p3Need = await asSeedUser("admin.mro@crewflex.test", "work-requirements", {
    method: "POST",
    headers: p3Key(),
    body: {
      organizationId: mroOrg.id,
      title: p3Title,
      location: "Madrid (MAD)",
      startsAt: `${P3}-18T06:00:00.000Z`,
      endsAt: `${P3}-19T18:00:00.000Z`,
      shift: "day",
      headcount: 2,
      urgency: "planned",
      qualifications: hiringTypes.map((q) => ({ qualificationTypeId: q.id, level: "hard" })),
    },
  });
  const p3Windows = {};
  for (const [name, startsAt, endsAt, status] of [
    ["covering", `${P3}-18T00:00:00.000Z`, `${P3}-21T00:00:00.000Z`, "available"],
    ["blocked", `${P3}-04T00:00:00.000Z`, `${P3}-08T00:00:00.000Z`, "unavailable"],
    ["aog", `${P3}-12T00:00:00.000Z`, `${P3}-13T00:00:00.000Z`, "aog_only"],
  ]) {
    const w = await asSeedUser("delta@crewflex.test", "professional-availability", {
      method: "POST",
      headers: p3Key(),
      body: { startsAt, endsAt, status },
    });
    p3Windows[name] = w.data?.window;
  }
  const p3Applied = await asSeedUser("delta@crewflex.test", "applications", {
    method: "POST",
    headers: p3Key(),
    body: { requirementId: p3Need.data?.requirement.id, shareConsent: true },
  });
  const p3App = {
    id: p3Applied.data?.application.id,
    updatedAt: p3Applied.data?.application.updatedAt,
  };
  const p3Move = async (email, to, extra = {}) => {
    const res = await asSeedUser(email, "applications", {
      method: "PATCH",
      headers: p3Key(),
      body: { applicationId: p3App.id, to, expectedUpdatedAt: p3App.updatedAt, ...extra },
    });
    if (res.data) p3App.updatedAt = res.data.transition.updatedAt;
    return res;
  };
  await p3Move("admin.mro@crewflex.test", "shortlisted");
  const p3Proposed = await p3Move("admin.mro@crewflex.test", "proposed");
  await p3Move("delta@crewflex.test", "accepted", {
    proposalId: p3Proposed.data?.transition.proposalId,
    acceptTerms: true,
  });
  const p3Confirmed = await p3Move("admin.mro@crewflex.test", "confirmed");
  const p3Mine = async () =>
    (await asSeedUser("delta@crewflex.test", "professional-availability")).data?.windows ?? [];
  const p3Before = (await p3Mine()).length;
  ok(
    "PKG P03 0 fixture (API): delta's application to the January 2027 need is confirmed; three windows (covering 18–20, blocked 4–7, AOG 12)",
    p3Confirmed.data?.transition.status === "confirmed" &&
      Object.values(p3Windows).every(Boolean) &&
      p3Before >= 3,
    JSON.stringify(p3Confirmed.error ?? p3Need.error ?? ""),
  );
  const p3Cell = (date) => page.locator(`main button[aria-label^='${date}:']`);
  const p3Open = async (month = P3) => {
    await page.goto(`${BASE}/app/professional/availability?month=${month}`);
    await page.waitForLoadState("networkidle");
  };
  const p3Drafted = () => page.locator("main button[aria-label*='sin guardar']").count();
  let p3Elsewhere = null;
  try {
    await login("delta@crewflex.test");
    await page.goto(`${BASE}/app/settings`);
    await page.waitForLoadState("networkidle");
    await page.locator("[role=radio][lang=es]").first().click();
    await page.waitForSelector("[role=status]:has-text('Idioma actualizado')", { timeout: 15000 });
    await p3Open();
    await expectSpanish("PKG P03 1 availability in Spanish");
    const p3Text = await page.locator("main").evaluate((el) => el.textContent.replace(/\s+/g, " "));
    const p3Patterns = (await page.locator("#cycle-pattern option").allTextContents()).join("|");
    const p3Brushes = (
      await page
        .getByRole("group", { name: "Estado a aplicar" })
        .getByRole("button")
        .allTextContents()
    ).join("|");
    ok(
      "PKG P03 1b v1.8 literals: «Tu calendario» / «Tu tiempo, a tu manera.», the month's KPIs (3 · 4 · 1), «Planifica tu ciclo», the 14 patterns in v1.8's order, «Día 1 del ciclo (UTC)», publish / replace, «Previsualizar ciclo en el mes», the hint that respects assignments and past dates, «Enero de 2027», the four brushes (the first pressed), the protection sentence, the weekday header, «Añadir una ventana de tiempo», «Ventanas guardadas (n)»",
      /Disponibles\s*3\s*Días publicados este mes\s*Bloqueados\s*4\s*Días marcados como no disponibles\s*Solo AOG\s*1\s*Días reservados para necesidades AOG\s*Ventanas\s*\d+/.test(
        p3Text,
      ) &&
        /Lun\s*Mar\s*Mié\s*Jue\s*Vie\s*Sáb\s*Dom/.test(p3Text) &&
        (await page
          .getByRole("group", { name: "Estado a aplicar" })
          .getByRole("button", { pressed: true })
          .textContent()) === "Disponible" &&
        [
          "Tu calendario",
          "Tu tiempo, a tu manera.",
          "Planifica tu ciclo",
          "Día 1 del ciclo (UTC)",
          "Publicar descansos generados como disponibles",
          "Reemplazar también los días que ya he guardado en este mes",
          "Previsualizar ciclo en el mes",
          "Se respetan las asignaciones confirmadas, las fechas pasadas y los intervalos parciales de los días que no reemplazas.",
          "Enero de 2027",
          "Las fechas con asignación confirmada están protegidas también en el servidor.",
          "Añadir una ventana de tiempo",
        ].every((s) => p3Text.includes(s)) &&
        /Ventanas guardadas \(\d+\)/.test(p3Text) &&
        p3Patterns ===
          "7–3|7–4|5–2|7–3 / 7–4 alterno|6–4|5–5|4–4|10–10|15–15|Otro · ciclo personalizado|2 días, 2 noches, 4 libres|Noches (5 de trabajo, 2 libres)|Turno partido (5 de trabajo, 2 libres)|Flexible (solo descanso)" &&
        p3Brushes === "Disponible|Bloqueado|Solo AOG|Descanso (limpiar)",
      `${p3Patterns} · ${p3Brushes}`,
    );
    const p3Protected = (d) =>
      `${P3}-${d}: Disponible, asignación confirmada. Una asignación confirmada está protegida.`;
    const p3Label18 = (await p3Cell(`${P3}-18`).getAttribute("aria-label")) ?? "";
    const p3Label19 = (await p3Cell(`${P3}-19`).getAttribute("aria-label")) ?? "";
    ok(
      "PKG P03 2 BR-4.9: the 18th and 19th are disabled with «Disponible, asignación confirmada. Una asignación confirmada está protegida.»; the 20th (same window) and an empty day stay enabled; «Solo AOG» and «Bloqueado» days read so",
      (await p3Cell(`${P3}-18`).isDisabled()) &&
        (await p3Cell(`${P3}-19`).isDisabled()) &&
        p3Label18 === p3Protected("18") &&
        p3Label19 === p3Protected("19") &&
        (await p3Cell(`${P3}-20`).isEnabled()) &&
        (await p3Cell(`${P3}-25`).isEnabled()) &&
        (await p3Cell(`${P3}-12`).getAttribute("aria-label")) === `${P3}-12: Solo AOG` &&
        (await p3Cell(`${P3}-04`).getAttribute("aria-label")) === `${P3}-04: Bloqueado`,
      `${p3Label18} · ${p3Label19}`,
    );
    const p3ThisMonth = today.slice(0, 7);
    await p3Open(p3ThisMonth);
    ok(
      "PKG P03 2b the current month: past days are disabled, today is editable",
      (await p3Cell(today).isEnabled()) &&
        (`${p3ThisMonth}-01` === today || (await p3Cell(`${p3ThisMonth}-01`).isDisabled())),
      today,
    );
    // One click on an empty day saves at once (demo); the «clear» brush on that single-day window deletes it.
    await p3Open();
    await p3Cell(`${P3}-25`).click();
    await page.waitForSelector("[role=status]:has-text('2027-01-25 marcado como disponible')", {
      timeout: 15000,
    });
    await page.waitForLoadState("networkidle");
    const p3Marked = (await p3Mine()).some(
      (w) => w.startsAt === `${P3}-25T00:00:00.000Z` && w.endsAt === `${P3}-26T00:00:00.000Z`,
    );
    await page
      .getByRole("group", { name: "Estado a aplicar" })
      .getByRole("button", { name: "Descanso (limpiar)" })
      .click();
    await p3Cell(`${P3}-25`).click();
    await page.waitForSelector("[role=status]:has-text('2027-01-25 limpiado')", { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    ok(
      "PKG P03 2c one click on an empty day: «2027-01-25 marcado como disponible», a whole-day UTC window stored; «Descanso (limpiar)» on it: «2027-01-25 limpiado», the window gone (TEC-04 #44)",
      p3Marked &&
        (await p3Mine()).length === p3Before &&
        (await p3Cell(`${P3}-25`).getAttribute("aria-label")) === `${P3}-25: Descanso`,
      `${p3Marked} · ${(await p3Mine()).length}`,
    );
    await p3Open();
    await page
      .getByRole("checkbox", { name: "Reemplazar también los días que ya he guardado en este mes" })
      .check();
    const p3Preview = async () => {
      await page.getByRole("button", { name: "Previsualizar ciclo en el mes" }).click();
      await page.waitForSelector("main [role=status]:has-text('sin guardar')", { timeout: 15000 });
    };
    await p3Preview();
    const p3DraftedAll = await p3Drafted();
    const p3DraftedAssigned = await page
      .locator(
        `main button[aria-label^='${P3}-18:'][aria-label*='sin guardar'], main button[aria-label^='${P3}-19:'][aria-label*='sin guardar']`,
      )
      .count();
    const p3NavDisabled =
      (await page.getByRole("button", { name: "Mes anterior" }).isDisabled()) &&
      (await page.getByRole("button", { name: "Mes siguiente" }).isDisabled());
    const p3Pending = await page.locator("main [role=status]:has-text('sin guardar')").innerText();
    const p3Cut = await page
      .locator("main [role=status]:has-text('sin guardar') + p")
      .innerText()
      .catch(() => "");
    await page.getByRole("button", { name: "Deshacer último cambio" }).click();
    const p3AfterUndo = await p3Drafted();
    ok(
      "PKG P03 3 «Reemplazar…» + preview: 29 days drafted («sin guardar», dashed), never the 2 assigned ones; «29 días modificados sin guardar…»; «5 días están dentro de un intervalo más largo…» (4–7 and the 20th); month arrows disabled while drafted; «Deshacer último cambio» empties the one-step draft",
      p3DraftedAll === 29 &&
        p3DraftedAssigned === 0 &&
        p3NavDisabled &&
        /^29 días modificados sin guardar\. Revisa el calendario y guarda o descarta para cambiar de mes\./.test(
          p3Pending,
        ) &&
        /^5 días están dentro de un intervalo más largo o de horas parciales\. Al guardar solo se recortan los días marcados y se conservan las horas del resto\./.test(
          p3Cut,
        ) &&
        p3AfterUndo === 0,
      `${p3DraftedAll} drafted · ${p3DraftedAssigned} assigned drafted · nav disabled ${p3NavDisabled} · after undo ${p3AfterUndo} · ${p3Pending.slice(0, 60)}`,
    );
    // A stale save (W5-03): a window added from «another device» after the page loaded changes the version.
    await p3Preview();
    p3Elsewhere = (
      await asSeedUser("delta@crewflex.test", "professional-availability", {
        method: "POST",
        headers: p3Key(),
        body: {
          startsAt: "2027-03-01T00:00:00.000Z",
          endsAt: "2027-03-02T00:00:00.000Z",
          status: "available",
        },
      })
    ).data?.window;
    await page.getByRole("button", { name: "Guardar calendario" }).click();
    await page.waitForSelector("[role=alert]:has-text('Tu calendario cambió')", { timeout: 15000 });
    const p3Conflict = await page.locator("[role=alert]").first().innerText();
    const p3StillDrafted = await p3Drafted();
    const p3AfterConflict = (await p3Mine()).length;
    await page.getByRole("button", { name: "Descartar cambios" }).click();
    ok(
      "PKG P03 4 a stale save: «Tu calendario cambió en otra ventana o dispositivo. No se ha guardado nada: recarga para ver la versión más reciente.»; the 29-day draft stays; only the other device's window exists",
      /^Tu calendario cambió en otra ventana o dispositivo\. No se ha guardado nada: recarga para ver la versión más reciente\./.test(
        p3Conflict,
      ) &&
        p3StillDrafted === 29 &&
        p3AfterConflict === p3Before + 1 &&
        (await p3Drafted()) === 0,
      `${p3Conflict.slice(0, 80)} · drafted ${p3StillDrafted} · windows ${p3Before} → ${p3AfterConflict}`,
    );
    // Deleting the window that covers the assignment: 409 ASSIGNMENT_PROTECTED with the v1.8 connected copy.
    const p3Row = page.locator("main li", { hasText: "18 ene 2027, 00:00 UTC" });
    await p3Row.getByRole("button", { name: "Eliminar" }).click();
    await p3Row.getByRole("button", { name: "Sí, eliminarla" }).click();
    await page.waitForSelector("[role=alert]:has-text('Conserva la disponibilidad')", {
      timeout: 15000,
    });
    const p3ProtectedCopy = await page.locator("[role=alert]").first().innerText();
    const p3RowsAfter = await page
      .locator("main li", { hasText: "18 ene 2027, 00:00 UTC" })
      .count();
    const p3StillStored = (await p3Mine()).some((w) => w.id === p3Windows.covering.id);
    ok(
      "PKG P03 5 «Eliminar» → «Sí, eliminarla» of the window that covers the assignment: «Conserva la disponibilidad de tus asignaciones confirmadas.»; the window is still listed and stored",
      /^Conserva la disponibilidad de tus asignaciones confirmadas\./.test(p3ProtectedCopy) &&
        p3RowsAfter === 1 &&
        p3StillStored,
      `${p3ProtectedCopy.slice(0, 80)} · rows ${p3RowsAfter} · stored ${p3StillStored}`,
    );
    // The v1.8 dock below `lg` (SHOT-02 #6, T-141) and no horizontal overflow at the five widths.
    await responsiveShots("P03-availability-es");
    for (const width of [1024, 390, 360]) {
      await page.setViewportSize({ width, height: width < 800 ? 1100 : 900 });
      await page.waitForTimeout(300);
      const p3Overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      const p3Dock = await page.evaluate(() => {
        const nav = document.querySelector("nav[aria-label='Accesos rápidos']");
        if (!nav) return null;
        const r = nav.getBoundingClientRect();
        return {
          position: getComputedStyle(nav).position,
          atBottom: Math.round(r.bottom) === window.innerHeight,
          current: nav.querySelector("a[aria-current=page]")?.textContent?.trim() ?? "",
        };
      });
      ok(
        width < 1024
          ? `PKG P03 7 @${width}: no horizontal overflow; the v1.8 dock is fixed at the bottom with «Calendario» current`
          : `PKG P03 7 @${width}: no horizontal overflow; the dock is hidden from lg`,
        !p3Overflow &&
          (width < 1024
            ? p3Dock?.position === "fixed" && p3Dock.atBottom && p3Dock.current === "Calendario"
            : p3Dock === null ||
              !(await page.locator("nav[aria-label='Accesos rápidos']").isVisible())),
        JSON.stringify(p3Dock),
      );
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/app/settings`);
    await page.waitForLoadState("networkidle");
    await page.locator("[role=radio][lang=en]").first().click();
    await page.waitForSelector("[role=status]:has-text('Language updated')", { timeout: 15000 });
    await logout();
    // Negative: another professional and an organization, through the function, PostgREST and the page.
    const p3Covering = p3Windows.covering;
    const p3EchoPatch = await asSeedUser("echo@crewflex.test", "professional-availability", {
      method: "PATCH",
      query: { id: p3Covering.id },
      body: { startsAt: p3Covering.startsAt, endsAt: p3Covering.endsAt, status: "unavailable" },
    });
    const p3EchoDelete = await asSeedUser("echo@crewflex.test", "professional-availability", {
      method: "DELETE",
      query: { id: p3Covering.id },
    });
    const p3EchoRest = await seedRest(
      "echo@crewflex.test",
      `availability_windows?select=id&id=eq.${p3Covering.id}`,
    );
    const p3OrgRest = await seedRest(
      "admin.mro@crewflex.test",
      `availability_windows?select=id&id=eq.${p3Covering.id}`,
    );
    const p3OrgPut = await asSeedUser("admin.mro@crewflex.test", "professional-availability", {
      method: "PUT",
      headers: p3Key(),
      body: { days: [{ date: `${P3}-25`, status: "available" }] },
    });
    const p3OrgGet = await asSeedUser("admin.mro@crewflex.test", "professional-availability");
    await login("admin.mro@crewflex.test");
    await page.goto(`${BASE}/app/professional/availability?month=${P3}`);
    await page.waitForLoadState("networkidle");
    const p3OrgPage = await page.locator("main").innerText();
    await logout();
    ok(
      "PKG P03 6 negative: echo (another professional) PATCH / DELETE of delta's window → NOT_FOUND and reads 0 rows (PostgREST); admin.mro reads 0 rows, PUT → FORBIDDEN, GET lists nothing, direct URL → «No professional profile»; the window is intact",
      p3EchoPatch.error?.code === "NOT_FOUND" &&
        p3EchoDelete.error?.code === "NOT_FOUND" &&
        Array.isArray(p3EchoRest) &&
        p3EchoRest.length === 0 &&
        Array.isArray(p3OrgRest) &&
        p3OrgRest.length === 0 &&
        p3OrgPut.error?.code === "FORBIDDEN" &&
        p3OrgGet.data?.windows?.length === 0 &&
        /No professional profile/.test(p3OrgPage) &&
        (await p3Mine()).some((w) => w.id === p3Covering.id && w.status === "available"),
      JSON.stringify([
        p3EchoPatch.error?.code,
        p3EchoDelete.error?.code,
        p3EchoRest,
        p3OrgRest,
        p3OrgPut.error?.code,
        p3OrgGet.data?.windows?.length,
      ]),
    );
  } finally {
    // Delta back to English even when a step above failed, or later English-asserting blocks cascade.
    await asSeedUser("delta@crewflex.test", "user-preferences", {
      method: "PATCH",
      body: { locale: "en" },
    });
    const p3Cancelled = await p3Move("delta@crewflex.test", "cancelled", {
      reason: "Local UI check: P03 restore",
    });
    const p3Deleted = [];
    for (const w of [...Object.values(p3Windows), p3Elsewhere])
      if (w)
        p3Deleted.push(
          (
            await asSeedUser("delta@crewflex.test", "professional-availability", {
              method: "DELETE",
              query: { id: w.id },
            })
          ).data?.deleted === true,
        );
    const p3Closed = await asSeedUser("admin.mro@crewflex.test", "work-requirements", {
      method: "PATCH",
      body: { id: p3Need.data?.requirement.id, status: "closed" },
    });
    ok(
      "PKG P03 8 restore: assignment cancelled, the four windows deleted, the need closed (seed state back)",
      p3Cancelled.data?.transition.status === "cancelled" &&
        p3Deleted.length === 4 &&
        p3Deleted.every(Boolean) &&
        p3Closed.data?.requirement?.status === "closed" &&
        (await p3Mine()).length === p3Before - 3,
      JSON.stringify([
        p3Cancelled.error,
        p3Deleted,
        p3Closed.error ?? p3Closed.data?.requirement?.status,
      ]),
    );
  }
}

// PKG P04 (opportunities parity, F3 — MKT-03 #1/#2/#7/#8/#13, MKT-04 #1-#4/#9, MKT-05 #3/#5/#6/#8/#9/#12,
// SHOT-10 #4/#7/#9; P01-22/P01-23; BR-14, BR-14.1, BR-15; T-164): v1.8 «Oportunidades» in Spanish — header,
// search, pills, the card facts (rate, days, people, block, verdict, «Ver detalle» / «Preparar candidatura»),
// the empty state, the dock «Ofertas» below `lg`; the detail with the terms, logistics, description, the own
// eligibility and the Candidate Pack preview; applying with the consent and «Ya presentada» after; the «Mi
// espacio» rows (tile tone, «{tarifa} / h», «Ver oferta» / «Revisar fechas»); «Ofertas en la red» for another
// organization. Negatives: an organization or another professional cannot apply in delta's name (403 / 400
// strict body), a blocked organization's needs are hidden (404 / 409), a draft or paused need is not offered
// (list, `?id=`, apply), an organization account on the professional URL is a 404. Fixture through the local
// API with dates derived from today (≥ 30 days ahead, on days free of delta's windows); everything is restored
// at the end whatever happens.
{
  const DELTA = "delta@crewflex.test";
  const MRO = "admin.mro@crewflex.test";
  const p4Key = () => ({ "Idempotency-Key": crypto.randomUUID() });
  const p4Day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const p4Short = (d) =>
    new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", timeZone: "UTC" })
      .format(new Date(`${d}T00:00:00Z`))
      .toUpperCase();
  const p4Suffix = Date.now();
  const p4Mine = async () =>
    (await asSeedUser(DELTA, "professional-availability")).data?.windows ?? [];
  // The first 3-day span from `from` days ahead with no delta window at all (a private rest, BR-14.1).
  const p4Existing = await p4Mine();
  const p4Free = (from) => {
    for (let n = from; n < from + 180; n++) {
      const s = Date.parse(`${p4Day(n)}T00:00:00.000Z`);
      const e = s + 3 * 86_400_000;
      if (!p4Existing.some((w) => Date.parse(w.startsAt) < e && Date.parse(w.endsAt) > s)) return n;
    }
    return from;
  };
  const p4N = p4Free(35);
  const p4RestN = p4Free(p4N + 7);
  const p4Start = p4Day(p4N);
  const p4End = p4Day(p4N + 1);
  const p4RestStart = p4Day(p4RestN);
  const p4RestEnd = p4Day(p4RestN + 1);
  const p4Body = (title, startsAt, endsAt, extra = {}) => ({
    organizationId: mroOrg.id,
    title,
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
  const p4Post = (body) =>
    asSeedUser(MRO, "work-requirements", { method: "POST", headers: p4Key(), body });
  const p4Title = `Local UI check · P04 oportunidad ${p4Suffix}`;
  const p4RestTitle = `Local UI check · P04 descanso ${p4Suffix}`;
  const p4DraftTitle = `Local UI check · P04 borrador ${p4Suffix}`;
  const p4PausedTitle = `Local UI check · P04 pausada ${p4Suffix}`;
  const p4Description =
    "Revisión programada de línea en hangar; se valora experiencia previa en A320.";
  const p4Need = await p4Post(
    p4Body(p4Title, `${p4Start}T06:00:00.000Z`, `${p4End}T18:00:00.000Z`, {
      description: p4Description,
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
  const p4Id = p4Need.data?.requirement?.id;
  const p4RestNeed = await p4Post(
    p4Body(p4RestTitle, `${p4RestStart}T06:00:00.000Z`, `${p4RestEnd}T18:00:00.000Z`),
  );
  const p4RestId = p4RestNeed.data?.requirement?.id;
  const p4Draft = await p4Post(
    p4Body(p4DraftTitle, `${p4Start}T06:00:00.000Z`, `${p4End}T18:00:00.000Z`, { intent: "draft" }),
  );
  const p4DraftId = p4Draft.data?.requirement?.id;
  const p4PausedNeed = await p4Post(
    p4Body(p4PausedTitle, `${p4Start}T06:00:00.000Z`, `${p4End}T18:00:00.000Z`),
  );
  const p4PausedId = p4PausedNeed.data?.requirement?.id;
  const p4Paused = p4PausedId
    ? await asSeedUser(MRO, "work-requirements", {
        method: "PATCH",
        body: { id: p4PausedId, status: "paused" },
      })
    : { error: p4PausedNeed.error };
  const p4Window = await asSeedUser(DELTA, "professional-availability", {
    method: "POST",
    headers: p4Key(),
    body: {
      startsAt: `${p4Start}T00:00:00.000Z`,
      endsAt: `${p4Day(p4N + 2)}T00:00:00.000Z`,
      status: "available",
    },
  });
  ok(
    "PKG P04 0 fixture (API): a published need with terms and logistics, a «rest day» need, a draft and a paused one (≥ 30 days ahead, days free of delta's windows); delta's window covers the first",
    Boolean(p4Id && p4RestId && p4DraftId && p4PausedId && p4Window.data?.window) &&
      p4Draft.data?.requirement?.status === "draft" &&
      p4Paused.data?.requirement?.status === "paused",
    JSON.stringify({
      start: p4Start,
      rest: p4RestStart,
      errors: [
        p4Need.error,
        p4RestNeed.error,
        p4Draft.error,
        p4Paused.error,
        p4Window.error,
      ].filter(Boolean),
    }),
  );
  const p4List = async (email, query) =>
    ((await asSeedUser(email, "opportunities", { query })).data?.opportunities ?? []).map(
      (o) => o.requirement?.id ?? o.id,
    );
  const p4Detail = (id) => asSeedUser(DELTA, "opportunities", { query: { id } });
  const p4Apply = (email, body) =>
    asSeedUser(email, "applications", { method: "POST", headers: p4Key(), body });
  const p4Query = { q: String(p4Suffix), limit: "50" };
  const p4Listed = await p4List(DELTA, p4Query);
  const p4DraftDetail = await p4Detail(p4DraftId);
  const p4PausedDetail = await p4Detail(p4PausedId);
  const p4ApplyDraft = await p4Apply(DELTA, { requirementId: p4DraftId, shareConsent: true });
  const p4ApplyPaused = await p4Apply(DELTA, { requirementId: p4PausedId, shareConsent: true });
  ok(
    "PKG P04 1 BR-14: the published and the rest-day needs are listed; the draft and the paused one are not (list, `?id=` → NOT_FOUND) and cannot be applied to (409 REQUIREMENT_NOT_OPEN)",
    p4Listed.includes(p4Id) &&
      p4Listed.includes(p4RestId) &&
      !p4Listed.includes(p4DraftId) &&
      !p4Listed.includes(p4PausedId) &&
      p4DraftDetail.error?.code === "NOT_FOUND" &&
      p4PausedDetail.error?.code === "NOT_FOUND" &&
      p4ApplyDraft.error?.reason === "REQUIREMENT_NOT_OPEN" &&
      p4ApplyPaused.error?.reason === "REQUIREMENT_NOT_OPEN",
    JSON.stringify([
      p4Listed.length,
      p4DraftDetail.error?.code,
      p4PausedDetail.error?.code,
      p4ApplyDraft.error,
      p4ApplyPaused.error,
    ]),
  );
  // Identity from the JWT only (S-2): nobody applies in delta's name.
  const p4OrgApply = await p4Apply(MRO, { requirementId: p4Id, shareConsent: true });
  const p4Forged = await p4Apply("echo@crewflex.test", {
    requirementId: p4Id,
    shareConsent: true,
    technicianProfileId: "00000000-0000-4000-8000-000000000021",
  });
  const p4OrgRead = await asSeedUser(MRO, "opportunities", { query: { id: p4Id } });
  const p4Applications = async (email) =>
    (await asSeedUser(email, "applications")).data?.applications ?? [];
  const p4NoneYet = ![
    ...(await p4Applications(DELTA)),
    ...(await p4Applications("echo@crewflex.test")),
  ].some((a) => a.requirementId === p4Id);
  ok(
    "PKG P04 2 identity from the JWT: an organization admin applying → FORBIDDEN; another professional sending `technicianProfileId` → VALIDATION_ERROR (strict body); no application exists for the need; an organization reading the professional view → FORBIDDEN",
    p4OrgApply.error?.code === "FORBIDDEN" &&
      p4Forged.error?.code === "VALIDATION_ERROR" &&
      p4NoneYet &&
      p4OrgRead.error?.code === "FORBIDDEN",
    JSON.stringify([p4OrgApply.error?.code, p4Forged.error?.code, p4OrgRead.error?.code]),
  );
  // v2-16 (T-160) through the API: the block hides the organization's needs and refuses the application.
  const p4Profile = async () => (await asSeedUser(DELTA, "professional-profile")).data?.profile;
  const p4SetBlocks = async (ids) => {
    const profile = await p4Profile();
    const body = { ...profile, blockedOrganizationIds: ids, expectedUpdatedAt: profile?.updatedAt };
    delete body.updatedAt;
    return asSeedUser(DELTA, "professional-profile", { method: "PATCH", body });
  };
  const p4Blocked = await p4SetBlocks([mroOrg.id]);
  const p4ListBlocked = await p4List(DELTA, p4Query);
  const p4DetailBlocked = await p4Detail(p4Id);
  const p4ApplyBlocked = await p4Apply(DELTA, { requirementId: p4Id, shareConsent: true });
  const p4Unblocked = await p4SetBlocks([]);
  const p4ListBack = await p4List(DELTA, p4Query);
  ok(
    "PKG P04 3 v2-16: while delta blocks Demo MRO Madrid its needs leave the list, `?id=` → NOT_FOUND and applying → 409 ORGANIZATION_BLOCKED; unblocked, both are back",
    p4Blocked.ok === true &&
      !p4ListBlocked.includes(p4Id) &&
      !p4ListBlocked.includes(p4RestId) &&
      p4DetailBlocked.error?.code === "NOT_FOUND" &&
      p4ApplyBlocked.error?.reason === "ORGANIZATION_BLOCKED" &&
      p4Unblocked.ok === true &&
      p4ListBack.includes(p4Id) &&
      p4ListBack.includes(p4RestId),
    JSON.stringify([
      p4Blocked.error?.code,
      p4ListBlocked.length,
      p4DetailBlocked.error?.code,
      p4ApplyBlocked.error?.reason,
      p4Unblocked.error?.code,
    ]),
  );
  const p4Open = async (path) => {
    await page.goto(`${BASE}${path}`);
    await page.waitForLoadState("networkidle");
    return (await page.locator("main").innerText()).replace(/\s+/g, " ");
  };
  const p4ListUrl = (extra = "") =>
    `/app/professional/opportunities?q=${encodeURIComponent(p4Title)}${extra}`;
  const p4Pills = () => page.locator("main nav[aria-label='Filtrar oportunidades'] a");
  const p4CurrentPill = () =>
    page.locator("main nav[aria-label='Filtrar oportunidades'] a[aria-current]").textContent();
  const p4Card = () => page.locator("main article", { hasText: p4Title }).first();
  const p4MiniDay = (date) => page.locator(`main ol[aria-label] button[aria-label^='${date}:']`);
  const p4Tile = (row) =>
    row
      .locator("span[aria-hidden]")
      .first()
      .evaluate((el) => ({
        className: el.className,
        shown: getComputedStyle(el).display !== "none",
      }));
  try {
    await login(DELTA);
    await page.goto(`${BASE}/app/settings`);
    await page.waitForLoadState("networkidle");
    await page.locator("[role=radio][lang=es]").first().click();
    await page.waitForSelector("[role=status]:has-text('Idioma actualizado')", { timeout: 15000 });
    const p4ListText = await p4Open(p4ListUrl());
    await expectSpanish("PKG P04 4 opportunities in Spanish");
    const p4CardText = (await p4Card().innerText()).replace(/\s+/g, " ");
    const p4Facts = `${p4Short(p4Start)} → ${p4Short(p4End)} · 2 días · 2 personas · Bloque completo`;
    ok(
      "PKG P04 4b v1.8 list: «Oportunidades» / «Trabajo que encaja contigo.» / the eligibility sentence, «Buscar oportunidad» («Aeronave, base o empresa…», «Buscar»), the five pills with «Todas» current, «1 oportunidad · página 1 de 1»; the card: «Planificado», «Demo MRO Madrid · Madrid (MAD) · España», «400 € / día · 50 € / h», «{día} → {día} · 2 días · 2 personas · Bloque completo», B1.1 / TR-A320, «Cumples requisitos y disponibilidad», «Ver detalle» + «Preparar candidatura»",
      /^OPORTUNIDADES /i.test(p4ListText) &&
        [
          "Trabajo que encaja contigo.",
          "Elegibilidad técnica y disponibilidad se evalúan por separado. Un porcentaje no sustituye un requisito obligatorio.",
          "Buscar oportunidad",
          "1 oportunidad · página 1 de 1",
        ].every((s) => p4ListText.includes(s)) &&
        (await page.locator("main input[name=q]").getAttribute("placeholder")) ===
          "Aeronave, base o empresa…" &&
        (await page.getByRole("button", { name: "Buscar" }).count()) === 1 &&
        (await p4Pills().allTextContents()).join("|") ===
          "Todas|Compatibles|Planificado|Urgente|AOG" &&
        (await p4CurrentPill()) === "Todas" &&
        p4CardText.startsWith("Planificado") &&
        [
          "Demo MRO Madrid · Madrid (MAD) · España",
          "400 € / día · 50 € / h",
          p4Facts,
          "B1.1",
          "TR-A320",
          "Cumples requisitos y disponibilidad",
        ].every((s) => p4CardText.includes(s)) &&
        (await p4Card().getByRole("link", { name: "Ver detalle" }).count()) === 1 &&
        (await p4Card().getByRole("link", { name: "Preparar candidatura" }).count()) === 1,
      p4CardText.slice(0, 260),
    );
    const p4Eligible = await p4Open(p4ListUrl("&eligible=1"));
    const p4Empty = await p4Open(p4ListUrl("&urgency=aog"));
    ok(
      "PKG P04 5 «Compatibles» keeps the need; «AOG» → «Sin ofertas para este filtro» / «Prueba otra búsqueda o revisa tu perfil y fechas.» with «AOG» current",
      p4Eligible.includes(p4Title) &&
        p4Empty.includes("Sin ofertas para este filtro") &&
        p4Empty.includes("Prueba otra búsqueda o revisa tu perfil y fechas.") &&
        (await p4CurrentPill()) === "AOG",
      "",
    );
    // SHOT-10 #9 and MKT-03 #1: no horizontal overflow at the five widths; the v1.8 dock «Ofertas» below lg.
    await p4Open(p4ListUrl());
    await responsiveShots("P04-opportunities-es");
    for (const width of [1024, 390, 360]) {
      await page.setViewportSize({ width, height: width < 800 ? 1100 : 900 });
      await page.waitForTimeout(300);
      const p4Overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      const p4Dock = await page.evaluate(() => {
        const nav = document.querySelector("nav[aria-label='Accesos rápidos']");
        if (!nav) return null;
        return {
          position: getComputedStyle(nav).position,
          atBottom: Math.round(nav.getBoundingClientRect().bottom) === window.innerHeight,
          current: nav.querySelector("a[aria-current=page]")?.textContent?.trim() ?? "",
        };
      });
      ok(
        width < 1024
          ? `PKG P04 5b @${width}: no horizontal overflow; the v1.8 dock is fixed at the bottom with «Ofertas» current`
          : `PKG P04 5b @${width}: no horizontal overflow; the dock is hidden from lg`,
        !p4Overflow &&
          (width < 1024
            ? p4Dock?.position === "fixed" && p4Dock.atBottom && p4Dock.current === "Ofertas"
            : p4Dock === null ||
              !(await page.locator("nav[aria-label='Accesos rápidos']").isVisible())),
        JSON.stringify(p4Dock),
      );
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    // «Preparar candidatura» lands on the detail's application panel (v2-26).
    await p4Open(p4ListUrl());
    await p4Card().getByRole("link", { name: "Preparar candidatura" }).click();
    await page.waitForURL(
      (u) => u.pathname === `/app/professional/opportunities/${p4Id}` && u.hash === "#apply",
      { timeout: 30000 },
    );
    await page.waitForLoadState("networkidle");
    const p4DetailText = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    const p4Has = (re) => re.test(p4DetailText);
    ok(
      "PKG P04 6 detail (MKT-04): «Oportunidad», «Publicada por Demo MRO Madrid», «Volver a oportunidades», «Ubicación Madrid (MAD) · España», «Zona horaria Europe/Madrid», the description, «Tarifa 50 € / h · 400 € / día», «Turno y duración Día · 8 h», «Contrato Contractor · EUR», «Dietas / horas extra 30 € / día · 60 € / h extra», «Cobertura Bloque completo…», «Incorporación», «Movilización máxima 48 h», «Presupuesto preferencia negociable», the logistics, the informative notice",
      [
        /^OPORTUNIDAD /i,
        new RegExp(`Publicada por Demo MRO Madrid`),
        /Volver a oportunidades/,
        /Ubicación\s*Madrid \(MAD\) · España/i,
        /Zona horaria\s*Europe\/Madrid/i,
        new RegExp(p4Description.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
        /Tarifa\s*50 € \/ h · 400 € \/ día/i,
        /Turno y duración\s*Día · 8 h/i,
        /Contrato\s*Contractor · EUR/i,
        /Dietas \/ horas extra\s*30 € \/ día · 60 € \/ h extra/i,
        /Cobertura\s*Bloque completo: una candidatura cubre todas las jornadas/i,
        /Incorporación\s*Antes del inicio del turno/i,
        /Movilización máxima\s*48 h/i,
        /Presupuesto\s*preferencia negociable/i,
        /Logística\s*Vuelos: incluido Alojamiento: incluido Transporte local: incluido Comidas: no incluidas Herramientas de empresa/i,
        /Valores informativos de la organización: CrewFlex no gestiona cobros, comisiones ni pagos\./,
      ].every(p4Has),
      p4DetailText.slice(0, 300),
    );
    ok(
      "PKG P04 6b own eligibility (MKT-04 #9, D-12): «Tu elegibilidad» + «Cumples los requisitos obligatorios y la disponibilidad.», ✓ B1.1 and TR-A320 verified, «Disponibilidad · Cubre toda la necesidad», the passport note",
      p4Has(/Tu elegibilidad\s*Cumples los requisitos obligatorios y la disponibilidad\./i) &&
        p4Has(/B1\.1\s*Cumple:\s*Verificada/) &&
        p4Has(/TR-A320\s*Cumple:\s*Verificada/) &&
        p4Has(/Disponibilidad\s*Cumple:\s*Cubre toda la necesidad/) &&
        p4Has(
          /Calculada con tu pasaporte y tu disponibilidad\. Publicar una necesidad no te hace elegible\./,
        ),
      "",
    );
    const p4Consent = page.getByRole("checkbox", {
      name: "Autorizo compartir con Demo MRO Madrid estos datos para esta necesidad.",
    });
    const p4Submit = page.getByRole("button", { name: "Presentar candidatura" });
    ok(
      "PKG P04 7 «Candidatura» (MKT-05): «Qué verá Demo MRO Madrid» with its lines and «Las candidaturas no reservan el calendario…», the preview «Qué compartes con Demo MRO Madrid» (Vista previa, «Experiencia que compartes», «Mínimo declarado: 45,00 € / hora», originals protected, no real name), the consent unchecked and «Presentar candidatura» disabled",
      [
        "Qué verá Demo MRO Madrid",
        "Tus cualificaciones relevantes para esta necesidad, con su verificación y caducidad.",
        "Tu disponibilidad durante el periodo de la necesidad.",
        "Nunca tu contacto ni tus documentos: siguen protegidos.",
        "Las candidaturas no reservan el calendario: solo una asignación confirmada protege sus días.",
        "Qué compartes con Demo MRO Madrid",
        "Vista previa",
        "Experiencia que compartes",
        "Mínimo declarado: 45,00 € / hora",
        "Los originales, nombres de archivos y metadatos identificativos permanecen protegidos.",
        "El expediente no incluye nombre real, contacto, empresa actual, organizaciones bloqueadas ni documentos.",
      ].every((s) => p4DetailText.includes(s)) &&
        !p4DetailText.includes("Technician Delta") &&
        !(await p4Consent.isChecked()) &&
        (await p4Submit.isDisabled()),
      "",
    );
    await p4Consent.check();
    await p4Submit.click();
    await page.waitForSelector(
      "[role=status]:has-text('Candidatura enviada. La organización la verá en su lista.')",
      { timeout: 20000 },
    );
    await page.reload();
    await page.waitForLoadState("networkidle");
    const p4AfterText = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    const p4ToApplications = await page.getByRole("link", { name: "Ver mis candidaturas" }).count();
    await p4Open(p4ListUrl());
    const p4CardAfter = (await p4Card().innerText()).replace(/\s+/g, " ");
    ok(
      "PKG P04 8 applied with the consent: «Candidatura enviada…»; on reload «Ya tienes una candidatura en curso (recibida).» + «Ver mis candidaturas»; the card shows «Candidatura: Recibida» and «Ya presentada» disabled",
      p4AfterText.includes("Ya tienes una candidatura en curso (recibida).") &&
        p4ToApplications === 1 &&
        p4CardAfter.includes("Candidatura: Recibida") &&
        (await p4Card().getByRole("button", { name: "Ya presentada" }).isDisabled()),
      p4CardAfter.slice(0, 200),
    );
    // P01-22 / P01-23: the «Mi espacio» rows with their data (the compatible need and the rest-day one).
    await p4Open(`/app/professional?month=${p4Start.slice(0, 7)}`);
    await p4MiniDay(p4Start).click();
    const p4Row = page.locator("main li", { hasText: p4Title }).first();
    const p4RowTile = await p4Tile(p4Row);
    const p4RowText = (await p4Row.innerText()).replace(/\s+/g, " ");
    const p4Offer = p4Row.getByRole("link", { name: `Ver oferta · ${p4Title}` });
    ok(
      "PKG P04 9 P01-22/P01-23 «Mi espacio»: the compatible row carries the calendar tile in the ok tone, «Demo MRO Madrid · Madrid (MAD) · B1.1, TR-A320», «Requisitos y disponibilidad compatibles», «50 € / h» and «Ver oferta» → its detail",
      /bg-ok-bg/.test(p4RowTile.className) &&
        p4RowTile.shown &&
        p4RowText.includes("Demo MRO Madrid · Madrid (MAD) · B1.1, TR-A320") &&
        p4RowText.includes("Requisitos y disponibilidad compatibles") &&
        p4RowText.includes("50 € / h") &&
        (await p4Offer.getAttribute("href")) === `/app/professional/opportunities/${p4Id}`,
      `${p4RowTile.className} · ${p4RowText.slice(0, 160)}`,
    );
    await p4Open(`/app/professional?month=${p4RestStart.slice(0, 7)}`);
    const p4RestLabel = (await p4MiniDay(p4RestStart).getAttribute("aria-label")) ?? "";
    await p4MiniDay(p4RestStart).click();
    const p4RestRow = page.locator("main li", { hasText: p4RestTitle }).first();
    const p4RestTile = await p4Tile(p4RestRow);
    const p4RestText = (await p4RestRow.innerText()).replace(/\s+/g, " ");
    const p4Review = p4RestRow.getByRole("link", { name: `Revisar fechas · ${p4RestTitle}` });
    ok(
      "PKG P04 9b P01-22 the «posible en descanso» row (BR-14.1): red tile, «Posible en descanso: revisa y publica tus fechas», no rate, «Revisar fechas» → that month's calendar; the day's label ends «…, revisa la publicación de descanso»",
      /bg-danger-bg/.test(p4RestTile.className) &&
        p4RestTile.shown &&
        p4RestText.includes("Posible en descanso: revisa y publica tus fechas") &&
        !/ \/ h/.test(p4RestText) &&
        (await p4Review.getAttribute("href")) ===
          `/app/professional/availability?month=${p4RestStart.slice(0, 7)}` &&
        /revisa la publicación de descanso$/.test(p4RestLabel),
      `${p4RestTile.className} · ${p4RestLabel}`,
    );
    await page.goto(`${BASE}/app/settings`);
    await page.waitForLoadState("networkidle");
    await page.locator("[role=radio][lang=en]").first().click();
    await page.waitForSelector("[role=status]:has-text('Language updated')", { timeout: 15000 });
    await logout();
    // MKT-03 #2 «Ofertas en la red» (v2-20, T-90): another organization, then the publisher, then the URL.
    await login("admin.other@crewflex.test");
    const p4Network = await p4Open(`/app/organization/network?q=${encodeURIComponent(p4Title)}`);
    const p4NetCard = page.locator("main article", { hasText: p4Title }).first();
    const p4NetCardText = (await p4NetCard.innerText().catch(() => "")).replace(/\s+/g, " ");
    const p4NetDetail = await p4NetCard.getByRole("link", { name: "View details" }).count();
    // Counted on this page: after the logout the locator would query the publisher's page.
    const p4NetCards = await p4NetCard.count();
    await logout();
    await login(MRO);
    const p4NetworkOwn = await p4Open(`/app/organization/network?q=${encodeURIComponent(p4Title)}`);
    const p4OrgUrl = `${BASE}/app/professional/opportunities/${p4Id}`;
    expectedErrorUrls.add(p4OrgUrl);
    const p4OrgResponse = await page.goto(p4OrgUrl);
    expectedErrorUrls.delete(p4OrgUrl);
    await logout();
    ok(
      "PKG P04 10 «Ofertas en la red» (MKT-03 #2): another organization lists the need with the same facts and «View details», no eligibility, no «Prepare application», no commission; Demo MRO Madrid does not see its own (T-90); an organization account on the professional URL → HTTP 404",
      p4Network.includes("Offers in the network.") &&
        p4NetCards === 1 &&
        /€400 \/ day · €50 \/ h/.test(p4NetCardText) &&
        /2 days · 2 people · Full block/.test(p4NetCardText) &&
        p4NetDetail === 1 &&
        !/You meet the requirements|Prepare application|ommission/.test(p4NetCardText) &&
        p4NetworkOwn.includes("No requirements for this filter") &&
        p4OrgResponse?.status() === 404,
      JSON.stringify({
        header: p4Network.includes("Offers in the network."),
        cards: p4NetCards,
        detail: p4NetDetail,
        card: p4NetCardText.slice(0, 400),
        own: p4NetworkOwn.slice(0, 400),
        status: p4OrgResponse?.status(),
      }),
    );
  } finally {
    // Seed state back whatever happened: delta in English (later English-asserting blocks), the application
    // withdrawn, no block, the window deleted, the needs closed and archived, the draft archived.
    try {
      if ((await page.evaluate(() => location.pathname)).startsWith("/app")) await logout();
    } catch {
      /* the page may be mid-navigation; the API restore below does not need it */
    }
    await asSeedUser(DELTA, "user-preferences", { method: "PATCH", body: { locale: "en" } });
    const p4App = (await p4Applications(DELTA)).find((a) => a.requirementId === p4Id);
    const p4Withdrawn = p4App
      ? await asSeedUser(DELTA, "applications", {
          method: "PATCH",
          headers: p4Key(),
          body: { applicationId: p4App.id, to: "withdrawn", expectedUpdatedAt: p4App.updatedAt },
        })
      : { data: { transition: { status: "withdrawn" } } };
    const p4BlocksLeft = (await p4Profile())?.blockedOrganizationIds ?? [];
    const p4BlocksOk = p4BlocksLeft.length === 0 || (await p4SetBlocks([])).ok === true;
    const p4Deleted = p4Window.data?.window
      ? (
          await asSeedUser(DELTA, "professional-availability", {
            method: "DELETE",
            query: { id: p4Window.data.window.id },
          })
        ).data?.deleted === true
      : false;
    const p4Archived = [];
    for (const id of [p4Id, p4RestId, p4PausedId]) {
      if (!id) continue;
      const closed = await asSeedUser(MRO, "work-requirements", {
        method: "PATCH",
        body: { id, status: "closed" },
      });
      const archived = closed.ok
        ? await asSeedUser(MRO, "work-requirements", {
            method: "PATCH",
            body: { id, archive: true },
          })
        : closed;
      p4Archived.push(archived.ok === true);
    }
    if (p4DraftId)
      p4Archived.push(
        (
          await asSeedUser(MRO, "work-requirements", {
            method: "PATCH",
            body: { id: p4DraftId, archive: true },
          })
        ).ok === true,
      );
    ok(
      "PKG P04 11 restore: the application withdrawn, no block left, the window deleted, the three needs closed and archived, the draft archived, delta in English (seed state back)",
      p4Withdrawn.data?.transition?.status === "withdrawn" &&
        p4BlocksOk &&
        p4Deleted &&
        p4Archived.length === 4 &&
        p4Archived.every(Boolean),
      JSON.stringify([p4Withdrawn.error, p4BlocksLeft.length, p4Deleted, p4Archived]),
    );
  }
}

// PKG P05 (applications parity, F3 — HIRE-01 #1-#6/#8/#9/#12/#13, HIRE-02 #5/#9/#16/#18/#19/#21/#24, HIRE-03 #3-#7,
// HIRE-04 #1/#7/#8/#11, HIRE-05 #1/#4/#5/#7/#9/#14, SHOT-11 #4/#5; P01-26; T-165): the v1.8 «Mis candidaturas» and
// «Candidaturas» («De candidatura a cobertura.») in Spanish — the home row «{empresa} · {n} jornadas», the card
// («{org} · {base} · {periodo} · {n} jornadas», the frozen proposal with its terms and «{h} h × {tarifa} €/h = {base}»,
// «Historial», «Ver expediente» with the dated copy), accepting after the explicit tick, the organization-wide list
// filtered by the offer («Oferta seleccionada», «Ver todas», «Volver a ofertas», «Todas ({n})» + the 9 tabs, the
// pseudonym and the open name), rejecting with a mandatory reason, the empty tab, confirming («Cubierta»,
// «100% cobertura confirmada», «1 / 1 plazas confirmadas», «Finalizar» disabled, the cancel hint), the covered note in
// the neutral tone on the technician's own confirmed card and the technician's cancellation with a reason (Q3).
// Negatives: a plain member is refused (page and API), another organization gets 404 (API, pack and URL), another
// technician cannot move the application (404), the wrong side gets 403, a professional on the organization URL is
// sent home. Fixture through the local API (a 1-seat need with two shifts and terms ≥ 35 days ahead on days free of
// delta's and echo's windows; both apply; delta proposed); everything is restored at the end whatever happens.
{
  const DELTA = "delta@crewflex.test";
  const ECHO = "echo@crewflex.test";
  const MRO = "admin.mro@crewflex.test";
  const OTHER = "admin.other@crewflex.test";
  const p5Key = () => ({ "Idempotency-Key": crypto.randomUUID() });
  const p5Day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const p5Short = (d) =>
    new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", timeZone: "UTC" })
      .format(new Date(`${d}T00:00:00Z`))
      .toUpperCase();
  const p5Windows = async (email) =>
    (await asSeedUser(email, "professional-availability")).data?.windows ?? [];
  const p5Existing = [...(await p5Windows(DELTA)), ...(await p5Windows(ECHO))];
  // The first 3-day span from `from` days ahead with no window of either professional (a 2-day need fits).
  const p5Free = (from) => {
    for (let n = from; n < from + 180; n++) {
      const s = Date.parse(`${p5Day(n)}T00:00:00.000Z`);
      const e = s + 3 * 86_400_000;
      if (!p5Existing.some((w) => Date.parse(w.startsAt) < e && Date.parse(w.endsAt) > s)) return n;
    }
    return from;
  };
  const p5N = p5Free(35);
  const p5Start = p5Day(p5N);
  const p5End = p5Day(p5N + 1);
  const p5Period = `${p5Short(p5Start)} → ${p5Short(p5End)}`;
  const p5Title = `Local UI check · P05 candidaturas ${Date.now()}`;
  const p5Reason = "Local UI check · P05 motivo del rechazo";
  const p5CancelReason = "Local UI check · P05 cancelada por el técnico";
  // The nine states in the domain order (`APPLICATION_STATUSES`) and their Spanish labels (es `domain.applicationStatus`).
  const APPLICATION_ORDER = [
    "received",
    "shortlisted",
    "proposed",
    "accepted",
    "confirmed",
    "finished",
    "rejected",
    "withdrawn",
    "cancelled",
  ];
  const p5Labels = [
    "Recibida",
    "Preseleccionada",
    "Propuesta",
    "Aceptada",
    "Confirmada",
    "Finalizada",
    "Rechazada",
    "Retirada",
    "Cancelada",
  ];
  const p5Need = await asSeedUser(MRO, "work-requirements", {
    method: "POST",
    headers: p5Key(),
    body: {
      organizationId: mroOrg.id,
      title: p5Title,
      location: "Madrid (MAD)",
      startsAt: `${p5Start}T06:00:00.000Z`,
      endsAt: `${p5End}T18:00:00.000Z`,
      shift: "day",
      headcount: 1,
      urgency: "planned",
      country: "ES",
      timeZone: "Europe/Madrid",
      qualifications: hiringTypes.map((q) => ({ qualificationTypeId: q.id, level: "hard" })),
      description: "Revisión programada de línea en hangar; se valora experiencia previa en A320.",
      shifts: [
        { startsAt: `${p5Start}T06:00:00.000Z`, endsAt: `${p5Start}T14:00:00.000Z`, baseHours: 8 },
        { startsAt: `${p5End}T10:00:00.000Z`, endsAt: `${p5End}T18:00:00.000Z`, baseHours: 8 },
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
  const p5Id = p5Need.data?.requirement?.id;
  const p5Win = {};
  const p5App = {};
  try {
    for (const email of [DELTA, ECHO]) {
      const w = await asSeedUser(email, "professional-availability", {
        method: "POST",
        headers: p5Key(),
        body: {
          startsAt: `${p5Start}T00:00:00.000Z`,
          endsAt: `${p5Day(p5N + 2)}T00:00:00.000Z`,
          status: "available",
        },
      });
      p5Win[email] = w.data?.window?.id;
      const a = await asSeedUser(email, "applications", {
        method: "POST",
        headers: p5Key(),
        body: { requirementId: p5Id, shareConsent: true },
      });
      p5App[email] = { id: a.data?.application?.id, updatedAt: a.data?.application?.updatedAt };
    }
    const p5Move = async (email, app, to, extra = {}) => {
      const res = await asSeedUser(email, "applications", {
        method: "PATCH",
        headers: p5Key(),
        body: { applicationId: app.id, to, expectedUpdatedAt: app.updatedAt, ...extra },
      });
      if (res.data) app.updatedAt = res.data.transition.updatedAt;
      return res;
    };
    await p5Move(MRO, p5App[DELTA], "shortlisted");
    const p5Proposed = await p5Move(MRO, p5App[DELTA], "proposed");
    ok(
      "PKG P05 0 fixture (API): a 1-seat need with two 8 h shifts and terms (≥ 35 days ahead, days free of delta's and echo's windows); both apply; delta's application is proposed (v1), echo's received",
      p5Need.data?.requirement?.status === "open" &&
        p5Need.data?.requirement?.shifts?.length === 2 &&
        Boolean(p5Win[DELTA] && p5Win[ECHO] && p5App[DELTA].id && p5App[ECHO].id) &&
        p5Proposed.data?.transition?.status === "proposed",
      JSON.stringify({ start: p5Start, errors: [p5Need.error, p5Proposed.error].filter(Boolean) }),
    );

    // Identity from the JWT (S-2, HIRE-02 #19): the wrong side, a stranger, another organization, a plain member.
    const p5WrongSide = await asSeedUser(ECHO, "applications", {
      method: "PATCH",
      headers: p5Key(),
      body: {
        applicationId: p5App[ECHO].id,
        to: "shortlisted",
        expectedUpdatedAt: p5App[ECHO].updatedAt,
      },
    });
    const p5Stranger = await asSeedUser(ECHO, "applications", {
      method: "PATCH",
      headers: p5Key(),
      body: {
        applicationId: p5App[DELTA].id,
        to: "withdrawn",
        expectedUpdatedAt: p5App[DELTA].updatedAt,
      },
    });
    const p5OtherList = await asSeedUser(OTHER, "applications", { query: { requirementId: p5Id } });
    const p5OtherMove = await asSeedUser(OTHER, "applications", {
      method: "PATCH",
      headers: p5Key(),
      body: {
        applicationId: p5App[DELTA].id,
        to: "confirmed",
        expectedUpdatedAt: p5App[DELTA].updatedAt,
      },
    });
    const p5OtherPack = await asSeedUser(OTHER, "applications", {
      query: { view: "pack", applicationId: p5App[DELTA].id },
    });
    const p5MemberList = await asSeedUser("charlie@crewflex.test", "applications", {
      query: { organizationId: mroOrg.id, view: "list", offset: "0", limit: "20" },
    });
    const p5MemberOne = await asSeedUser("charlie@crewflex.test", "applications", {
      query: { requirementId: p5Id },
    });
    ok(
      "PKG P05 1 negatives (API): the technician cannot take the organization's step (403), nor move another's application (404); another organization reads, moves and opens the pack as 404; a plain member is FORBIDDEN on both lists",
      p5WrongSide.error?.code === "FORBIDDEN" &&
        p5Stranger.error?.code === "NOT_FOUND" &&
        p5OtherList.error?.code === "NOT_FOUND" &&
        p5OtherMove.error?.code === "NOT_FOUND" &&
        p5OtherPack.error?.code === "NOT_FOUND" &&
        p5MemberList.error?.code === "FORBIDDEN" &&
        p5MemberOne.error?.code === "FORBIDDEN",
      JSON.stringify([
        p5WrongSide.error?.code,
        p5Stranger.error?.code,
        p5OtherList.error?.code,
        p5OtherMove.error?.code,
        p5OtherPack.error?.code,
        p5MemberList.error?.code,
        p5MemberOne.error?.code,
      ]),
    );

    const p5Open = async (path) => {
      await page.goto(`${BASE}${path}`);
      await page.waitForLoadState("networkidle");
      return (await page.locator("main").innerText()).replace(/\s+/g, " ");
    };
    const p5Es = async () => {
      await page.goto(`${BASE}/app/settings`);
      await page.waitForLoadState("networkidle");
      if ((await page.evaluate(() => document.documentElement.lang)) === "es") return;
      await page.locator("[role=radio][lang=es]").first().click();
      await page.waitForSelector("[role=status]:has-text('Idioma actualizado')", {
        timeout: 15000,
      });
    };
    const p5Done = (status) =>
      page
        .getByRole("status")
        .filter({ hasText: `Hecho: ${status}.` })
        .first()
        .waitFor({ timeout: 15000 })
        .then(() => true)
        .catch(() => false);

    await login(DELTA);
    await p5Es();
    // P01-26: the home row «{empresa} · {n} jornadas» (the days of the two published shifts).
    const p5Home = await p5Open("/app/professional");
    const p5HomeRow = page
      .locator("section[aria-labelledby=home-applications] li", { hasText: p5Title })
      .first();
    const p5HomeRowText = (await p5HomeRow.innerText().catch(() => "")).replace(/\s+/g, " ");
    const p5Follow = await p5HomeRow
      .getByRole("link", { name: /Ver seguimiento/ })
      .getAttribute("href")
      .catch(() => null);
    ok(
      "PKG P05 2 P01-26 «Mi espacio»: the «Mis candidaturas» row carries the title, «Demo MRO Madrid · 2 jornadas», the chip «Propuesta» and «Ver seguimiento» → the card",
      /Mis candidaturas/.test(p5Home) &&
        p5HomeRowText.includes(p5Title) &&
        p5HomeRowText.includes("Demo MRO Madrid · 2 jornadas") &&
        /Propuesta/.test(p5HomeRowText) &&
        p5Follow === `/app/professional/applications#a-${p5App[DELTA].id}`,
      JSON.stringify({ row: p5HomeRowText.slice(0, 200), follow: p5Follow }),
    );

    const p5Mine = await p5Open("/app/professional/applications");
    await expectSpanish("PKG P05 3 «Mis candidaturas» in Spanish");
    const p5Card = () => page.locator("main article", { hasText: p5Title }).first();
    const p5CardText = (await p5Card().innerText()).replace(/\s+/g, " ");
    const p5Pills = await page.locator("main nav a").allInnerTexts();
    ok(
      "PKG P05 3b v1.8 «Mis candidaturas»: «Mi actividad» / «Tus candidaturas.» / the three-step sentence; «Todas (n)» current + the present states; the card: «Propuesta», the title as a link, «Demo MRO Madrid · Madrid (MAD) · {periodo} · 2 jornadas», «Propuesta · versión 1 · Pendiente de aceptación», «Enviada el», the frozen terms («Tarifa 50,00 € / h · 400,00 € / día», «Turno y duración Día · 8 h», «Contrato», «Dietas / horas extra 30,00 € / día · 60,00 € / h extra», «Cobertura», «Logística», «Vuelos: incluido», «16 h × 50,00 €/h = 800,00 € para el técnico», «16 horas base en 2 jornadas»), the notice, «Historial», «Ver expediente», «Aceptar propuesta» and «Retirar candidatura»",
      /Mi actividad/i.test(p5Mine) &&
        p5Mine.includes("Tus candidaturas.") &&
        p5Mine.includes("La empresa revisa condiciones; el técnico acepta; la empresa confirma.") &&
        /^Todas \(\d+\)$/.test(p5Pills[0] ?? "") &&
        (await page.locator("main nav a[aria-current=true]").innerText()).startsWith("Todas") &&
        p5Pills.includes("Propuesta") &&
        (await p5Card().getByRole("link", { name: p5Title }).getAttribute("href")) ===
          `/app/professional/opportunities/${p5Id}` &&
        p5CardText.includes(`Demo MRO Madrid · Madrid (MAD) · ${p5Period} · 2 jornadas`) &&
        /Propuesta · versión 1\s*· Pendiente de aceptación/.test(p5CardText) &&
        /Enviada el /.test(p5CardText) &&
        // Term labels are CSS-uppercased (`innerText` keeps the transform); amounts drop «,00» (P04-04).
        /Tarifa 50 € \/ h · 400 € \/ día/i.test(p5CardText) &&
        /Turno y duración Día · 8 h/i.test(p5CardText) &&
        /Contrato Contractor · EUR/i.test(p5CardText) &&
        /Dietas \/ horas extra 30 € \/ día · 60 € \/ h extra/i.test(p5CardText) &&
        /Cobertura Bloque completo: una candidatura cubre todas las jornadas/i.test(p5CardText) &&
        /Logística Vuelos: incluido · Alojamiento: incluido · Transporte local: incluido · Comidas: no incluidas/i.test(
          p5CardText.replace(/ (Alojamiento|Transporte|Comidas)/g, " · $1"),
        ) &&
        p5CardText.includes("16 h × 50 €/h = 800 € para el técnico") &&
        p5CardText.includes("16 horas base en 2 jornadas") &&
        p5CardText.includes(
          "CrewFlex intermedia; el contrato de trabajo o de prestación se acuerda directamente entre las partes.",
        ) &&
        p5CardText.includes("Historial") &&
        (await p5Card().getByRole("link", { name: "Ver expediente" }).count()) === 1 &&
        (await p5Card().getByRole("button", { name: "Aceptar propuesta" }).count()) === 1 &&
        (await p5Card().getByRole("button", { name: "Retirar candidatura" }).count()) === 1,
      JSON.stringify({ pills: p5Pills, card: p5CardText.slice(0, 700) }),
    );

    // HIRE-01 #5 / SHOT-11 #3: a `?status=` the technician has nothing in (only by URL: the pills list the present
    // states) shows v1.8's empty state instead of a blank list.
    const p5Codes = APPLICATION_ORDER;
    const p5AbsentIdx = p5Labels.findIndex((label) => !p5Pills.includes(label));
    const p5AbsentTab = await p5Open(
      `/app/professional/applications?status=${p5Codes[p5AbsentIdx] ?? "finished"}`,
    );
    ok(
      "PKG P05 3c a `?status=` the technician has nothing in (by URL): «Sin candidaturas en este estado» / «Selecciona otra oferta o prepara una candidatura.», the pills stay «Todas (n)» + the present states, no card",
      p5AbsentIdx >= 0 &&
        p5AbsentTab.includes("Sin candidaturas en este estado") &&
        p5AbsentTab.includes("Selecciona otra oferta o prepara una candidatura.") &&
        (await page.locator("main article").count()) === 0 &&
        (await page.locator("main nav a").allInnerTexts()).join("|") === p5Pills.join("|"),
      JSON.stringify({ status: p5Codes[p5AbsentIdx], text: p5AbsentTab.slice(0, 160) }),
    );
    await p5Open("/app/professional/applications");

    // Responsive «Mis candidaturas» (SHOT-11 #7): no overflow at the five widths; the v1.8 dock below `lg`.
    for (const width of [1440, 1024, 768, 390, 360]) {
      await page.setViewportSize({ width, height: width < 800 ? 1100 : 900 });
      await page.waitForTimeout(300);
      const p5Layout = await page.evaluate(() => {
        const nav = document.querySelector("nav[aria-label='Accesos rápidos']");
        const current = nav?.querySelector("a[aria-current=page]");
        const visible = nav ? getComputedStyle(nav).display !== "none" : false;
        return {
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          dock: visible
            ? {
                position: getComputedStyle(nav).position,
                bottom: Math.round(nav.getBoundingClientRect().bottom),
                current: current?.textContent?.trim() ?? "",
              }
            : null,
        };
      });
      ok(
        width < 1024
          ? `PKG P05 4 @${width}: no horizontal overflow; the v1.8 dock is fixed at the bottom with «Candidaturas» current`
          : `PKG P05 4 @${width}: no horizontal overflow; the dock is hidden from lg`,
        !p5Layout.overflow &&
          (width < 1024
            ? p5Layout.dock?.position === "fixed" &&
              p5Layout.dock.bottom === 1100 &&
              p5Layout.dock.current === "Candidaturas"
            : p5Layout.dock === null),
        JSON.stringify(p5Layout),
      );
      if (width === 1440 || width === 390) await shot(`p05-applications-${width}`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });

    // R-08: accept exactly version 1 after the tick.
    await p5Card().getByRole("button", { name: "Aceptar propuesta" }).click();
    const p5AcceptStep = p5Card().getByRole("group", { name: "Aceptar propuesta" });
    const p5AcceptButton = p5AcceptStep.getByRole("button", { name: "Aceptar propuesta" });
    const p5DisabledBeforeTick = await p5AcceptButton.isDisabled();
    await p5AcceptStep
      .getByRole("checkbox", { name: "Acepto exactamente estas condiciones (versión 1)." })
      .check();
    await p5AcceptButton.click();
    const p5Accepted = await p5Done("Aceptada");
    await page.reload();
    await page.waitForLoadState("networkidle");
    // The history is a folded `<details>` (HIRE-01 #9): open it, or `innerText` leaves it out.
    await p5Card().locator("details summary", { hasText: "Historial" }).click();
    const p5AcceptedText = (await p5Card().innerText()).replace(/\s+/g, " ");
    ok(
      "PKG P05 5 «Aceptar propuesta» (R-08): disabled until «Acepto exactamente estas condiciones (versión 1).» is ticked; «Hecho: Aceptada.»; the card reads «Aceptada», «Condiciones aceptadas · versión 1» and the history «Aceptada · … · profesional · v1»",
      p5DisabledBeforeTick &&
        p5Accepted &&
        /^Aceptada/.test(p5AcceptedText) &&
        p5AcceptedText.includes("Condiciones aceptadas · versión 1") &&
        /Aceptada · [^·]+ · profesional · v1/.test(p5AcceptedText),
      p5AcceptedText.slice(0, 300),
    );

    // v2-15 / HIRE-05: the professional's own dated copy, pseudonymous, protected.
    await p5Card().getByRole("link", { name: "Ver expediente" }).click();
    await page.waitForLoadState("networkidle");
    const p5OwnPack = (
      await page
        .locator(`#pack-${p5App[DELTA].id}`)
        .innerText()
        .catch(() => "")
    ).replace(/\s+/g, " ");
    ok(
      "PKG P05 6 «Ver expediente» (own copy): «CREWFLEX» + «Expediente compartido», «Esta es la copia que recibió Demo MRO Madrid…», «Cualificaciones» («Aeronaves:», «Motores:»), «Cursos», «Capacidades», «Permisos de trabajo», «Restricciones generales», «Experiencia compartida», the protection sentence, «Copia del perfil:»; no e-mail; «Cerrar expediente»",
      p5OwnPack.includes("CREWFLEX") &&
        p5OwnPack.includes("Expediente compartido") &&
        p5OwnPack.includes(
          "Esta es la copia que recibió Demo MRO Madrid al presentar tu candidatura.",
        ) &&
        p5OwnPack.includes("Cualificaciones") &&
        p5OwnPack.includes("Aeronaves:") &&
        p5OwnPack.includes("Motores:") &&
        p5OwnPack.includes("Cursos") &&
        p5OwnPack.includes("Capacidades") &&
        p5OwnPack.includes("Permisos de trabajo") &&
        p5OwnPack.includes("Restricciones generales") &&
        p5OwnPack.includes("Experiencia compartida") &&
        p5OwnPack.includes(
          "Los originales, nombres de archivos y metadatos identificativos permanecen protegidos.",
        ) &&
        p5OwnPack.includes("Copia del perfil:") &&
        !/@crewflex\.test/.test(p5OwnPack) &&
        (await p5Card().getByRole("link", { name: "Cerrar expediente" }).count()) === 1,
      p5OwnPack.slice(0, 300),
    );
    await shot("p05-pack-1440");
    await logout();

    // The organization-wide «Candidaturas» (v2-05, v1.8 `Workflow.jsx:53-74`) filtered by the offer.
    await login(MRO, { ensureEnglish: false });
    await p5Es();
    // ORG-04 #22 (2026-10-29): the need's row on «Necesidades» carries v1.8's «{tarifa} €/h · {h} horas base».
    await page.goto(`${BASE}/app/organization/requirements`);
    await page.waitForLoadState("networkidle");
    const p5RowLoc = page.locator(`main tr:has(a[href='/app/organization/requirements/${p5Id}'])`);
    const p5Row = (await p5RowLoc.count())
      ? (await p5RowLoc.first().innerText()).replace(/\s+/g, " ")
      : "";
    ok(
      "PKG ORG-04 22 «Necesidades»: the row of the 2-shift need reads «50 € / h · 16 horas base en 2 jornadas»",
      p5Row.includes("50 € / h · 16 horas base en 2 jornadas"),
      p5Row.slice(0, 200),
    );
    const p5OrgUrl = `/app/organization/applications?requirementId=${p5Id}`;
    const p5Org = await p5Open(p5OrgUrl);
    await expectSpanish("PKG P05 7 «Candidaturas» in Spanish");
    const p5OrgPills = await page.locator("main nav a").allInnerTexts();
    const p5DeltaCard = () => page.locator(`main article#a-${p5App[DELTA].id}`);
    const p5EchoCard = () => page.locator(`main article#a-${p5App[ECHO].id}`);
    const p5DeltaText = (await p5DeltaCard().innerText()).replace(/\s+/g, " ");
    const p5EchoText = (await p5EchoCard().innerText()).replace(/\s+/g, " ");
    ok(
      "PKG P05 7b v1.8 «Candidaturas»: the sidebar entry, «Pipeline» / «De candidatura a cobertura.», «Oferta seleccionada: {título}» + «Ver todas» + «Volver a ofertas», «Todas (2)» current + the 9 states; delta pseudonymous («Profesional anónimo CF-…», «Aceptada», «Elegible») and echo by name («Technician Echo», «Recibida»); each card links the need and reads «Madrid (MAD) · {periodo} · 2 jornadas»",
      (await page.locator("a[href='/app/organization/applications']").count()) >= 1 &&
        /Pipeline/i.test(p5Org) &&
        p5Org.includes("De candidatura a cobertura.") &&
        p5Org.includes(`Oferta seleccionada: ${p5Title}`) &&
        (await page.getByRole("link", { name: "Ver todas" }).count()) === 1 &&
        (await page.getByRole("link", { name: "Volver a ofertas" }).count()) === 1 &&
        p5OrgPills.length === 10 &&
        p5OrgPills[0] === "Todas (2)" &&
        p5OrgPills.slice(1).join("|") === p5Labels.join("|") &&
        /Profesional anónimo CF-[0-9A-F]{10}/.test(p5DeltaText) &&
        /Aceptada/.test(p5DeltaText) &&
        /Elegible/.test(p5DeltaText) &&
        !/Technician Delta/.test(p5DeltaText) &&
        /Technician Echo/.test(p5EchoText) &&
        /^Recibida/.test(p5EchoText) &&
        (await p5DeltaCard().getByRole("link", { name: p5Title }).getAttribute("href")) ===
          `/app/organization/requirements/${p5Id}` &&
        p5DeltaText.includes(`Madrid (MAD) · ${p5Period} · 2 jornadas`) &&
        p5EchoText.includes(`Madrid (MAD) · ${p5Period} · 2 jornadas`),
      JSON.stringify({
        pills: p5OrgPills,
        delta: p5DeltaText.slice(0, 200),
        echo: p5EchoText.slice(0, 200),
      }),
    );
    await shot("p05-org-applications-1440");

    // HIRE-02 #5: reject with a mandatory reason, visible to both parties (T-10); the empty tab (HIRE-01 #5).
    await p5EchoCard().getByRole("button", { name: "Rechazar" }).click();
    const p5RejectStep = p5EchoCard().getByRole("group", { name: "Rechazar" });
    const p5RejectButton = p5RejectStep.getByRole("button", { name: "Rechazar" });
    const p5RejectDisabled = await p5RejectButton.isDisabled();
    const p5RejectText = (await p5RejectStep.innerText()).replace(/\s+/g, " ");
    await p5RejectStep.getByRole("textbox", { name: /Motivo/ }).fill(p5Reason);
    await p5RejectButton.click();
    const p5Rejected = await p5Done("Rechazada");
    const p5RejectedTab = await p5Open(`${p5OrgUrl}&status=rejected`);
    const p5RejectedCount = await page.locator("main article").count();
    const p5EmptyTab = await p5Open(`${p5OrgUrl}&status=withdrawn`);
    ok(
      "PKG P05 8 «Rechazar»: «Motivo (obligatorio)» + «Lo verá la otra parte. Máximo 1000 caracteres.», the button disabled until a reason; «Hecho: Rechazada.»; the «Rechazada» tab lists it with «Motivo: …»; «Retirada» is «Sin candidaturas en este estado» / «Selecciona otra oferta o prepara una candidatura.»",
      p5RejectDisabled &&
        p5RejectText.includes("Motivo (obligatorio)") &&
        p5RejectText.includes("Lo verá la otra parte. Máximo 1000 caracteres.") &&
        p5Rejected &&
        p5RejectedCount === 1 &&
        p5RejectedTab.includes(`Motivo: ${p5Reason}`) &&
        /Technician Echo/.test(p5RejectedTab) &&
        p5EmptyTab.includes("Sin candidaturas en este estado") &&
        p5EmptyTab.includes("Selecciona otra oferta o prepara una candidatura."),
      JSON.stringify({
        step: p5RejectText.slice(0, 160),
        rejected: p5RejectedTab.slice(0, 160),
        empty: p5EmptyTab.slice(0, 120),
      }),
    );

    // HIRE-04: confirm (the server re-checks), «Cubierta», the coverage, «Finalizar» disabled, the cancel hint.
    await p5Open(p5OrgUrl);
    await p5DeltaCard().getByRole("button", { name: "Confirmar asignación" }).click();
    const p5ConfirmStep = p5DeltaCard().getByRole("group", { name: "Confirmar asignación" });
    const p5ConfirmHint = (await p5ConfirmStep.innerText()).replace(/\s+/g, " ");
    await p5ConfirmStep.getByRole("button", { name: "Confirmar asignación" }).click();
    const p5Confirmed = await p5Done("Confirmada");
    await p5Open(p5OrgUrl);
    const p5ConfirmedText = (await p5DeltaCard().innerText()).replace(/\s+/g, " ");
    const p5Finish = p5DeltaCard().getByRole("button", { name: /Finalizar/ });
    const p5FinishDisabled =
      (await p5Finish.isDisabled()) &&
      (await p5Finish.getAttribute("title")) === "Disponible después de la última jornada.";
    await p5DeltaCard().getByRole("button", { name: "Cancelar asignación" }).click();
    const p5CancelStep = p5DeltaCard().getByRole("group", { name: "Cancelar asignación" });
    const p5CancelHint = (await p5CancelStep.innerText()).replace(/\s+/g, " ");
    await p5CancelStep.getByRole("button", { name: "Volver" }).click();
    const p5Detail = await p5Open(`/app/organization/requirements/${p5Id}`);
    ok(
      "PKG P05 9 «Confirmar asignación»: the hint «El servidor vuelve a comprobar…»; «Hecho: Confirmada.»; the card «Confirmada» + «La necesidad está cubierta.»; «Finalizar» disabled with «Disponible después de la última jornada.»; «Cancelar asignación» explains «Se liberarán plazas…» (backed out); the need reads «Cubierta», «100% cobertura confirmada», «1 / 1 plazas confirmadas»",
      p5ConfirmHint.includes("El servidor vuelve a comprobar") &&
        p5Confirmed &&
        /^Confirmada/.test(p5ConfirmedText) &&
        p5ConfirmedText.includes("La necesidad está cubierta.") &&
        p5FinishDisabled &&
        p5CancelHint.includes(
          "Se liberarán plazas y se restaurará la disponibilidad anterior del técnico. El historial conservará el motivo.",
        ) &&
        /Cubierta/.test(p5Detail) &&
        /100\s?% cobertura confirmada/.test(p5Detail) &&
        /1 \/ 1 plazas confirmadas/.test(p5Detail),
      JSON.stringify({
        hint: p5ConfirmHint.slice(0, 120),
        card: p5ConfirmedText.slice(0, 160),
        cancel: p5CancelHint.slice(0, 140),
        detail: p5Detail.slice(0, 300),
      }),
    );

    // The requirement's own page and the organization's reading of the dated copy (BR-25: never identity or contact).
    const p5ByNeed = await p5Open(`/app/organization/requirements/${p5Id}/applications`);
    await p5DeltaCard().getByRole("link", { name: "Ver expediente" }).click();
    await page.waitForLoadState("networkidle");
    const p5OrgPack = (
      await page
        .locator(`#pack-${p5App[DELTA].id}`)
        .innerText()
        .catch(() => "")
    ).replace(/\s+/g, " ");
    ok(
      "PKG P05 10 the need's «Candidaturas»: «Madrid (MAD) · {periodo} · 2 jornadas», «Volver a la necesidad», «Preselecciona, propón y confirma…»; «Ver expediente» opens «Copia del expediente técnico que el profesional compartió al presentarse.» with «Copia del perfil:» and never an e-mail or real name",
      /Candidaturas/i.test(p5ByNeed) &&
        p5ByNeed.includes(`Madrid (MAD) · ${p5Period} · 2 jornadas`) &&
        (await page.getByRole("link", { name: "Volver a la necesidad" }).count()) === 1 &&
        p5ByNeed.includes("Preselecciona, propón y confirma.") &&
        p5OrgPack.includes(
          "Copia del expediente técnico que el profesional compartió al presentarse.",
        ) &&
        p5OrgPack.includes("Copia del perfil:") &&
        p5OrgPack.includes(
          "Los originales, nombres de archivos y metadatos identificativos permanecen protegidos.",
        ) &&
        !/@crewflex\.test|Technician Delta/.test(p5OrgPack),
      JSON.stringify({ page: p5ByNeed.slice(0, 200), pack: p5OrgPack.slice(0, 200) }),
    );
    await logout();

    // Negatives in the browser: a plain member, another organization's admin on the URL, a professional on it.
    await login("charlie@crewflex.test");
    const p5MemberGlobal = await p5Open("/app/organization/applications");
    const p5MemberByNeed = await p5Open(`/app/organization/requirements/${p5Id}/applications`);
    await logout();
    await login(OTHER);
    // The HTTP 404 is the behaviour under test (S-5): not a console error for step 17.
    expectedErrorUrls.add(`${BASE}/app/organization/requirements/${p5Id}/applications`);
    const p5OtherResponse = await page.goto(
      `${BASE}/app/organization/requirements/${p5Id}/applications`,
    );
    await page.waitForLoadState("networkidle");
    // The filtered list streams its shell (`app/loading.tsx`) before `notFound()`: the body is the not-found page
    // (no card, no data) with HTTP 200 — recorded in the matrix (P05-21); the need's own URL is a real 404.
    const p5OtherGlobal = await p5Open(`/app/organization/applications?requirementId=${p5Id}`);
    const p5OtherCards = await page.locator("main article").count();
    await logout();
    await login(DELTA, { ensureEnglish: false });
    await page.goto(`${BASE}/app/organization/applications`);
    await page.waitForLoadState("networkidle");
    const p5ProfessionalPath = new URL(page.url()).pathname;
    ok(
      "PKG P05 11 negatives (browser): a plain member reads «Applications are handled by admins and managers» on both pages; another organization's admin gets HTTP 404 on the need's URL and the not-found page (no card) on the filtered list; a professional on the organization URL is sent to «Mi espacio»",
      p5MemberGlobal.includes("Applications are handled by admins and managers") &&
        p5MemberByNeed.includes("Applications are handled by admins and managers") &&
        p5OtherResponse?.status() === 404 &&
        /Not found/.test(p5OtherGlobal) &&
        !p5OtherGlobal.includes(p5Title) &&
        p5OtherCards === 0 &&
        p5ProfessionalPath === "/app/professional",
      JSON.stringify({
        member: p5MemberGlobal.slice(0, 400),
        byNeed: p5MemberByNeed.slice(0, 200),
        other: p5OtherResponse?.status(),
        otherGlobal: p5OtherGlobal.slice(0, 120),
        cards: p5OtherCards,
        path: p5ProfessionalPath,
      }),
    );

    // SHOT-11 #4: the covered note in the neutral tone on the own confirmed card; Q3: the technician cancels with a reason.
    await p5Open("/app/professional/applications");
    const p5OwnConfirmed = (await p5Card().innerText()).replace(/\s+/g, " ");
    const p5NoteClass = await p5Card()
      .getByText("La necesidad está cubierta.")
      .getAttribute("class")
      .catch(() => null);
    await p5Card().getByRole("button", { name: "Cancelar asignación" }).click();
    const p5OwnCancel = p5Card().getByRole("group", { name: "Cancelar asignación" });
    await p5OwnCancel.getByRole("textbox", { name: /Motivo/ }).fill(p5CancelReason);
    await p5OwnCancel.getByRole("button", { name: "Cancelar asignación" }).click();
    const p5Cancelled = await p5Done("Cancelada");
    await page.reload();
    await page.waitForLoadState("networkidle");
    const p5OwnCancelled = (await p5Card().innerText()).replace(/\s+/g, " ");
    const p5NeedAfter = (await asSeedUser(MRO, "work-requirements", { query: { id: p5Id } })).data
      ?.requirement?.status;
    ok(
      "PKG P05 12 the own confirmed card: «Confirmada» with «La necesidad está cubierta.» in the neutral tone (not a warning); «Cancelar asignación» with a reason → «Hecho: Cancelada.»; the card reads «Cancelada» + «Motivo: …», no «Ver expediente» (T-113) and no action; the need is open again",
      /^Confirmada/.test(p5OwnConfirmed) &&
        p5OwnConfirmed.includes("La necesidad está cubierta.") &&
        /text-muted/.test(p5NoteClass ?? "") &&
        !/text-warn/.test(p5NoteClass ?? "") &&
        p5Cancelled &&
        /^Cancelada/.test(p5OwnCancelled) &&
        p5OwnCancelled.includes(`Motivo: ${p5CancelReason}`) &&
        !p5OwnCancelled.includes("La necesidad está cubierta.") &&
        (await p5Card().getByRole("link", { name: "Ver expediente" }).count()) === 0 &&
        (await p5Card().getByRole("button").count()) === 0 &&
        p5NeedAfter === "open",
      JSON.stringify({ note: p5NoteClass, after: p5OwnCancelled.slice(0, 200), need: p5NeedAfter }),
    );
  } finally {
    // Seed state back whatever happened: delta and admin.mro in English (later English-asserting blocks), the
    // applications ended, the windows deleted, the need closed and archived.
    try {
      if ((await page.evaluate(() => location.pathname)).startsWith("/app")) await logout();
    } catch {
      /* the page may be mid-navigation; the API restore below does not need it */
    }
    const p5Locales = [];
    for (const email of [DELTA, MRO])
      p5Locales.push(
        (await asSeedUser(email, "user-preferences", { method: "PATCH", body: { locale: "en" } }))
          .data?.preferences?.locale === "en",
      );
    const p5Ended = [];
    for (const email of [DELTA, ECHO]) {
      const mine = (await asSeedUser(email, "applications")).data?.applications ?? [];
      const app = mine.find((a) => a.requirementId === p5Id);
      if (!app) continue;
      if (["withdrawn", "rejected", "cancelled", "finished"].includes(app.status)) {
        p5Ended.push(true);
        continue;
      }
      const to = app.status === "confirmed" ? "cancelled" : "withdrawn";
      const res = await asSeedUser(email, "applications", {
        method: "PATCH",
        headers: p5Key(),
        body: {
          applicationId: app.id,
          to,
          expectedUpdatedAt: app.updatedAt,
          ...(to === "cancelled" ? { reason: "Local UI check · P05 restore" } : {}),
        },
      });
      p5Ended.push(res.data?.transition?.status === to);
    }
    const p5Deleted = [];
    for (const email of [DELTA, ECHO]) {
      if (!p5Win[email]) continue;
      p5Deleted.push(
        (
          await asSeedUser(email, "professional-availability", {
            method: "DELETE",
            query: { id: p5Win[email] },
          })
        ).data?.deleted === true,
      );
    }
    const p5Closed = p5Id
      ? (
          await asSeedUser(MRO, "work-requirements", {
            method: "PATCH",
            body: { id: p5Id, status: "closed" },
          })
        ).ok === true
      : false;
    const p5Archived = p5Closed
      ? (
          await asSeedUser(MRO, "work-requirements", {
            method: "PATCH",
            body: { id: p5Id, archive: true },
          })
        ).ok === true
      : false;
    ok(
      "PKG P05 13 restore: delta and admin.mro in English, the applications ended, both windows deleted, the need closed and archived (seed state back)",
      p5Locales.every(Boolean) &&
        p5Ended.every(Boolean) &&
        p5Deleted.length === 2 &&
        p5Deleted.every(Boolean) &&
        p5Closed &&
        p5Archived,
      JSON.stringify({
        locales: p5Locales,
        ended: p5Ended,
        deleted: p5Deleted,
        closed: p5Closed,
        archived: p5Archived,
      }),
    );
  }
}

// PKG P06 (wallet parity, F3 — TEC-05 #2-#5/#7-#16/#18/#20-#24/#27-#31/#37; T-100…T-103): the v1.8 «Wallet
// documental» in Spanish — the sidebar entry «Documentos», the header («Mi expediente» / «Wallet documental»), the
// upload panel («Subir un documento», the 5 MB sentence, «Archivo» + its hint, «Tipo» = Licencia, «Título» + hint,
// «Caducidad (opcional)», «Vincular a una cualificación (opcional)» over delta's own qualifications only, «Subir
// documento»), a PDF licence expiring in 30 days («Documento guardado en tu wallet privado.», the row with «Licencia» ·
// «Sin analizar · no compartible» · «Caduca pronto», «PDF · {n} B · caduca el {f}», «Abrir» / «Editar» / «Archivar»)
// and a PNG course, the 60-day review in «Mi espacio» and in the passport's folded «Documentos y cursos próximos a
// revisar» («Próximos 60 días», «Abrir» → the wallet, the «Según las fechas declaradas…» footer), the type filter
// («Todos · Licencias · Cursos · Otros», «No hay documentos de este tipo.»), the inline edit («Documento actualizado.»),
// the viewer («Vista previa de {título}», the PDF hint, «Cerrar» gives the focus back to «Abrir»), the trash («Documento
// archivado…», «Papelera (n)», «archivado el … · se elimina definitivamente a partir del …», the 30-day note,
// «Restaurar» → «Documento restaurado.», «Eliminar definitivamente» only there) and the five widths. Negatives: echo
// cannot read, edit, archive or delete delta's document (404), an organization account cannot upload (403) and gets
// «No professional profile» on the wallet URL. Both documents are deleted at the end whatever happens; delta is left in
// English.
{
  const DELTA = "delta@crewflex.test";
  const ECHO = "echo@crewflex.test";
  const MRO = "admin.mro@crewflex.test";
  const p6Day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const p6Date = (d) =>
    new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${d}T00:00:00Z`));
  const p6Open = async (path) => {
    await page.goto(`${BASE}${path}`);
    await page.waitForLoadState("networkidle");
    return (await page.locator("main").innerText()).replace(/\s+/g, " ");
  };
  const p6Es = async () => {
    await page.goto(`${BASE}/app/settings`);
    await page.waitForLoadState("networkidle");
    if ((await page.evaluate(() => document.documentElement.lang)) === "es") return;
    await page.locator("[role=radio][lang=es]").first().click();
    await page.waitForSelector("[role=status]:has-text('Idioma actualizado')", { timeout: 15000 });
  };
  const p6Status = (text) =>
    page
      .locator("main [role=status]")
      .filter({ hasText: text })
      .first()
      .waitFor({ timeout: 15000 })
      .then(() => true)
      .catch(() => false);
  const p6Stamp = Date.now();
  const p6Pdf = `Local UI check · P06 licencia ${p6Stamp}`;
  const p6Png = `Local UI check · P06 curso ${p6Stamp}`;
  const p6Soon = p6Day(30); // «Caduca pronto» (≤ 45 days) and inside the 60-day review window
  const p6PdfBytes = Buffer.from("%PDF-1.4\n%P06\n%%EOF\n");
  const p6PngBytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );
  const p6Row = (title) => page.locator("main li", { hasText: title });
  const p6Upload = async (title, kind, file, expiresAt) => {
    await page.setInputFiles("#file", file);
    await page.fill("#title", title);
    await page.selectOption("#kind", kind);
    if (expiresAt) await page.fill("#expiresAt", expiresAt);
    await page.getByRole("button", { name: "Subir documento" }).click();
    await p6Row(title).waitFor({ timeout: 15_000 });
  };
  /** Delta's own documents (both views) whose title starts with the smoke prefix: ids by title. */
  const p6Mine = async () => {
    const found = {};
    for (const query of [{}, { view: "trash" }]) {
      const listed = await asSeedUser(DELTA, "professional-documents", { query });
      for (const d of listed.data?.documents ?? []) {
        if (d.title.startsWith("Local UI check · P06 ")) found[d.title] = d.id;
      }
    }
    return found;
  };
  try {
    await login(DELTA);
    await p6Es();
    const p6Quals =
      (await asSeedUser(DELTA, "professional-qualifications")).data?.qualifications ?? [];
    const p6Page = await p6Open("/app/professional/documents");
    await expectSpanish("PKG P06 0 «Wallet documental» in Spanish");
    const p6Nav = await page
      .locator("a[href='/app/professional/documents'][aria-current=page]")
      .first()
      .innerText()
      .catch(() => "");
    const p6QualOptions = await page.locator("#qualificationId option").allInnerTexts();
    ok(
      "PKG P06 0b v1.8 wallet: sidebar «Documentos» current; «Mi expediente» / «Wallet documental» / the private sentence; «Subir un documento» with the 5 MB sentence, «Archivo» + its hint, «Tipo» = «Licencia», «Título» + «Si lo dejas vacío…», «Caducidad (opcional)», «Vincular a una cualificación (opcional)» = «— Sin vincular —» + delta's own qualifications only, «Subir documento»; «Tus documentos (n)», «Papelera (n)», the sharing note",
      /Documentos/.test(p6Nav) &&
        /Mi expediente/i.test(p6Page) &&
        p6Page.includes("Wallet documental") &&
        p6Page.includes(
          "Tus licencias, cursos y otros documentos, guardados de forma privada. Solo tú puedes verlos.",
        ) &&
        p6Page.includes("Subir un documento") &&
        p6Page.includes(
          "PDF, PNG o JPEG, hasta 5 MB. Subir un documento no acredita una licencia ni una habilitación: la verificación es un proceso aparte.",
        ) &&
        p6Page.includes("El tipo se comprueba por el contenido del archivo, no por su nombre.") &&
        (await page.locator("#kind option:checked").innerText()) === "Licencia" &&
        p6Page.includes("Si lo dejas vacío se usa el nombre del archivo.") &&
        p6Page.includes("Caducidad (opcional)") &&
        p6Page.includes("Vincular a una cualificación (opcional)") &&
        p6Page.includes("Solo tus propias cualificaciones declaradas.") &&
        p6QualOptions[0] === "— Sin vincular —" &&
        p6QualOptions.length === p6Quals.length + 1 &&
        p6Quals.every((q) => p6QualOptions.includes(`${q.type.code} · ${q.type.name}`)) &&
        /Tus documentos \(\d+\)/.test(p6Page) &&
        /Papelera \(\d+\)/.test(p6Page) &&
        p6Page.includes("Ninguna empresa puede ver estos documentos."),
      JSON.stringify({ nav: p6Nav, options: p6QualOptions.length, quals: p6Quals.length }),
    );

    // Upload: a PDF licence that expires in 30 days and a PNG course without a date.
    await p6Upload(
      p6Pdf,
      "license",
      { name: "p06.pdf", mimeType: "application/pdf", buffer: p6PdfBytes },
      p6Soon,
    );
    const p6Saved = await p6Status("Documento guardado en tu wallet privado.");
    await p6Upload(p6Png, "course", { name: "p06.png", mimeType: "image/png", buffer: p6PngBytes });
    const p6PdfText = (await p6Row(p6Pdf).innerText()).replace(/\s+/g, " ");
    const p6PngText = (await p6Row(p6Png).innerText()).replace(/\s+/g, " ");
    const p6Buttons = await p6Row(p6Pdf).getByRole("button").allInnerTexts();
    ok(
      "PKG P06 1 upload: «Documento guardado en tu wallet privado.»; the PDF row «Licencia» · «Sin analizar · no compartible» · «Caduca pronto», «PDF · {bytes} B · caduca el {f}» and «Abrir» / «Editar» / «Archivar {título}»; the PNG row «Curso», «Imagen PNG · {bytes} B», no expiry chip",
      p6Saved &&
        p6PdfText.includes("Licencia") &&
        p6PdfText.includes("Sin analizar · no compartible") &&
        p6PdfText.includes("Caduca pronto") &&
        p6PdfText.includes(`PDF · ${p6PdfBytes.length} B · caduca el ${p6Date(p6Soon)}`) &&
        p6Buttons.join("|") === "Abrir|Editar|Archivar" &&
        (await p6Row(p6Pdf)
          .getByRole("button", { name: `Archivar ${p6Pdf}` })
          .count()) === 1 &&
        p6PngText.includes("Curso") &&
        p6PngText.includes(`Imagen PNG · ${p6PngBytes.length} B`) &&
        !/Vigente|Caduca pronto|Caducado/.test(p6PngText),
      `${p6PdfText.slice(0, 160)} · ${p6Buttons.join("|")}`,
    );

    // TEC-05 #24: the 60-day review in «Mi espacio» and the passport's folded <details> (T-163).
    const p6Home = await p6Open("/app/professional");
    const p6HomeRow = page.locator("main li", { hasText: p6Pdf }).first();
    const p6HomeRowText = (await p6HomeRow.innerText().catch(() => "")).replace(/\s+/g, " ");
    const p6HomeHref = await p6HomeRow
      .getByRole("link", { name: `Abrir · ${p6Pdf}` })
      .getAttribute("href")
      .catch(() => null);
    await p6Open("/app/professional/profile");
    const p6Details = page.locator("main details", {
      has: page.locator("summary", { hasText: "Documentos y cursos próximos a revisar" }),
    });
    await p6Details.locator("summary").click();
    const p6DetailsText = (await p6Details.innerText().catch(() => "")).replace(/\s+/g, " ");
    ok(
      "PKG P06 2 60-day review (TEC-05 #24): «Mi espacio» lists «{título} · {f}» with «Próximos 60 días» and «Abrir» → the wallet; the passport's folded «Documentos y cursos próximos a revisar» lists the same row with the «Según las fechas declaradas…» footer",
      p6Home.includes("Documentos y cursos próximos a revisar") &&
        p6HomeRowText.includes(`${p6Pdf} · ${p6Date(p6Soon)}`) &&
        p6HomeRowText.includes("Próximos 60 días") &&
        p6HomeHref === "/app/professional/documents" &&
        p6DetailsText.includes(`${p6Pdf} · ${p6Date(p6Soon)}`) &&
        p6DetailsText.includes("Próximos 60 días") &&
        p6DetailsText.includes(
          "Según las fechas declaradas. No se envían avisos externos; los documentos sin fecha no se consideran verificados.",
        ),
      JSON.stringify({ home: p6HomeRowText.slice(0, 120), passport: p6DetailsText.slice(0, 120) }),
    );

    // TEC-05 #6: the type filter (T-102) over the three kinds.
    await p6Open("/app/professional/documents");
    const p6Chips = page.getByRole("group", { name: "Filtrar por tipo" });
    const p6Labels = await p6Chips.getByRole("button").allInnerTexts();
    await p6Chips.getByRole("button", { name: "Cursos" }).click();
    const p6Courses = {
      pressed: await p6Chips.getByRole("button", { name: "Cursos" }).getAttribute("aria-pressed"),
      heading: await page.locator("main h2", { hasText: "Tus documentos" }).innerText(),
      rows: await page.locator("main li").count(),
      png: await p6Row(p6Png).count(),
      pdf: await p6Row(p6Pdf).count(),
    };
    await p6Chips.getByRole("button", { name: "Otros" }).click();
    const p6Others = {
      rows: await page.locator("main li").count(),
      none: await page.getByText("No hay documentos de este tipo.").count(),
      mine: (await p6Row(p6Png).count()) + (await p6Row(p6Pdf).count()),
    };
    await p6Chips.getByRole("button", { name: "Todos" }).click();
    ok(
      "PKG P06 3 type filter (TEC-05 #6, T-102): «Todos · Licencias · Cursos · Otros» (aria-pressed); «Cursos» leaves the PNG and «Tus documentos ({n})» follows; «Otros» hides both and, with nothing of that type, says «No hay documentos de este tipo.»",
      p6Labels.join("|") === "Todos|Licencias|Cursos|Otros" &&
        p6Courses.pressed === "true" &&
        p6Courses.heading === `Tus documentos (${p6Courses.rows})` &&
        p6Courses.png === 1 &&
        p6Courses.pdf === 0 &&
        p6Others.mine === 0 &&
        (p6Others.rows > 0 || p6Others.none === 1),
      JSON.stringify({ labels: p6Labels.join("|"), courses: p6Courses, others: p6Others }),
    );

    // TEC-05 #29: inline edit (title, kind, expiry, link) → «Documento actualizado.».
    await p6Row(p6Pdf).getByRole("button", { name: "Editar" }).click();
    // While editing, the row holds the form (the title is an input value, not text): the only form in the list.
    const p6EditForm = page.locator("main li form");
    const p6EditLabels = await p6EditForm.locator("label").allInnerTexts();
    await p6EditForm.locator("input[name=title]").fill(`${p6Pdf} editado`);
    await p6EditForm.getByRole("button", { name: "Guardar" }).click();
    const p6Updated = await p6Status("Documento actualizado.");
    // The row re-renders after the action's revalidation: wait for it, never count at once (a production
    // server refreshes a beat later than `next dev`).
    const p6Renamed = await p6Row(`${p6Pdf} editado`)
      .waitFor({ timeout: 15_000 })
      .then(() => 1)
      .catch(() => 0);
    ok(
      "PKG P06 4 inline edit (TEC-05 #29): «Editar» opens «Título», «Tipo», «Caducidad (opcional)», «Vincular a una cualificación (opcional)» with «Guardar» / «Cancelar»; saving → «Documento actualizado.» and the row carries the new title",
      p6EditLabels.join("|") ===
        "Título|Tipo|Caducidad (opcional)|Vincular a una cualificación (opcional)" &&
        p6Updated &&
        p6Renamed === 1,
      JSON.stringify({ labels: p6EditLabels.join("|"), updated: p6Updated, renamed: p6Renamed }),
    );
    const p6PdfNow = `${p6Pdf} editado`;

    // TEC-05 #27/#28: the viewer (T-103) in Spanish.
    await p6Row(p6PdfNow).getByRole("button", { name: "Abrir" }).click();
    const p6Dialog = page.getByRole("dialog", { name: p6PdfNow });
    await p6Dialog.locator("iframe").waitFor({ timeout: 15_000 });
    const p6Viewer = {
      frameTitle: await p6Dialog.locator("iframe").getAttribute("title"),
      blob: ((await p6Dialog.locator("iframe").getAttribute("src")) ?? "").startsWith("blob:"),
      hint: await p6Dialog
        .getByText("Si el PDF no se muestra, ábrelo en una pestaña nueva.")
        .count(),
      newTab: await p6Dialog.getByRole("button", { name: "Abrir en una pestaña nueva" }).count(),
    };
    await p6Dialog.getByRole("button", { name: "Cerrar" }).click();
    await p6Dialog.waitFor({ state: "detached", timeout: 5_000 });
    const p6FocusBack = await p6Row(p6PdfNow)
      .getByRole("button", { name: "Abrir" })
      .evaluate((el) => el === document.activeElement);
    ok(
      "PKG P06 5 viewer (TEC-05 #27/#28, T-103): «Abrir» opens the dialog named by the title with the PDF in a blob frame «Vista previa de {título}», «Si el PDF no se muestra, ábrelo en una pestaña nueva.» and «Abrir en una pestaña nueva»; «Cerrar» returns the focus to «Abrir»",
      p6Viewer.frameTitle === `Vista previa de ${p6PdfNow}` &&
        p6Viewer.blob &&
        p6Viewer.hint === 1 &&
        p6Viewer.newTab === 1 &&
        p6FocusBack,
      JSON.stringify({ ...p6Viewer, focus: p6FocusBack }),
    );

    // TEC-05 #30/#31: trash (T-100/T-101) — archive, the trash view, restore.
    const p6TrashBefore = Number(
      /Papelera \((\d+)\)/.exec(
        (await page.locator("main").innerText()).replace(/\s+/g, " "),
      )?.[1] ?? "-1",
    );
    await p6Row(p6PdfNow)
      .getByRole("button", { name: `Archivar ${p6PdfNow}` })
      .click();
    await p6Row(p6PdfNow).waitFor({ state: "detached", timeout: 15_000 });
    const p6ArchivedNotice = await p6Status(
      "Documento archivado. Puedes restaurarlo desde la papelera.",
    );
    await page.getByRole("link", { name: `Papelera (${p6TrashBefore + 1})` }).click();
    await page.waitForURL((u) => u.search === "?view=trash");
    await p6Row(p6PdfNow).waitFor({ timeout: 15_000 });
    const p6TrashText = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    const p6TrashHeading = await page.locator("main h2", { hasText: "Papelera" }).innerText();
    const p6TrashRowText = (await p6Row(p6PdfNow).innerText()).replace(/\s+/g, " ");
    const p6TrashButtons = await p6Row(p6PdfNow).getByRole("button").allInnerTexts();
    const p6NoUpload = (await page.locator("#file").count()) === 0;
    await p6Row(p6PdfNow)
      .getByRole("button", { name: `Restaurar ${p6PdfNow}` })
      .click();
    await p6Row(p6PdfNow).waitFor({ state: "detached", timeout: 15_000 });
    const p6RestoredNotice = await p6Status("Documento restaurado.");
    await page.getByRole("link", { name: "Ver wallet" }).click();
    await page.waitForURL((u) => u.search === "");
    const p6Back = await p6Row(p6PdfNow).count();
    ok(
      "PKG P06 6 trash (TEC-05 #30/#31, T-100/T-101): «Archivar» → «Documento archivado. Puedes restaurarlo desde la papelera.» and «Papelera (n+1)»; the trash has no upload panel, the 30-day note, the row «archivado el {f} · se elimina definitivamente a partir del {f}» with «Restaurar» and «Eliminar definitivamente»; «Restaurar» → «Documento restaurado.»; «Ver wallet» shows it again",
      p6ArchivedNotice &&
        p6TrashBefore >= 0 &&
        p6NoUpload &&
        p6TrashHeading === `Papelera (${p6TrashBefore + 1})` &&
        p6TrashText.includes(
          "Puedes restaurar un documento archivado durante 30 días; después se elimina definitivamente, también su archivo. Ninguna empresa puede verlo.",
        ) &&
        /archivado el \d{2} \S+ \d{4} · se elimina definitivamente a partir del \d{2} \S+ \d{4}/.test(
          p6TrashRowText,
        ) &&
        p6TrashButtons.join("|") === "Restaurar|Eliminar definitivamente" &&
        p6RestoredNotice &&
        p6Back === 1,
      JSON.stringify({
        before: p6TrashBefore,
        row: p6TrashRowText.slice(0, 160),
        buttons: p6TrashButtons.join("|"),
        back: p6Back,
      }),
    );

    // TEC-05 #35: «Exportar mis datos y archivos» carries the wallet files (base64) with their metadata.
    const p6Export = await page.request.get(`${BASE}/app/settings/export`);
    const p6ExportBody = p6Export.ok() ? await p6Export.json() : null;
    const p6Exported = (p6ExportBody?.documents ?? []).find((d) => d.title === p6PdfNow);
    ok(
      "PKG P06 7b export (TEC-05 #35): «Exportar mis datos y archivos» includes the wallet document with its metadata and the file bytes in base64, nothing omitted",
      p6ExportBody?.format === "crewflex-account-export/1" &&
        p6Exported?.kind === "license" &&
        p6Exported?.expiresAt === p6Soon &&
        p6Exported?.mimeType === "application/pdf" &&
        p6Exported?.contentBase64 === p6PdfBytes.toString("base64") &&
        p6ExportBody?.filesOmitted === 0,
      JSON.stringify({ status: p6Export.status(), omitted: p6ExportBody?.filesOmitted }),
    );

    // The five widths: one column, no horizontal scroll (the dock below lg carries no «Documentos»).
    for (const width of [1440, 1024, 768, 390, 360]) {
      await page.setViewportSize({ width, height: width < 800 ? 1100 : 900 });
      await page.waitForTimeout(300);
      const p6Overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      ok(`PKG P06 7 @${width}: no horizontal overflow`, !p6Overflow, `overflow=${p6Overflow}`);
      if (width === 1440 || width === 390) await shot(`p06-wallet-${width}`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });

    // Identity from the JWT (S-2): echo cannot read, edit, archive or delete delta's document; an organization
    // account cannot upload at all.
    const p6Ids = await p6Mine();
    const p6Target = p6Ids[p6PdfNow];
    const p6Stranger = {
      url: (await asSeedUser(ECHO, "professional-documents", { query: { id: p6Target, url: "1" } }))
        .error?.code,
      patch: (
        await asSeedUser(ECHO, "professional-documents", {
          method: "PATCH",
          query: { id: p6Target },
          body: { kind: "other", title: "stolen", expiresAt: null, qualificationId: null },
        })
      ).error?.code,
      archive: (
        await asSeedUser(ECHO, "professional-documents", {
          method: "PATCH",
          query: { id: p6Target },
          body: { archived: true },
        })
      ).error?.code,
      del: (
        await asSeedUser(ECHO, "professional-documents", {
          method: "DELETE",
          query: { id: p6Target },
        })
      ).error?.code,
      orgUpload: (
        await asSeedUser(MRO, "professional-documents", {
          method: "POST",
          headers: { "Idempotency-Key": crypto.randomUUID() },
          body: { kind: "license", title: "nope" },
        })
      ).error?.code,
    };
    const p6Intact = (await asSeedUser(DELTA, "professional-documents")).data?.documents?.find(
      (d) => d.id === p6Target,
    );
    ok(
      "PKG P06 8 negatives (API): echo gets 404 on delta's document (signed URL, edit, archive, delete) and the row is intact; an organization account cannot upload (FORBIDDEN)",
      Boolean(p6Target) &&
        p6Stranger.url === "NOT_FOUND" &&
        p6Stranger.patch === "NOT_FOUND" &&
        p6Stranger.archive === "NOT_FOUND" &&
        p6Stranger.del === "NOT_FOUND" &&
        p6Stranger.orgUpload === "FORBIDDEN" &&
        p6Intact?.title === p6PdfNow &&
        p6Intact?.kind === "license" &&
        p6Intact?.archivedAt === null,
      JSON.stringify(p6Stranger),
    );

    await logout();
    await login(MRO);
    const p6OrgPage = await p6Open("/app/professional/documents");
    const p6OrgNav = await page.locator("a[href='/app/professional/documents']").count();
    ok(
      "PKG P06 9 negative (browser): an organization account on the wallet URL reads «No professional profile» / «The document wallet belongs to professional accounts.», no upload form, no «Documents» entry",
      p6OrgPage.includes("No professional profile") &&
        p6OrgPage.includes("The document wallet belongs to professional accounts.") &&
        (await page.locator("#file").count()) === 0 &&
        p6OrgNav === 0,
      p6OrgPage.slice(0, 120),
    );
    await logout();
  } finally {
    // Restore: every P06 document of delta deleted (wallet and trash), delta back in English.
    const p6Left = await p6Mine();
    const p6Removed = [];
    for (const id of Object.values(p6Left)) {
      p6Removed.push(
        (
          await asSeedUser(DELTA, "professional-documents", {
            method: "DELETE",
            query: { id },
          })
        ).data?.deleted === true,
      );
    }
    const p6Locale =
      (await asSeedUser(DELTA, "user-preferences", { method: "PATCH", body: { locale: "en" } }))
        .ok === true;
    // `p6Es` also set the browser's locale cookie (the settings action): the logged-out pages that follow
    // («PKG account c/d») must be in English again, so the cookie goes too.
    await ctx.clearCookies({ name: "crewflex-locale" });
    const p6After = await p6Mine();
    ok(
      "PKG P06 10 restore: the P06 documents deleted (wallet and trash), nothing of the smoke left, delta in English",
      p6Removed.length === 2 &&
        p6Removed.every(Boolean) &&
        Object.keys(p6After).length === 0 &&
        p6Locale,
      JSON.stringify({ removed: p6Removed, left: Object.keys(p6After).length, locale: p6Locale }),
    );
  }
}

// PKG P07 (logbook parity, F3 — TEC-06 #1-#14; BR-17, T-19…T-22, T-112): the v1.8 «Logbook personal» in Spanish —
// the sidebar entry «Logbook», the header («MI EXPERIENCIA» / «Logbook personal» / the demo sentence), the panel
// «Nueva entrada» with the connected disclaimer, «Fecha de la tarea» = today in Madrid (also its max), «Aeronave» with
// the 12 v1.8 suggestions, the 6 categories and 5 environments with the v1.8 defaults, «ATA (opcional)», «Horas» + its
// hint, «Descripción técnica», «Disponible para seleccionar en Candidate Pack» + «Los expedientes ya enviados conservan
// su copia.», the v1.8 refusals (a future date → «El logbook registra actividad realizada, no futura.» + «Indica una
// tarea realizada, fecha válida y descripción.»; 25 h → «Horas: valor no válido…»), «Guardar entrada» → «Entrada
// guardada» with the form emptied, the row («{aeronave} · {categoría}», the date chip, «ATA {n} · {h} h» with the
// Spanish decimal mark · environment, «Autodeclarada»), the five widths, «Seleccionable para expediente» kept after a
// reload, the inline «Editar experiencia» → «Logbook actualizado», «Archivar» → «Ver archivo» / «Entradas archivadas»
// → «Restaurar» → «Ver activas», «Eliminar» → «Eliminar definitivamente» → «Entrada eliminada», and the empty texts.
// Negatives: echo cannot read, edit, archive or delete delta's entry (404 / RLS), nor write one in delta's name (strict
// schema); an organization account cannot create an entry (FORBIDDEN) and gets «No professional profile» on the URL,
// without a «Logbook» entry. The entry is deleted at the end whatever happens; delta is left in English.
{
  const DELTA = "delta@crewflex.test";
  const ECHO = "echo@crewflex.test";
  const MRO = "admin.mro@crewflex.test";
  const LB = "/app/professional/logbook";
  const P7_PREFIX = "A320 EC-QAA (P07 ";
  const p7Aircraft = `${P7_PREFIX}${Date.now()})`;
  const p7Madrid = (offsetDays) =>
    new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(
      new Date(Date.now() + offsetDays * 86_400_000),
    );
  const p7Today = p7Madrid(0);
  // `formatDate("es", …)`: day · short month · year, rendered in UTC (BR-10).
  const p7Chip = new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${p7Today}T00:00:00Z`));
  const p7Main = async () => (await page.locator("main").innerText()).replace(/\s+/g, " ");
  const p7Es = async () => {
    await page.goto(`${BASE}/app/settings`);
    await page.waitForLoadState("networkidle");
    if ((await page.evaluate(() => document.documentElement.lang)) === "es") return;
    await page.locator("[role=radio][lang=es]").first().click();
    await page.waitForSelector("[role=status]:has-text('Idioma actualizado')", { timeout: 15000 });
  };
  const p7Status = (text) =>
    page
      .locator("main [role=status], main [role=alert]")
      .filter({ hasText: text })
      .first()
      .waitFor({ timeout: 15000 })
      .then(() => true)
      .catch(() => false);
  const p7Row = () => page.locator("main li", { hasText: p7Aircraft });
  /** Delta's own entries (both views): the smoke's ones by id, and the totals the UI must mirror. */
  const p7List = async () => {
    const mine = [];
    const total = {};
    for (const view of ["active", "archived"]) {
      const listed = await asSeedUser(DELTA, "professional-logbook", { query: { view } });
      total[view] = listed.data?.total ?? -1;
      for (const e of listed.data?.entries ?? []) {
        if (e.aircraft.startsWith(P7_PREFIX)) mine.push({ ...e, view });
      }
    }
    return { mine, total };
  };
  const p7Fill = async (values) => {
    for (const [sel, value] of Object.entries(values)) await page.fill(sel, value);
  };
  try {
    await login(DELTA);
    await p7Es();
    await page.goto(`${BASE}${LB}`);
    await page.waitForLoadState("networkidle");
    await expectSpanish("PKG P07 0 «Logbook personal» in Spanish");
    const p7Page = await p7Main();
    const p7Before = await p7List();
    const p7Nav = await page
      .locator(`a[href='${LB}'][aria-current=page]`)
      .first()
      .innerText()
      .catch(() => "");
    const p7Cats = await page.locator("#category option").allInnerTexts();
    const p7Envs = await page.locator("#environment option").allInnerTexts();
    const p7Suggestions = await page
      .locator("#aircraft-options option")
      .evaluateAll((os) => os.map((o) => o.value));
    const p7Labels = await page.locator("main form label").allInnerTexts();
    ok(
      "PKG P07 0b v1.8 logbook (TEC-06 #1-#9, #11): sidebar «Logbook» current; «MI EXPERIENCIA» / «Logbook personal» / «Registro auxiliar privado…»; «Nueva entrada» with the connected disclaimer; «Fecha de la tarea» = today in Madrid and max today; «Aeronave» (free text) with the 12 v1.8 suggestions; the 6 categories, default «Defect Rectification»; the 5 environments, default «Line Maintenance»; «ATA (opcional)», «Horas» + «De 0 a 24, en pasos de 0,1.», «Descripción técnica», «Disponible para seleccionar en Candidate Pack» + «Los expedientes ya enviados conservan su copia.», «Guardar entrada»; «Historial» + «Ver archivo»; the empty text iff no active entry",
      p7Nav.trim() === "Logbook" &&
        /MI EXPERIENCIA Logbook personal Registro auxiliar privado\. No sustituye registros oficiales de la empresa\./.test(
          p7Page,
        ) &&
        /Nueva entrada Registro autodeclarado; no constituye certificación de experiencia ni puesta en servicio\. Solo tú puedes verlo; las entradas marcadas «Seleccionable para expediente» se copian en el expediente de las candidaturas que presentes\./.test(
          p7Page,
        ) &&
        (await page.inputValue("#entryDate")) === p7Today &&
        (await page.getAttribute("#entryDate", "max")) === p7Today &&
        (await page.getAttribute("#aircraft", "maxlength")) === "100" &&
        p7Suggestions.length === 12 &&
        p7Suggestions[0] === "A320 Family" &&
        p7Suggestions[11] === "Robinson R44" &&
        p7Cats.join("|") ===
          "Defect Rectification|Inspection|Component Replacement|Troubleshooting|Sheet Metal / Structures|Cabin / Interiors" &&
        (await page.inputValue("#category")) === "defect_rectification" &&
        p7Envs.join("|") ===
          "Line Maintenance|Base Maintenance|Engine Bay Check|AOG Intervention|Workshop" &&
        (await page.inputValue("#environment")) === "line_maintenance" &&
        [
          "Fecha de la tarea",
          "Aeronave",
          "Categoría de tarea",
          "Entorno",
          "ATA (opcional)",
          "Horas",
          "Descripción técnica",
        ].every((l) => p7Labels.includes(l)) &&
        (await page.getAttribute("#ata", "maxlength")) === "10" &&
        (await page.getAttribute("#hours", "step")) === "0.1" &&
        (await page.getAttribute("#hours", "max")) === "24" &&
        (await page.getAttribute("#description", "maxlength")) === "3000" &&
        /De 0 a 24, en pasos de 0,1\./.test(p7Page) &&
        /Disponible para seleccionar en Candidate Pack/.test(p7Page) &&
        /Los expedientes ya enviados conservan su copia\./.test(p7Page) &&
        !(await page.isChecked("input[name=cvRelevant]")) &&
        (await page.getByRole("button", { name: "Guardar entrada" }).count()) === 1 &&
        /Historial/.test(p7Page) &&
        (await page.getByRole("link", { name: "Ver archivo" }).count()) === 1 &&
        /Todavía no hay entradas\. Las que guardes aparecerán aquí\./.test(p7Page) ===
          (p7Before.total.active === 0),
      `nav=${p7Nav} cats=${p7Cats.join("|")} envs=${p7Envs.join("|")} sugg=${p7Suggestions.length} active=${p7Before.total.active} ${p7Page.slice(0, 200)}`,
    );

    // v1.8 refusals: a future date (the demo sentence + the connected one), then 25 h.
    await p7Fill({
      "#entryDate": p7Madrid(2),
      "#aircraft": p7Aircraft,
      "#hours": "3.5",
      "#description": "Local UI check · P07 · sustitución de rueda principal izquierda.",
    });
    await page.getByRole("button", { name: "Guardar entrada" }).click();
    const p7FutureField = await page
      .locator("#entryDate-error")
      .innerText()
      .catch(() => "");
    const p7FutureNotice = await p7Status(
      "Indica una tarea realizada, fecha válida y descripción.",
    );
    const p7Unsaved = (await p7List()).mine.length === 0;
    await p7Fill({ "#entryDate": p7Today, "#hours": "25" });
    await page.getByRole("button", { name: "Guardar entrada" }).click();
    const p7HoursField = await page
      .locator("#hours-error")
      .innerText()
      .catch(() => "");
    const p7HoursNotice = await p7Status("Revisa los campos marcados.");
    ok(
      "PKG P07 1 refusals (TEC-06 #3, #7, #10; BR-17.2): a date two days ahead → «El logbook registra actividad realizada, no futura.» on the field and «Indica una tarea realizada, fecha válida y descripción.», nothing saved; 25 h → «Horas: valor no válido. De 0 a 24, en pasos de 0,1.» and «Revisa los campos marcados.»",
      p7FutureField === "El logbook registra actividad realizada, no futura." &&
        p7FutureNotice &&
        p7Unsaved &&
        p7HoursField === "Horas: valor no válido. De 0 a 24, en pasos de 0,1." &&
        p7HoursNotice,
      `date=${p7FutureField} notice=${p7FutureNotice} unsaved=${p7Unsaved} hours=${p7HoursField} notice=${p7HoursNotice}`,
    );

    await p7Fill({ "#hours": "3.5", "#ata": "32" });
    await page.selectOption("#category", "component_replacement");
    await page.selectOption("#environment", "aog_intervention");
    await page.getByRole("button", { name: "Guardar entrada" }).click();
    const p7Saved = await p7Status("Entrada guardada");
    await p7Row()
      .waitFor({ timeout: 15000 })
      .catch(() => {});
    const p7RowText = (
      await p7Row()
        .innerText()
        .catch(() => "no row")
    ).replace(/\s+/g, " ");
    const p7After = await p7List();
    const p7Entry = p7After.mine.find((e) => e.aircraft === p7Aircraft);
    ok(
      "PKG P07 2 save (TEC-06 #10, #11, #14; T-20): «Guardar entrada» → «Entrada guardada»; the form empties back to the defaults; the row «{aeronave} · Component Replacement», the date chip, «ATA 32 · 3,5 h · AOG Intervention» (Spanish decimal mark), the description, «Autodeclarada», «Seleccionable para expediente» off, «Editar» / «Archivar»; the API holds the entry active, not selectable, hours 3.5",
      p7Saved &&
        (await page.inputValue("#aircraft")) === "" &&
        (await page.inputValue("#entryDate")) === p7Today &&
        (await page.inputValue("#category")) === "defect_rectification" &&
        (await page.inputValue("#hours")) === "" &&
        (await p7Row().count()) === 1 &&
        p7RowText.includes(`${p7Aircraft} · Component Replacement`) &&
        p7RowText.includes(p7Chip) &&
        p7RowText.includes("ATA 32 · 3,5 h · AOG Intervention") &&
        p7RowText.includes("sustitución de rueda principal izquierda") &&
        p7RowText.includes("Autodeclarada") &&
        !(await p7Row().getByLabel("Seleccionable para expediente").isChecked()) &&
        (await p7Row().getByRole("button", { name: "Editar" }).count()) === 1 &&
        (await p7Row().getByRole("button", { name: "Archivar" }).count()) === 1 &&
        !/Todavía no hay entradas/.test(await p7Main()) &&
        p7Entry?.view === "active" &&
        p7Entry.cvRelevant === false &&
        p7Entry.hours === 3.5 &&
        p7Entry.ata === "32" &&
        p7Entry.entryDate === p7Today,
      `saved=${p7Saved} chip=${p7Chip} ${p7RowText.slice(0, 200)} api=${JSON.stringify(p7Entry ?? null).slice(0, 120)}`,
    );

    await page.evaluate(() => window.scrollTo(0, 0));
    for (const width of [1440, 1024, 768, 390, 360]) {
      await page.setViewportSize({ width, height: width < 800 ? 1100 : 900 });
      await page.waitForTimeout(300);
      const p7Overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      ok(`PKG P07 3 @${width}: no horizontal overflow`, !p7Overflow, `overflow=${p7Overflow}`);
      if (width === 1440 || width === 390) await shot(`p07-logbook-${width}`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });

    await p7Row().getByLabel("Seleccionable para expediente").check();
    const p7Selected = await p7Status("Logbook actualizado");
    await page.reload();
    await page.waitForLoadState("networkidle");
    const p7SelectedApi = (await p7List()).mine.find((e) => e.id === p7Entry?.id)?.cvRelevant;
    ok(
      "PKG P07 4 selection (TEC-06 #9; T-112): «Seleccionable para expediente» → «Logbook actualizado»; still checked after a reload and `cvRelevant` true in the API",
      p7Selected &&
        (await p7Row().getByLabel("Seleccionable para expediente").isChecked()) &&
        p7SelectedApi === true,
      `status=${p7Selected} api=${p7SelectedApi}`,
    );

    await p7Row().getByRole("button", { name: "Editar" }).click();
    // While editing, the aircraft is an input value, not text: the row is the one holding the edit form.
    const p7EditRow = page.locator("main li", { has: page.locator("#edit-aircraft") });
    await p7EditRow.waitFor({ timeout: 15000 }).catch(() => {});
    const p7EditTitle = await p7EditRow
      .locator("h3")
      .innerText()
      .catch(() => "");
    const p7EditOpen =
      (await page.inputValue("#edit-aircraft")) === p7Aircraft &&
      (await page.inputValue("#edit-hours")) === "3.5" &&
      (await page.inputValue("#edit-ata")) === "32" &&
      (await page.inputValue("#edit-category")) === "component_replacement" &&
      (await page.inputValue("#edit-entryDate")) === p7Today &&
      (await p7EditRow.getByRole("button", { name: "Guardar cambios" }).count()) === 1 &&
      (await p7EditRow.getByRole("button", { name: "Cancelar" }).count()) === 1;
    await p7Fill({ "#edit-hours": "2", "#edit-ata": "32-41" });
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    const p7Edited = await p7Status("Logbook actualizado");
    await p7Row()
      .filter({ hasText: "ATA 32-41 · 2 h · AOG Intervention" })
      .waitFor({ timeout: 15000 })
      .catch(() => {});
    const p7EditedRow = (await p7Row().innerText()).replace(/\s+/g, " ");
    ok(
      "PKG P07 5 inline edit (TEC-06 #12; T-22): «Editar» opens «Editar experiencia» in the row with the entry's values, «Guardar cambios» / «Cancelar»; 2 h and ATA 32-41 → «Logbook actualizado» and the row reads «ATA 32-41 · 2 h · AOG Intervention»",
      p7EditTitle === "Editar experiencia" &&
        p7EditOpen &&
        p7Edited &&
        p7EditedRow.includes("ATA 32-41 · 2 h · AOG Intervention"),
      `title=${p7EditTitle} open=${p7EditOpen} status=${p7Edited} ${p7EditedRow.slice(0, 160)}`,
    );

    // Negatives through the API: another technician and an organization account.
    const p7Id = p7Entry?.id ?? "00000000-0000-0000-0000-000000000000";
    const p7Echo = {
      list: (await asSeedUser(ECHO, "professional-logbook")).data?.entries?.some(
        (e) => e.id === p7Id,
      ),
      rest: await seedRest(ECHO, `logbook_entries?select=id&id=eq.${p7Id}`),
      edit: (
        await asSeedUser(ECHO, "professional-logbook", {
          method: "PATCH",
          query: { id: p7Id },
          body: { hours: 1 },
        })
      ).error?.code,
      archive: (
        await asSeedUser(ECHO, "professional-logbook", {
          method: "PATCH",
          query: { id: p7Id },
          body: { archived: true },
        })
      ).error?.code,
      remove: (
        await asSeedUser(ECHO, "professional-logbook", { method: "DELETE", query: { id: p7Id } })
      ).error?.code,
      // S-2: the owner is the JWT subject; a payload naming delta is refused by the strict schema.
      impersonate: (
        await asSeedUser(ECHO, "professional-logbook", {
          method: "POST",
          headers: { "Idempotency-Key": crypto.randomUUID() },
          body: {
            entryDate: p7Today,
            aircraft: p7Aircraft,
            hours: 1,
            category: "inspection",
            environment: "workshop",
            description: "P07 impersonation attempt",
            technicianProfileId: p7Id,
          },
        })
      ).error?.code,
    };
    const p7Mro = (
      await asSeedUser(MRO, "professional-logbook", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: {
          entryDate: p7Today,
          aircraft: "P07 org",
          hours: 1,
          category: "inspection",
          environment: "workshop",
          description: "P07 organization attempt",
        },
      })
    ).error?.code;
    const p7Intact = (await p7List()).mine.find((e) => e.id === p7Id);
    ok(
      "PKG P07 6 negatives (API; TEC-06 #14, BR-17.4, S-2): echo does not list delta's entry (function and PostgREST), gets NOT_FOUND on edit, archive and delete, and cannot create one naming delta (VALIDATION_ERROR); an organization account cannot create an entry (FORBIDDEN); the entry is intact (2 h, active)",
      p7Echo.list === false &&
        Array.isArray(p7Echo.rest) &&
        p7Echo.rest.length === 0 &&
        p7Echo.edit === "NOT_FOUND" &&
        p7Echo.archive === "NOT_FOUND" &&
        p7Echo.remove === "NOT_FOUND" &&
        p7Echo.impersonate === "VALIDATION_ERROR" &&
        p7Mro === "FORBIDDEN" &&
        p7Intact?.view === "active" &&
        p7Intact.hours === 2,
      JSON.stringify({ ...p7Echo, mro: p7Mro, intact: p7Intact?.hours }).slice(0, 240),
    );

    await p7Row().getByRole("button", { name: "Archivar" }).click();
    const p7Archived = await p7Status("Logbook actualizado");
    await page.waitForFunction(
      (a) => !document.querySelector("main")?.innerText.includes(a),
      p7Aircraft,
      { timeout: 15000 },
    );
    await page.getByRole("link", { name: "Ver archivo" }).click();
    await page.waitForURL(/view=archived/);
    await page.waitForLoadState("networkidle");
    const p7ArchivePage = await p7Main();
    const p7ArchiveRow = (
      await p7Row()
        .innerText()
        .catch(() => "no row")
    ).replace(/\s+/g, " ");
    ok(
      "PKG P07 7 archive (TEC-06 #13): «Archivar» → «Logbook actualizado» and the row leaves the history; «Ver archivo» → `?view=archived`, «Entradas archivadas» with the row («Restaurar», «Eliminar»; no «Editar», «Archivar» or selection) and «Ver activas»",
      p7Archived &&
        /Entradas archivadas/.test(p7ArchivePage) &&
        (await p7Row().count()) === 1 &&
        (await p7Row().getByRole("button", { name: "Restaurar" }).count()) === 1 &&
        (await p7Row().getByRole("button", { name: "Eliminar" }).count()) === 1 &&
        (await p7Row().getByRole("button", { name: "Editar" }).count()) === 0 &&
        (await p7Row().getByRole("button", { name: "Archivar" }).count()) === 0 &&
        !p7ArchiveRow.includes("Seleccionable para expediente") &&
        (await page.getByRole("link", { name: "Ver activas" }).count()) === 1,
      `status=${p7Archived} ${p7ArchivePage.slice(0, 160)}`,
    );

    await p7Row().getByRole("button", { name: "Restaurar" }).click();
    const p7Restored = await p7Status("Logbook actualizado");
    await page.getByRole("link", { name: "Ver activas" }).click();
    await page.waitForURL((u) => u.pathname === LB && !u.search.includes("archived"));
    await page.waitForLoadState("networkidle");
    const p7Back = (await p7Row().count()) === 1;
    await p7Row().getByRole("button", { name: "Archivar" }).click();
    await p7Status("Logbook actualizado");
    await page.goto(`${BASE}${LB}?view=archived`);
    await page.waitForLoadState("networkidle");
    await p7Row().getByRole("button", { name: "Eliminar" }).click();
    const p7Confirm =
      (await p7Row().getByRole("button", { name: "Eliminar definitivamente" }).count()) === 1 &&
      (await p7Row().getByRole("button", { name: "Cancelar" }).count()) === 1;
    await p7Row().getByRole("button", { name: "Eliminar definitivamente" }).click();
    const p7Deleted = await p7Status("Entrada eliminada");
    await page.reload();
    await page.waitForLoadState("networkidle");
    const p7Final = await p7List();
    const p7EmptyArchive = /No hay entradas archivadas\./.test(await p7Main());
    ok(
      "PKG P07 8 restore and delete (TEC-06 #13; T-22): «Restaurar» → «Logbook actualizado» and «Ver activas» shows the row again; archived once more, «Eliminar» asks «Eliminar definitivamente» / «Cancelar» → «Entrada eliminada»; the row is gone in both views and «No hay entradas archivadas.» shows iff the archive is empty",
      p7Restored &&
        p7Back &&
        p7Confirm &&
        p7Deleted &&
        (await p7Row().count()) === 0 &&
        p7Final.mine.length === 0 &&
        p7EmptyArchive === (p7Final.total.archived === 0),
      `restored=${p7Restored} back=${p7Back} confirm=${p7Confirm} deleted=${p7Deleted} left=${p7Final.mine.length} archived=${p7Final.total.archived} empty=${p7EmptyArchive}`,
    );
    await logout();

    await login(MRO);
    await page.goto(`${BASE}${LB}`);
    await page.waitForLoadState("networkidle");
    const p7OrgPage = await p7Main();
    const p7OrgNav = await page.locator(`nav a[href='${LB}']`).count();
    ok(
      "PKG P07 9 negative (browser): an organization account on the logbook URL reads «No professional profile» / «The logbook belongs to professional accounts.», no entry form, no «Logbook» entry",
      /No professional profile/.test(p7OrgPage) &&
        /The logbook belongs to professional accounts\./.test(p7OrgPage) &&
        (await page.locator("#entryDate").count()) === 0 &&
        p7OrgNav === 0,
      p7OrgPage.slice(0, 120),
    );
    await logout();
  } finally {
    // Restore: every P07 entry of delta deleted (both views), delta back in English, the locale cookie gone.
    const p7Left = (await p7List()).mine;
    const p7Removed = [];
    for (const e of p7Left) {
      p7Removed.push(
        (await asSeedUser(DELTA, "professional-logbook", { method: "DELETE", query: { id: e.id } }))
          .data?.deleted === true,
      );
    }
    const p7Locale =
      (await asSeedUser(DELTA, "user-preferences", { method: "PATCH", body: { locale: "en" } }))
        .ok === true;
    // `p7Es` also set the browser's locale cookie (the settings action): the blocks that follow expect English.
    await ctx.clearCookies({ name: "crewflex-locale" });
    const p7Check = (await p7List()).mine;
    ok(
      "PKG P07 10 restore: nothing of the smoke left in the logbook (both views), delta in English",
      p7Removed.every(Boolean) && p7Check.length === 0 && p7Locale,
      JSON.stringify({ removed: p7Removed, left: p7Check.length, locale: p7Locale }),
    );
  }
}

// PKG P08 (tools parity, F3 — TOOL-01 #1/#2/#15/#17/#23/#24/#28/#30/#33, TOOL-05 #1-#16, TOOL-06 #1-#12, TOOL-07
// #1-#19, TOOL-08 #1-#3/#9, TOOL-09, SHOT-04 #3/#5; BR-16, T-145, T-166): the v1.8 workbench in Spanish — header, hero,
// the six tiles in v1.8's order (fuel out, D-11), the privacy note, a favourite (star, «Tus favoritos» chip with a 17 px
// icon, kept after a reload); «Inglés y siglas» (tabs, «102 entradas · 46 capítulos de referencia», «Todos» + the 13 areas,
// trimmed accent-free search, the entry with «Copiar ficha», the empty text, the ATA index that keeps the search and has an
// empty state, «hidraulica» → 29, the 21-card practice, the 4 sources); «Traductor» (one h1, EN → ES, 5 rows / 2000,
// «fuel» → «Combustible», the two suggestions, swap keeps the text, no match texts, the Google link only after the consent
// tick that any edit clears, no request leaves); «Reto diario» (one h1, the Madrid day, 0 → «1 día» ICU, «Diez minutos para
// ti» with 10, 5 questions with feedback, «Reto completado», no repeat after a reload, the medals with one set of names,
// the editorial footnote, progress stored under the user's id with ids and answers only); «Logros de aprendizaje» in Mi
// espacio with the ICU line; five widths. Negatives: no session → 307 to /login and /tools/daily is a 404; echo on the same
// browser sees none of delta's progress (a key per user id); an organization account shares the bench (v1.8 roles).
// Restore: the learning key(s) the smoke created are removed, favourites put back, delta in English, the locale cookie gone.
{
  const DELTA = "delta@crewflex.test";
  const ECHO = "echo@crewflex.test";
  const MRO = "admin.mro@crewflex.test";
  const p8Today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(
    new Date(),
  );
  // `formatDate("es", "YYYY-MM-DD")`: day · short month · year, rendered in UTC (BR-10).
  const p8Date = new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${p8Today}T00:00:00Z`));
  const p8Main = async () => (await page.locator("main").innerText()).replace(/\s+/g, " ");
  const p8Es = async () => {
    await page.goto(`${BASE}/app/settings`);
    await page.waitForLoadState("networkidle");
    if ((await page.evaluate(() => document.documentElement.lang)) === "es") return;
    await page.locator("[role=radio][lang=es]").first().click();
    await page.waitForSelector("[role=status]:has-text('Idioma actualizado')", { timeout: 15000 });
  };
  const p8Keys = () =>
    page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith("crewflex-learning-")),
    );
  const p8Overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
  const P8_AREAS = [
    "Todos",
    "Mecánica",
    "Verbos",
    "Dirección",
    "Electricidad",
    "Fluidos",
    "Estado",
    "Estructuras",
    "Materiales",
    "Inspección",
    "Combustible",
    "Medición",
    "Documentación",
    "Siglas",
  ];
  let p8KeysBefore = [];
  let p8FavoritesBefore = null;
  try {
    await login(DELTA);
    await p8Es();
    await page.goto(`${BASE}/app/tools`);
    await page.waitForLoadState("networkidle");
    await expectSpanish("PKG P08 0 «Herramientas» in Spanish");
    p8KeysBefore = await p8Keys();
    p8FavoritesBefore = await page.evaluate(() => localStorage.getItem("crewflex-tool-favorites"));
    const p8Home = await p8Main();
    const p8Tiles = (
      await page.locator("main section:not([aria-labelledby]) h2").allInnerTexts()
    ).join("|");
    ok(
      "PKG P08 0b v1.8 workbench home (TOOL-01 #5-#8, #11-#14, #23-#30, #33; SHOT-04 #1-#5): one h1 «Para cada jornada.» under «TU CAJA DE HERRAMIENTAS» + «Cálculos claros…»; hero «CREWFLEX · WORKBENCH» / «Tu oficio, un poco más sencillo.» / «Abrir conversor de par» → /app/tools/torque; the six tiles in v1.8's order with their subtitles, no fuel tile (D-11); the privacy note names favourites and challenge progress; «Herramientas» current in the menu",
      (await page.locator("main h1").count()) === 1 &&
        /TU CAJA DE HERRAMIENTAS Para cada jornada\. Cálculos claros\. Unidades visibles\. Referencias a mano\./.test(
          p8Home,
        ) &&
        /CREWFLEX · WORKBENCH Tu oficio, un poco más sencillo\./.test(p8Home) &&
        (await page
          .locator("main a[href='/app/tools/torque']", { hasText: "Abrir conversor de par" })
          .count()) === 1 &&
        p8Tiles === "Reto diario|Traductor|Par de apriete|Conversiones|Inglés y siglas|Duración" &&
        /5 o 10 preguntas · rachas/.test(p8Home) &&
        /Español · inglés · francés/.test(p8Home) &&
        /N·m · lbf·ft · lbf·in/.test(p8Home) &&
        /22 magnitudes técnicas/.test(p8Home) &&
        /Diccionario · ATA · práctica/.test(p8Home) &&
        /HH:MM y horas decimales/.test(p8Home) &&
        (await page.locator("main a[href*='fuel']").count()) === 0 &&
        /Tu uso de herramientas es privado: los cálculos se hacen en tu navegador y no se envían a ningún servidor\. Tus favoritos y el progreso de los retos se guardan en este navegador\./.test(
          p8Home,
        ) &&
        (await page.locator("aside a[href='/app/tools'][aria-current=page]").count()) === 1,
      `${p8Tiles} · ${p8Home.slice(0, 160)}`,
    );

    // 1. Favourite (TOOL-01 #16-#21, #31): star → chip, kept after a reload, removed again.
    const p8Star = page.locator("main button[aria-label='Añadir favorito Par de apriete']");
    const p8StarBefore = await p8Star.count();
    await p8Star.click();
    const p8Chip = page.locator(
      "section[aria-labelledby=tool-favorites] a[href='/app/tools/torque']",
    );
    await p8Chip.waitFor({ timeout: 10000 });
    const p8Icon = await p8Chip.locator("svg").boundingBox();
    await page.reload();
    await page.waitForLoadState("networkidle");
    const p8Stored = await page.evaluate(() => localStorage.getItem("crewflex-tool-favorites"));
    const p8ChipAfterReload = await p8Chip.count();
    const p8Pressed = page.locator("main button[aria-label='Quitar favorito Par de apriete']");
    const p8PressedState = await p8Pressed.getAttribute("aria-pressed");
    await p8Pressed.click();
    await page.waitForTimeout(300);
    ok(
      "PKG P08 1 favourite (TOOL-01 #16-#21, #31): «Añadir favorito Par de apriete» → «Tus favoritos» chip to /app/tools/torque with a 17 px icon; kept after a reload (`crewflex-tool-favorites` lists `torque`, aria-pressed=true); «Quitar favorito…» removes the block",
      p8StarBefore === 1 &&
        p8Icon !== null &&
        Math.round(p8Icon.width) === 17 &&
        p8ChipAfterReload === 1 &&
        JSON.parse(p8Stored ?? "[]").includes("torque") &&
        p8PressedState === "true" &&
        (await p8Chip.count()) === 0 &&
        (await p8Star.count()) === 1,
      `icon=${p8Icon?.width} stored=${p8Stored} pressed=${p8PressedState}`,
    );

    // 2. «Inglés y siglas» (TOOL-05).
    await page.goto(`${BASE}/app/tools/knowledge`);
    await page.waitForLoadState("networkidle");
    const p8Search = page.getByRole("searchbox", { name: "Buscar término, sigla o ATA" });
    const p8Areas = (await page.locator("#knowledge-area option").allInnerTexts()).join("|");
    const p8KnowledgeHead = await p8Main();
    const p8TermsPressed = await page
      .getByRole("button", { name: "Diccionario ES / EN" })
      .getAttribute("aria-pressed");
    const p8PlaceholderTerms = await p8Search.getAttribute("placeholder");
    await p8Search.fill(" TORQUE ");
    await page
      .getByRole("button", { name: /^Torque\b/ })
      .first()
      .click();
    const p8Entry = await p8Main();
    await p8Search.fill("zzzz");
    const p8EmptyTerms = await page.locator("main [role=status]").allInnerTexts();
    await page.getByRole("button", { name: "Índice ATA" }).click();
    const p8SearchKept = await p8Search.inputValue();
    const p8PlaceholderAta = await p8Search.getAttribute("placeholder");
    const p8EmptyAta = await page.locator("main [role=status]").allInnerTexts();
    await p8Search.fill("hidraulica");
    const p8Ata29 = (await page.locator("main ul[lang=es] li").allInnerTexts())
      .map((x) => x.replace(/\s+/g, " ").trim())
      .join("|");
    await p8Search.fill("28");
    const p8Ata28 = (await page.locator("main ul[lang=es] li").allInnerTexts())
      .map((x) => x.replace(/\s+/g, " ").trim())
      .join("|");
    await page.getByRole("button", { name: "Práctica breve" }).click();
    const p8Practice1 = await p8Main();
    await page.getByRole("button", { name: "Mostrar significado" }).click();
    const p8Revealed = await page.getByRole("button", { name: "Siguiente término" }).count();
    await page.getByRole("button", { name: "Siguiente término" }).click();
    const p8Practice2 = await p8Main();
    const p8Sources = await page
      .locator("main details a[target=_blank][rel=noreferrer]")
      .evaluateAll((as) => as.map((a) => `${a.textContent.trim()} ${a.getAttribute("href")}`));
    ok(
      "PKG P08 2 «Inglés y siglas» (TOOL-05 #1-#16): one h1; «Diccionario ES / EN» pressed, «102 entradas · 46 capítulos de referencia», the two placeholders; «Todos» + the 13 areas in v1.8's order; « TORQUE » (trimmed, case-free) → the Torque entry: «Mecánica» / «Torque» / «Par de apriete» / «Referencia editorial inicial · 2026-10-13.1» / «Copiar ficha» (not «Copiar con unidades»); «zzzz» → «No hay entradas para esta búsqueda…»; «Índice ATA» keeps the search and has an empty state; «hidraulica» → «29 Energía hidráulica»; «28» → Combustible; «Práctica breve» 1/21 → «Mostrar significado» → «Siguiente término» → 2/21 + «Ejemplos originales de lenguaje…»; «Fuentes y revisión editorial» with the 4 v1.8 links",
      (await page.locator("main h1").count()) === 1 &&
        /^Inglés y siglas$/.test((await page.locator("main h1").innerText()).trim()) &&
        p8TermsPressed === "true" &&
        /102 entradas · 46 capítulos de referencia/.test(p8KnowledgeHead) &&
        p8PlaceholderTerms === "Término, sigla o significado: torque, holgura, AMM…" &&
        p8PlaceholderAta === "Número o sistema: 28, combustible…" &&
        p8Areas === P8_AREAS.join("|") &&
        /Mecánica Torque Par de apriete/.test(p8Entry) &&
        /Referencia editorial inicial · 2026-10-13\.1/.test(p8Entry) &&
        /Copiar ficha/.test(p8Entry) &&
        !/Copiar con unidades/.test(p8Entry) &&
        p8EmptyTerms.some((x) =>
          /No hay entradas para esta búsqueda\. Prueba el término inglés o una sigla\./.test(x),
        ) &&
        p8SearchKept === "zzzz" &&
        p8EmptyAta.some((x) => /Ningún capítulo coincide con esta búsqueda/.test(x)) &&
        p8Ata29 === "29 Energía hidráulica" &&
        /^28 Combustible$/.test(p8Ata28) &&
        /INGLÉS TÉCNICO · 1\/21/.test(p8Practice1) &&
        p8Revealed === 1 &&
        /INGLÉS TÉCNICO · 2\/21/.test(p8Practice2) &&
        /Ejemplos originales de lenguaje; no son instrucciones para una tarea concreta\./.test(
          p8Practice2,
        ) &&
        p8Sources.join("|") ===
          "FAA · Aviation Maintenance Technician Handbooks https://www.faa.gov/regulations_policies/handbooks_manuals/aviation|ASD-STE100 · Inglés técnico simplificado https://www.asd-ste100.org/about_STE.html|ATA · Estándares de documentación https://ataebiz.org/standards/|EASA · Part-145 https://www.easa.europa.eu/en/the-agency/faqs/part-145",
      `areas=${p8Areas} · ata=${p8Ata29}/${p8Ata28} · empty=${p8EmptyTerms.join(";")} / ${p8EmptyAta.join(";")} · sources=${p8Sources.length}`,
    );

    // 3. «Traductor» (TOOL-06). The external link is read, never followed.
    await page.goto(`${BASE}/app/tools/translator`);
    await page.waitForLoadState("networkidle");
    const p8Translator = await p8Main();
    const p8Pair = async () => [
      await page.locator("#translator-from").inputValue(),
      await page.locator("#translator-to").inputValue(),
    ];
    const p8PairStart = await p8Pair();
    const p8Rows = await page.locator("#translator-text").getAttribute("rows");
    const p8Max = await page.locator("#translator-text").getAttribute("maxlength");
    const p8Counter0 = await page.locator("#translator-count").innerText();
    const p8AllSuggestions = await page.locator("main ul li button").count();
    await page.fill("#translator-text", "fu");
    const p8Suggested = (await page.locator("main ul li button b").allInnerTexts()).join("|");
    await page.fill("#translator-text", "fuel");
    const p8Live = page.locator("main [aria-live=polite]").first();
    const p8Match = await p8Live.innerText();
    await page.getByRole("button", { name: "Intercambiar idiomas" }).click();
    const p8PairSwapped = await p8Pair();
    const p8TextSwapped = await page.locator("#translator-text").inputValue();
    await page.fill("#translator-text", "xyz");
    await page.getByRole("button", { name: "Intercambiar idiomas" }).click();
    const p8TextKept = await page.locator("#translator-text").inputValue();
    const p8NoMatch = await p8Main();
    await page.getByText("Traducir texto libre con Google Translate").click();
    const p8External = page.locator("main a[href^='https://translate.google.com/']");
    const p8HintBefore = await page
      .getByText("Introduce texto, elige idiomas distintos y confirma el envío.")
      .count();
    const p8LinkBefore = await p8External.count();
    await page.getByLabel("Quiero enviar este texto a Google para traducirlo.").check();
    const p8Href = await p8External.getAttribute("href");
    await page.fill("#translator-text", "xyz2");
    const p8ConsentAfterEdit = await page
      .getByLabel("Quiero enviar este texto a Google para traducirlo.")
      .isChecked();
    const p8LinkAfterEdit = await p8External.count();
    ok(
      "PKG P08 3 «Traductor» (TOOL-06 #1-#12): one h1 «Traductor» (no second header); «IDIOMAS · ES / EN / FR» / «Traductor de apoyo» / the lead; EN → ES by default; textarea 5 rows, 2000 max, «0/2000 caracteres · no se guarda el texto.»; «Repertorio sin conexión» with the 32 rows; «fu» → the 2 suggestions (Fuel, Fuselage); «fuel» → «Equivalencia del repertorio local» «Combustible»; swap → ES → EN with «Combustible» kept; «xyz» survives a swap (v1.8 emptied it) with «Sin coincidencia exacta local…» + «No hay sugerencias locales para este texto.»; the Google link only after the consent tick (sl/tl/text), gone again after an edit; the footnote; no request to translate.google.com",
      (await page.locator("main h1").count()) === 1 &&
        /^Traductor$/.test((await page.locator("main h1").innerText()).trim()) &&
        /IDIOMAS · ES \/ EN \/ FR Traductor de apoyo Repertorio técnico local y acceso a traducción libre con conexión\./.test(
          p8Translator,
        ) &&
        p8PairStart.join(">") === "en>es" &&
        p8Rows === "5" &&
        p8Max === "2000" &&
        p8Counter0 === "0/2000 caracteres · no se guarda el texto." &&
        /Repertorio sin conexión 32 términos y frases originales de apoyo\. No es un traductor automático completo\./.test(
          p8Translator,
        ) &&
        p8AllSuggestions === 32 &&
        /Equivalencia del repertorio local\s+Combustible/i.test(p8Match) &&
        p8Suggested === "Fuel|Fuselage" &&
        p8PairSwapped.join(">") === "es>en" &&
        p8TextSwapped === "Combustible" &&
        p8TextKept === "xyz" &&
        /Sin coincidencia exacta local\. Puedes consultar las sugerencias o abrir la traducción libre externa\./.test(
          p8NoMatch,
        ) &&
        /No hay sugerencias locales para este texto\./.test(p8NoMatch) &&
        /El significado depende del contexto\. Traducciones de apoyo pendientes de revisión editorial; no sustituyen instrucciones de mantenimiento controladas\./.test(
          p8NoMatch,
        ) &&
        p8HintBefore === 1 &&
        p8LinkBefore === 0 &&
        p8Href === "https://translate.google.com/?sl=en&tl=es&text=xyz&op=translate" &&
        p8ConsentAfterEdit === false &&
        p8LinkAfterEdit === 0 &&
        ![...hosts].some((h) => /google/.test(h)),
      `pair=${p8PairStart}/${p8PairSwapped} text=${p8TextSwapped}/${p8TextKept} href=${p8Href} suggested=${p8Suggested} n=${p8AllSuggestions}`,
    );

    // 4. «Reto diario» (TOOL-07, TOOL-08 #1-#3): delta has no progress in this browser yet (a key per user id).
    await page.goto(`${BASE}/app/tools/daily`);
    await page.waitForLoadState("networkidle");
    const p8Start = page.getByRole("button", { name: "Comenzar reto de hoy" });
    await p8Start.waitFor({ timeout: 15000 });
    const p8Intro = await p8Main();
    const p8IntroTitle = page.locator("main h2", { hasText: /minutos para ti/ });
    await page.getByRole("button", { name: "10 preguntas" }).click();
    const p8Ten = await p8IntroTitle.innerText();
    await page.getByRole("button", { name: "5 preguntas" }).click();
    const p8Five = await p8IntroTitle.innerText();
    await p8Start.click();
    await page.getByText("Pregunta 1 de 5").waitFor({ timeout: 10000 });
    const p8Q1 = await p8Main();
    const p8Options = page.locator("main [role=group][aria-label=Respuestas] button");
    const p8Confirm = page.getByRole("button", { name: "Confirmar respuesta" });
    const p8DisabledBefore = await p8Confirm.isDisabled();
    const p8OptionCount = await p8Options.count();
    let p8Feedback = false;
    for (let i = 1; i <= 5; i++) {
      await p8Options.first().click();
      await p8Confirm.click();
      if (i < 5) {
        await page.getByText(`Pregunta ${i + 1} de 5`).waitFor({ timeout: 10000 });
        if (i === 1)
          p8Feedback = /Respuesta anterior correcta|Repaso de la respuesta anterior/.test(
            (await page.locator("main [role=status]").allInnerTexts()).join(" "),
          );
      }
    }
    await page.getByText("Reto completado").waitFor({ timeout: 10000 });
    const p8Done = await p8Main();
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.getByText("Reto completado").waitFor({ timeout: 15000 });
    const p8AfterReload = await p8Main();
    const p8KeysAfter = await p8Keys();
    const p8NewKeys = p8KeysAfter.filter((k) => !p8KeysBefore.includes(k));
    const p8Record = await page.evaluate(
      ([k, d]) => {
        const parsed = JSON.parse(localStorage.getItem(k) ?? "{}");
        const day = parsed[d];
        return {
          days: Object.keys(parsed),
          fields: day ? Object.keys(day).sort() : [],
          ids: day?.ids?.length,
          answers: day?.answers?.length,
          raw: JSON.stringify(parsed),
        };
      },
      [p8NewKeys[0] ?? "", p8Today],
    );
    ok(
      "PKG P08 4 «Reto diario» (TOOL-07 #1-#19, TOOL-08 #1, #3, #9): one h1 «Reto diario»; «APRENDE UN POCO CADA DÍA» / «Tu reto aeronáutico» / «… · {hoy} · día de referencia: Madrid»; «Racha actual 0 días», «Mejor racha 0 días», «Días completados 0»; «Cinco minutos para ti» ↔ «Diez minutos para ti» with 10 (v1.8 kept «Cinco»); «Comenzar reto de hoy» → «Fundamentos · Pregunta 1 de 5», «Progreso del reto», 4 options, «Confirmar respuesta» disabled until a choice; feedback after an answer; «Reto completado», «{n} de 5 respuestas correctas», «Has sumado un día…», «Revisar respuestas y explicaciones»; «1 día» (ICU) in both streaks and 1 completed; medals «Primer reto · Desbloqueado», «Una semana aprendiendo» / «Constancia de 30 días» · «Por conseguir · 7 / 30 días seguidos»; the editorial footnote; still completed after a reload (no repeat); one new key `crewflex-learning-<user id>` with only `ids` (5) and `answers` (5) for today",
      (await page.locator("main h1").count()) === 1 &&
        /APRENDE UN POCO CADA DÍA Tu reto aeronáutico Fundamentos, inglés, siglas y sistemas ATA · /.test(
          p8Intro,
        ) &&
        p8Intro.includes(`· ${p8Date} · día de referencia: Madrid`) &&
        /Racha actual 0 días Mejor racha 0 días Días completados 0/i.test(p8Intro) && // labels uppercased by CSS &&
        /Cinco minutos para ti/.test(p8Intro) &&
        /Elige 5 o 10 preguntas\. Recibirás una explicación después de cada respuesta\. El reto cambia cada día\./.test(
          p8Intro,
        ) &&
        p8Ten === "Diez minutos para ti" &&
        p8Five === "Cinco minutos para ti" &&
        /Fundamentos · Pregunta 1 de 5/.test(p8Q1) &&
        (await page.locator("main progress[aria-label='Progreso del reto']").count()) === 0 && // finished: no bar
        p8OptionCount === 4 &&
        p8DisabledBefore === true &&
        p8Feedback &&
        /Reto completado [0-5] de 5 respuestas correctas Has sumado un día de aprendizaje\. Vuelve mañana para continuar tu racha\. Revisar respuestas y explicaciones/.test(
          p8Done,
        ) &&
        /Racha actual 1 día Mejor racha 1 día Días completados 1/i.test(p8Done) &&
        /Tu colección de constancia Primer reto Desbloqueado Una semana aprendiendo Por conseguir · 7 días seguidos Constancia de 30 días Por conseguir · 30 días seguidos/.test(
          p8Done,
        ) &&
        /Completar el reto suma un día, aunque haya errores\. Repetir o recargar no suma días extra\./.test(
          p8Done,
        ) &&
        /Contenido editorial de formación, no examen habilitante\. Los logros no acreditan cualificación ni influyen en la selección profesional\. No incluye procedimientos ni extractos de AMM\/TCM\. Catálogo inicial pendiente de revisión formal\./.test(
          p8Done,
        ) &&
        /Reto completado/.test(p8AfterReload) &&
        !/Comenzar reto de hoy/.test(p8AfterReload) &&
        p8NewKeys.length === 1 &&
        /^crewflex-learning-[0-9a-f-]{36}$/.test(p8NewKeys[0]) &&
        p8Record.days.join() === p8Today &&
        p8Record.fields.join() === "answers,ids" &&
        p8Record.ids === 5 &&
        p8Record.answers === 5 &&
        !/prompt|explanation/.test(p8Record.raw),
      `keys=${p8NewKeys.join()} record=${JSON.stringify(p8Record).slice(0, 160)} ten=${p8Ten}`,
    );

    // 5. «Logros de aprendizaje» in Mi espacio (TOOL-08 #2, #3, #9): the same medals and the ICU line.
    await page.goto(`${BASE}/app/professional`);
    await page.waitForLoadState("networkidle");
    await page.getByText("Racha actual: 1 día").waitFor({ timeout: 15000 });
    const p8Space = await p8Main();
    ok(
      "PKG P08 5 «Logros de aprendizaje» in Mi espacio (TOOL-08 #2, #3, #9): «Privados en este navegador · separados de las cualificaciones.», «Primer reto · Desbloqueado» with the same names as the challenge, «Racha actual: 1 día · Mejor racha: 1 día · Retos completados: 1» (v1.8 «1 días»), «Las insignias resumen datos declarados. No conceden autorización de firma…», «Abrir el reto diario»",
      /Logros de aprendizaje/.test(p8Space) &&
        /Privados en este navegador · separados de las cualificaciones\./.test(p8Space) &&
        /Primer reto Desbloqueado Una semana aprendiendo Por conseguir · 7 días seguidos Constancia de 30 días Por conseguir · 30 días seguidos/.test(
          p8Space,
        ) &&
        /Racha actual: 1 día · Mejor racha: 1 día · Retos completados: 1/.test(p8Space) &&
        /Las insignias resumen datos declarados\. No conceden autorización de firma ni sustituyen la revisión de licencia, tipo o competencia\./.test(
          p8Space,
        ) &&
        (await page
          .locator("main a[href='/app/tools/daily']", { hasText: "Abrir el reto diario" })
          .count()) === 1,
      p8Space.slice(0, 120),
    );

    // 6. Five widths on the home and the challenge, no horizontal overflow.
    const p8Widths = [];
    for (const path of ["/app/tools", "/app/tools/daily"]) {
      await page.goto(`${BASE}${path}`);
      await page.waitForLoadState("networkidle");
      for (const width of [1440, 1024, 768, 390, 360]) {
        await page.setViewportSize({ width, height: width < 800 ? 1100 : 900 });
        await page.waitForTimeout(250);
        if (await p8Overflow()) p8Widths.push(`${path}@${width}`);
        if (path === "/app/tools" && (width === 1440 || width === 390))
          await shot(`P08-tools-after-${width}`);
        if (path === "/app/tools/daily" && width === 390) await shot(`P08-daily-after-${width}`);
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    ok(
      "PKG P08 6 @1440/1024/768/390/360: no horizontal overflow on /app/tools and /app/tools/daily",
      p8Widths.length === 0,
      p8Widths.join(","),
    );
    await logout();

    // 7. Negatives without a session: the daily challenge needs an account (T-145); it has no public route.
    const p8Anon = await page.request.get(`${BASE}/app/tools/daily`, { maxRedirects: 0 });
    const p8PublicDaily = await page.request.get(`${BASE}/tools/daily`, { maxRedirects: 0 });
    const p8PublicHome = await page.request.get(`${BASE}/tools`, { maxRedirects: 0 });
    ok(
      "PKG P08 7 negative (no session): /app/tools/daily → 307 to /login?next=…; /tools/daily → 404 (T-145: the challenge needs an account); /tools → 200",
      p8Anon.status() === 307 &&
        /\/login\?next=%2Fapp%2Ftools%2Fdaily$/.test(p8Anon.headers().location ?? "") &&
        p8PublicDaily.status() === 404 &&
        p8PublicHome.status() === 200,
      `${p8Anon.status()} ${p8Anon.headers().location} · ${p8PublicDaily.status()} · ${p8PublicHome.status()}`,
    );

    // 8. Negative: echo on the same browser (delta's key still stored) sees no progress and creates no key by looking.
    await login(ECHO);
    await page.goto(`${BASE}/app/tools/daily`);
    await page.waitForLoadState("networkidle");
    const p8EchoStart = page.locator(
      "main button:has-text('Start today\\'s challenge'), main button:has-text('Comenzar reto de hoy')",
    );
    await p8EchoStart.waitFor({ timeout: 15000 });
    const p8EchoPage = await p8Main();
    const p8EchoKeys = await p8Keys();
    ok(
      "PKG P08 8 negative (another user, same browser): echo gets the start screen with 0 days, not delta's completed challenge; delta's key is untouched and no key is created for echo by looking",
      /Reto completado|Challenge completed/.test(p8EchoPage) === false &&
        /0 (días|days)/.test(p8EchoPage) &&
        p8EchoKeys.join() === p8KeysAfter.join(),
      `${p8EchoKeys.length} keys · ${p8EchoPage.slice(0, 100)}`,
    );
    await logout();

    // 9. An organization account shares the bench (v1.8: technician, company and recruiter roles all have tools).
    await login(MRO);
    await page.goto(`${BASE}/app/tools`);
    await page.waitForLoadState("networkidle");
    const p8OrgTiles = await page.locator("main section:not([aria-labelledby]) h2").count();
    await page.goto(`${BASE}/app/tools/knowledge`);
    await page.waitForLoadState("networkidle");
    const p8OrgKnowledge = await p8Main();
    ok(
      "PKG P08 9 an organization account uses the same six tools (TOOL-01 #1: every signed-in account); «Inglés y siglas» renders its 102 entries for it",
      p8OrgTiles === 6 && /102/.test(p8OrgKnowledge) && /46/.test(p8OrgKnowledge),
      `tiles=${p8OrgTiles}`,
    );
    await logout();
  } finally {
    // Restore: the smoke's learning key(s) removed, favourites as before, delta in English, the locale cookie gone.
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState("networkidle");
    const p8Removed = await page.evaluate(
      ([before, favorites]) => {
        const removed = [];
        for (const k of Object.keys(localStorage)) {
          if (k.startsWith("crewflex-learning-") && !before.includes(k)) {
            localStorage.removeItem(k);
            removed.push(k);
          }
        }
        if (favorites === null) localStorage.removeItem("crewflex-tool-favorites");
        else localStorage.setItem("crewflex-tool-favorites", favorites);
        return {
          removed,
          keys: Object.keys(localStorage).filter((k) => k.startsWith("crewflex-learning-")),
          favorites: localStorage.getItem("crewflex-tool-favorites"),
        };
      },
      [p8KeysBefore, p8FavoritesBefore],
    );
    const p8Locale =
      (await asSeedUser(DELTA, "user-preferences", { method: "PATCH", body: { locale: "en" } }))
        .ok === true;
    // `p8Es` also set the browser's locale cookie (the settings action): the blocks that follow expect English.
    await ctx.clearCookies({ name: "crewflex-locale" });
    ok(
      "PKG P08 10 restore: the smoke's learning key removed (the earlier ones untouched), favourites as before, delta in English",
      p8Removed.keys.join() === p8KeysBefore.join() &&
        p8Removed.favorites === p8FavoritesBefore &&
        p8Locale,
      JSON.stringify(p8Removed).slice(0, 160),
    );
  }
}

// PKG P09 (organization dashboard parity, F3 — ORG-01 #1/#3-#11/#19/#21-#27/#32, ORG-07 #1-#5/#7/#8/#12/#14/#16,
// SHOT-05 #1-#6; T-146, T-167): the v1.8 company «Resumen» in Spanish — header, the `.dashboard-hero` (two chips,
// «El técnico adecuado. Las fechas adecuadas.», the sentence, «Explorar candidatos →» to the directory, the «CF /
// AVIATION» mark), the four KPIs in v1.8's order with their details («Red visible» = the directory's own total, real
// data), the needs panel with «{p}% cubierto», «Cómo cerrar una cobertura», the quick links and the note; the
// «Organización» screen (status chip, review note, the five fields, the 27 EU countries, «Guardar organización», the
// last-15 activity). Negatives: a plain member gets the hero without its CTA, one KPI, no quick links, a read-only
// organization and the managers-only notice on the directory; another organization's admin sees only its own needs,
// a 404 on a Demo MRO need, and the profile function and the network count refuse Demo MRO's id. Five widths.
// Restore: the three accounts back to English, the locale cookie gone. No write to the database.
{
  const ADMIN = "admin.mro@crewflex.test";
  const MEMBER = "charlie@crewflex.test";
  const OTHER = "admin.other@crewflex.test";
  const p9Main = async () => (await page.locator("main").innerText()).replace(/\s+/g, " ");
  const p9Es = async () => {
    await page.goto(`${BASE}/app/settings`);
    await page.waitForLoadState("networkidle");
    if ((await page.evaluate(() => document.documentElement.lang)) === "es") return;
    await page.locator("[role=radio][lang=es]").first().click();
    await page.waitForSelector("[role=status]:has-text('Idioma actualizado')", { timeout: 15000 });
  };
  const p9Overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
  const p9Hero = () => page.locator("main section[aria-labelledby=org-hero-title]");
  const p9Cta = () => p9Hero().locator("a[href='/app/organization/candidates']");
  /** The dashboard KPIs: `dt` labels in document order, as written (the CSS uppercases them; the hero and the panels have none). */
  const p9Labels = async () =>
    (await page.locator("main dl dt").allInnerTexts()).map((s) => s.toLocaleLowerCase("es"));
  const p9Value = async (label) =>
    (
      await page
        .locator("main dl > div", { has: page.locator("dt", { hasText: new RegExp(label, "i") }) })
        .locator("dd")
        .first()
        .innerText()
    ).trim();
  let p9MroTitles = [];
  try {
    // 0. The admin's «Resumen» in Spanish: v1.8 order title → hero → KPIs → panels.
    await login(ADMIN);
    await p9Es();
    await page.goto(`${BASE}/app/organization`);
    await page.waitForLoadState("networkidle");
    await expectSpanish("PKG P09 0 «Resumen» in Spanish");
    const p9Home = await p9Main();
    const p9HeroText = (await p9Hero().innerText()).replace(/\s+/g, " ");
    const p9HeroBox = await p9Hero().boundingBox();
    const p9KpiBox = await page.locator("main dl").first().boundingBox();
    const p9Labs = await p9Labels();
    ok(
      "PKG P09 0b header + hero (ORG-01 #3-#7, SHOT-05 #1/#2; T-167): «DEMO MRO MADRID» / h1 «Operaciones» / «De una necesidad concreta a un equipo disponible.», «Red profesional» and «Nueva necesidad»; the hero with «CrewFlex Aviation» · «Capacidad técnica flexible», h2 «El técnico adecuado. Las fechas adecuadas.», the sentence, «Explorar candidatos →» to /app/organization/candidates and the «CF / AVIATION» mark, above the KPIs",
      (await page.locator("main h1").count()) === 1 &&
        /^DEMO MRO MADRID Operaciones De una necesidad concreta a un equipo disponible\./.test(
          p9Home,
        ) &&
        (await page
          .locator("main a[href='/app/organization/candidates']", { hasText: "Red profesional" })
          .count()) === 1 &&
        (await page
          .locator("main a[href='/app/organization/requirements/new']", {
            hasText: "Nueva necesidad",
          })
          .count()) === 1 &&
        (await p9Hero().count()) === 1 &&
        /^CrewFlex Aviation Capacidad técnica flexible El técnico adecuado\. Las fechas adecuadas\. Define cualificaciones, ventanas de disponibilidad y condiciones para encontrar perfiles realmente viables\. Explorar candidatos → CF \/ AVIATION$/.test(
          p9HeroText,
        ) &&
        (await p9Hero().locator("h2#org-hero-title").count()) === 1 &&
        (await p9Cta().count()) === 1 &&
        p9HeroBox !== null &&
        p9KpiBox !== null &&
        p9HeroBox.y + p9HeroBox.height <= p9KpiBox.y,
      `${p9HeroText.slice(0, 120)} · ${p9Labs.join("|")}`,
    );
    ok(
      "PKG P09 1 the four KPIs in v1.8's order (ORG-01 #8-#11, SHOT-05 #3; T-92, T-93, T-146): «Necesidades abiertas · De tu organización», «Candidaturas en curso · N pendientes de confirmar», «Jornadas cubiertas · Solo asignaciones confirmadas», «Red visible · Según permisos y privacidad», every value a number",
      p9Labs.join("|") ===
        "necesidades abiertas|candidaturas en curso|jornadas cubiertas|red visible" &&
        /NECESIDADES ABIERTAS \d+ De tu organización CANDIDATURAS EN CURSO \d+ \d+ pendientes? de confirmar JORNADAS CUBIERTAS \d+ Solo asignaciones confirmadas RED VISIBLE \d+ Según permisos y privacidad/.test(
          p9Home,
        ),
      p9Labs.join("|"),
    );
    // Needs panel, guide, quick links, note (ORG-01 #21-#27).
    const p9Rows = page.locator("main table tbody tr");
    const p9RowCount = await p9Rows.count();
    p9MroTitles = await page
      .locator("main table tbody tr a[href^='/app/organization/requirements/']")
      .allInnerTexts();
    ok(
      "PKG P09 2 panels (ORG-01 #21-#27, SHOT-05 #4/#5): «Necesidades» + «Ver todas» → /app/organization/requirements with ≤ 5 rows, each with «{p}% cubierto»; «Cómo cerrar una cobertura» with the 4 v1.8 steps; «Constructor · Necesidades estructuradas» and «Candidate Packs · Expedientes y seguimiento»; the non-contractual note; no «Ver comisiones» (SCOPE OUT)",
      p9RowCount >= 1 &&
        p9RowCount <= 5 &&
        (await page
          .locator("main a[href='/app/organization/requirements']", { hasText: "Ver todas" })
          .count()) === 1 &&
        (await p9Rows.filter({ hasText: /\d+[\s\u00a0]*%[\s\u00a0]*cubierto/ }).count()) ===
          p9RowCount &&
        /Cómo cerrar una cobertura Publica fechas y requisitos\. Compara candidatos elegibles\. Revisa el Candidate Pack y propone\. El técnico acepta y confirmas la asignación\./.test(
          p9Home,
        ) &&
        // P15: the guide's quick links are «Accesos directos» (the dock keeps v1.8's «Accesos rápidos»).
        (await page.locator("main nav[aria-label='Accesos directos'] a").allInnerTexts())
          .map((s) => s.replace(/\s+/g, " "))
          .join("|") ===
          "Constructor Necesidades estructuradas|Candidate Packs Expedientes y seguimiento" &&
        /Las propuestas, la aceptación del técnico y la confirmación de tu organización se registran por separado\. CrewFlex facilita el proceso; el contrato entre las partes se acuerda fuera de la plataforma\./.test(
          p9Home,
        ) &&
        !/comisi/i.test(p9Home),
      `rows=${p9RowCount} · ${p9Home.slice(-200)}`,
    );
    // 3. «Red visible» is real data: the directory's own total (T-146: one predicate, `directory_visible`).
    const p9Network = Number(await p9Value("Red visible"));
    await p9Cta().click();
    await page.waitForURL(/\/app\/organization\/candidates$/);
    await page.waitForLoadState("networkidle");
    const p9Directory = await p9Main();
    const p9DirTotal = Number(/(\d+) perfil(?:es)? · página/.exec(p9Directory)?.[1] ?? NaN);
    ok(
      "PKG P09 3 «Explorar candidatos» opens «Red profesional» and «Red visible» equals the directory's total (real data, T-146)",
      Number.isInteger(p9Network) && p9Network > 0 && p9DirTotal === p9Network,
      `kpi=${p9Network} directory=${p9DirTotal}`,
    );
    // 4. «Organización» (ORG-07 #1-#5, #7, #8, #12): the v1.8 connected screen, read without writing.
    await page.goto(`${BASE}/app/organization/settings`);
    await page.waitForLoadState("networkidle");
    await expectSpanish("PKG P09 4 «Organización» in Spanish");
    const p9Org = await p9Main();
    const p9Countries = await page.locator("main select#country option:not([disabled])").count();
    const p9ActivityRows = await page.locator("main ol li").count();
    ok(
      "PKG P09 4b «Organización» (ORG-07 #1-#5/#7/#8/#12; T-50…T-52): h1 «Organización», chip «Pendiente», «Pendiente de revisión…», «La revisión se registra desde administración. La empresa no puede verificarse a sí misma.»; «Razón social», «Tipo de organización», «Identificación fiscal», «País» with the 27 EU countries, «Domicilio fiscal»; «Guardar organización» + «Guardar un cambio devuelve la revisión a pendiente.»; «Actividad de esta organización» (≤ 15 rows) with its note",
      (await page.locator("main h1", { hasText: "Organización" }).count()) === 1 &&
        /Pendiente Revisión Pendiente de revisión: un administrador de la plataforma comprobará estos datos\. La revisión se registra desde administración\. La empresa no puede verificarse a sí misma\./.test(
          p9Org,
        ) &&
        (await page.locator("main label", { hasText: /^Razón social/ }).count()) === 1 &&
        (await page.locator("main label", { hasText: /^Tipo de organización/ }).count()) === 1 &&
        (await page.locator("main label", { hasText: /^Identificación fiscal/ }).count()) === 1 &&
        (await page.locator("main label", { hasText: /^País/ }).count()) === 1 &&
        (await page.locator("main label", { hasText: /^Domicilio fiscal/ }).count()) === 1 &&
        p9Countries === 27 &&
        (await page.locator("main select#country").inputValue()) === "ES" &&
        (await page
          .locator("main button[type=submit]", { hasText: "Guardar organización" })
          .count()) === 1 &&
        /Guardar un cambio devuelve la revisión a pendiente\./.test(p9Org) &&
        /Actividad de esta organización/.test(p9Org) &&
        p9ActivityRows <= 15 &&
        /Últimos 15 eventos de tu organización: qué se hizo y cuándo, sin datos personales\./.test(
          p9Org,
        ),
      `countries=${p9Countries} activity=${p9ActivityRows} · ${p9Org.slice(0, 160)}`,
    );
    // 5. Five widths on the «Resumen» and «Organización», no horizontal overflow; the captures.
    const p9Widths = [];
    for (const path of ["/app/organization", "/app/organization/settings"]) {
      await page.goto(`${BASE}${path}`);
      await page.waitForLoadState("networkidle");
      for (const width of [1440, 1024, 768, 390, 360]) {
        await page.setViewportSize({ width, height: width < 800 ? 1100 : 900 });
        await page.waitForTimeout(250);
        if (await p9Overflow()) p9Widths.push(`${path}@${width}`);
        if (path === "/app/organization" && (width === 1440 || width === 390))
          await shot(`P09-home-after-${width}`);
        if (path === "/app/organization/settings" && width === 1440)
          await shot(`P09-organization-after-${width}`);
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    ok(
      "PKG P09 5 @1440/1024/768/390/360: no horizontal overflow on /app/organization and /app/organization/settings",
      p9Widths.length === 0,
      p9Widths.join(","),
    );
    await logout();

    // 6. Negative: a plain member (ORG-01 #20/#32, ORG-07 #8/#12/#16; T-93, T-146).
    await login(MEMBER);
    await p9Es();
    await page.goto(`${BASE}/app/organization`);
    await page.waitForLoadState("networkidle");
    const p9MemberHome = await p9Main();
    const p9MemberLabels = await p9Labels();
    await page.goto(`${BASE}/app/organization/settings`);
    await page.waitForLoadState("networkidle");
    const p9MemberOrg = await p9Main();
    const p9MemberForm = await page.locator("main form").count();
    await page.goto(`${BASE}/app/organization/candidates`);
    await page.waitForLoadState("networkidle");
    const p9MemberDir = await p9Main();
    ok(
      "PKG P09 6 negative (member): the hero without «Explorar candidatos», only «Necesidades abiertas» (no applications, shifts or network counters), no «Red profesional» / «Nueva necesidad» / quick links; «Organización» read-only («Solo el administrador…») without the activity; the directory shows the managers-only notice",
      /El técnico adecuado\. Las fechas adecuadas\./.test(p9MemberHome) &&
        !/Explorar candidatos/.test(p9MemberHome) &&
        p9MemberLabels.join("|") === "necesidades abiertas" &&
        !/Red profesional|Nueva necesidad|Accesos (rápidos|directos)|Constructor/.test(
          p9MemberHome,
        ) &&
        /Cómo cerrar una cobertura/.test(p9MemberHome) &&
        /Solo el administrador de la organización puede cambiar estos datos\./.test(p9MemberOrg) &&
        p9MemberForm === 0 &&
        !/Actividad de esta organización/.test(p9MemberOrg) &&
        /El análisis de capacidad está disponible para managers y administradores/.test(
          p9MemberDir,
        ),
      `${p9MemberLabels.join("|")} · form=${p9MemberForm} · ${p9MemberDir.slice(0, 80)}`,
    );
    await logout();

    // 7. Negative: another organization's admin (S-2, S-7): own needs only, 404 on a Demo MRO need, refusals by id.
    await login(OTHER);
    await p9Es();
    await page.goto(`${BASE}/app/organization`);
    await page.waitForLoadState("networkidle");
    const p9OtherHome = await p9Main();
    const p9OtherTitles = await page
      .locator("main table tbody tr a[href^='/app/organization/requirements/']")
      .allInnerTexts();
    expectedErrorUrls.add(madUrl);
    const p9Cross = await page.goto(madUrl);
    await page.waitForLoadState("networkidle");
    expectedErrorUrls.delete(madUrl);
    const p9Profile = await asSeedUser(OTHER, "organization-profile", {
      query: { organizationId: aoMro.id },
    });
    const p9Count = await seedRest(OTHER, "rpc/count_visible_network", {
      p_organization_id: aoMro.id,
    });
    ok(
      "PKG P09 7 negative (another organization): «DEMO AERO SERVICES LISBON» lists none of Demo MRO's needs; a Demo MRO need URL is a 404; `organization-profile` and `count_visible_network` refuse Demo MRO's id (no data, 42501)",
      /^DEMO AERO SERVICES LISBON Operaciones/.test(p9OtherHome) &&
        p9MroTitles.length > 0 &&
        p9OtherTitles.every((t) => !p9MroTitles.includes(t)) &&
        p9Cross?.status() === 404 &&
        p9Profile.data === undefined &&
        p9Profile.error !== undefined &&
        p9Count.code === "42501",
      `cross=${p9Cross?.status()} profile=${JSON.stringify(p9Profile.error ?? "").slice(0, 60)} count=${JSON.stringify(p9Count).slice(0, 80)}`,
    );
    await logout();
  } finally {
    // Restore: the three accounts in English, the locale cookie gone (the blocks that follow expect English).
    const p9Back = [];
    for (const email of [ADMIN, MEMBER, OTHER])
      p9Back.push(
        (await asSeedUser(email, "user-preferences", { method: "PATCH", body: { locale: "en" } }))
          .ok === true,
      );
    await ctx.clearCookies({ name: "crewflex-locale" });
    ok(
      "PKG P09 8 restore: admin.mro, charlie and admin.other in English",
      p9Back.every(Boolean),
      p9Back.join(),
    );
  }
}

// PKG P10 (needs and matching parity, F3 — ORG-02 #11/#12/#13/#14/#16/#19, ORG-03 #19, SHOT-07 #3; migration
// 20261027100000, T-168, BR-3.8–3.13): the builder writes the v1.8 profile requirements («Perfil técnico» under
// «03 · Cualificaciones») in Spanish — the six controls, «Selecciona una aeronave si exiges habilitación de tipo.»,
// the «Requisitos del perfil» chips in the preview, on the saved draft and after the edit, the edit form restoring
// them, the published need's matching listing them per candidate, the API returning them. Negatives: a plain member
// cannot edit them (FORBIDDEN), a type rating without aircraft is refused on `requiresTypeRating`, another
// organization's admin gets a 404 on the need. Five widths on the builder. Restore: the need closed and archived
// (never deleted), admin.mro back to English, the locale cookie gone.
{
  const ADMIN = "admin.mro@crewflex.test";
  const MEMBER = "charlie@crewflex.test";
  const OTHER = "admin.other@crewflex.test";
  const p10Title = `Local UI check · P10 rules ${Date.now()}`;
  const p10Day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const p10Main = async () => (await page.locator("main").innerText()).replace(/\s+/g, " ");
  const p10Rules = () => page.locator("[aria-labelledby=rules-title]");
  const p10Es = async () => {
    await page.goto(`${BASE}/app/settings`);
    await page.waitForLoadState("networkidle");
    if ((await page.evaluate(() => document.documentElement.lang)) === "es") return;
    await page.locator("[role=radio][lang=es]").first().click();
    await page.waitForSelector("[role=status]:has-text('Idioma actualizado')", { timeout: 15000 });
  };
  const p10Overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
  /** The whole edit payload of the need as the API returns it (full replacement), with overrides. */
  const p10Put = (r, over) => ({
    id: r.id,
    expectedUpdatedAt: r.updatedAt,
    title: r.title,
    location: r.location,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    shift: r.shift,
    headcount: r.headcount,
    urgency: r.urgency,
    qualifications: r.qualifications.map((q) => ({
      qualificationTypeId: q.qualificationTypeId,
      level: q.level,
    })),
    ...over,
  });
  let p10Id;
  try {
    // 0. The builder in Spanish: the «Perfil técnico» block with the six v1.8 controls.
    await login(ADMIN);
    await p10Es();
    await page.goto(`${BASE}/app/organization/requirements/new`);
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => localStorage.clear());
    await expectSpanish("PKG P10 0 «Nueva necesidad» in Spanish");
    const p10Form = await p10Main();
    ok(
      "PKG P10 0b «Perfil técnico» (ORG-02 #11/#12/#13/#14/#16/#19): «Categoría obligatoria» (12 + «Sin exigir»), «Aeronaves aceptadas (basta una)» (12), «Motores (basta uno)» (7), «Capacidades obligatorias (todas)» (9), «Experiencia mínima (años)», «Exigir habilitación de tipo…»; each starts not required",
      /Perfil técnico/.test(p10Form) &&
        /Categoría obligatoria/.test(p10Form) &&
        (await page.locator("#category option").count()) === 13 &&
        (await page.locator("#category").inputValue()) === "" &&
        /Aeronaves aceptadas \(basta una\)/.test(p10Form) &&
        /Motores \(basta uno\)/.test(p10Form) &&
        /Capacidades obligatorias \(todas\)/.test(p10Form) &&
        (await p10Rules().locator("input[type=checkbox]").count()) === 12 + 7 + 9 + 1 &&
        (await p10Rules().locator("input[type=checkbox]:checked").count()) === 0 &&
        /Experiencia mínima \(años\)/.test(p10Form) &&
        (await page.locator("#minYears").inputValue()) === "" &&
        /Exigir habilitación de tipo/.test(p10Form),
      `options=${await page.locator("#category option").count()} boxes=${await p10Rules().locator("input[type=checkbox]").count()}`,
    );
    // 1. T-83 / ORG-03 #19: the type rating needs a licence category and an aircraft.
    await page.locator("#requiresTypeRating").check();
    const p10Warn = /Selecciona una aeronave si exiges habilitación de tipo\./.test(
      await p10Main(),
    );
    await page.fill("#title", p10Title);
    await page.fill("#location", "Madrid (MAD)");
    await page.fill("#startsAt", `${p10Day(40)}T08:00`);
    await page.fill("#endsAt", `${p10Day(42)}T16:00`);
    await page.locator("label:has-text('B1.1')").first().click();
    await page.selectOption("#category", "B1.1");
    await p10Rules().locator("label:has-text('A320 Family')").first().click();
    await page.fill("#minYears", "3");
    await p10Rules().locator("label:has-text('Boroscopia')").first().click();
    const p10Aside = page.getByRole("complementary", { name: "Revisar antes de publicar" });
    await p10Aside
      .getByText(/aún no aplica los requisitos del perfil técnico/)
      .waitFor({ timeout: 15000 })
      .catch(() => {});
    const p10AsideText = (await p10Aside.innerText()).replace(/\s+/g, " ");
    ok(
      "PKG P10 1 «Selecciona una aeronave si exiges habilitación de tipo.» while the rating has no category/aircraft (T-83); gone with B1.1 + A320 Family; the live count says it does not apply the profile rules yet (T-86)",
      p10Warn &&
        !/Selecciona una aeronave si exiges/.test(await p10Main()) &&
        /El recuento aún no aplica los requisitos del perfil técnico\./.test(p10AsideText),
      p10AsideText.slice(0, 160),
    );
    // 2. The preview lists the stated rules as the candidate checklist words them.
    await page.getByRole("button", { name: "Previsualizar requisitos" }).click();
    const p10Preview = (await page.locator("dialog[open]").innerText()).replace(/\s+/g, " ");
    await page.keyboard.press("Escape");
    ok(
      "PKG P10 2 preview: «Requisitos del perfil» — «Categoría B1.1», «Aeronave: A320 Family», «Habilitación de tipo B1.1 · A320 Family», «Experiencia mínima: 3 años», «Capacidad: Boroscopia»",
      /Requisitos del perfil/i.test(p10Preview) &&
        /Categoría B1\.1/.test(p10Preview) &&
        /Aeronave: A320 Family/.test(p10Preview) &&
        /Habilitación de tipo B1\.1 · A320 Family/.test(p10Preview) &&
        /Experiencia mínima: 3 años/.test(p10Preview) &&
        /Capacidad: Boroscopia/.test(p10Preview),
      p10Preview.slice(0, 200),
    );
    const p10Widths = [];
    for (const width of [1440, 1024, 768, 390, 360]) {
      await page.setViewportSize({ width, height: width < 800 ? 1100 : 900 });
      await page.waitForTimeout(250);
      if (await p10Overflow()) p10Widths.push(width);
      if (width === 1440 || width === 390) await shot(`p10-builder-rules-${width}`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    ok(
      "PKG P10 3 @1440/1024/768/390/360: no horizontal overflow on the builder",
      p10Widths.length === 0,
      p10Widths.join(),
    );
    // 4. Saved as a draft: the detail shows the chips; the edit form restores every control.
    await page.getByRole("button", { name: "Guardar borrador" }).click();
    await page.waitForURL((u) => /\/requirements\/[0-9a-f-]{36}$/.test(u.pathname), {
      timeout: 30000,
    });
    await page.waitForLoadState("networkidle");
    p10Id = page.url().split("/").pop();
    const p10Draft = await p10Main();
    await page.goto(`${BASE}/app/organization/requirements/${p10Id}/edit`);
    await page.waitForLoadState("networkidle");
    const p10Restored =
      (await page.locator("#category").inputValue()) === "B1.1" &&
      (await p10Rules().locator("label:has-text('A320 Family') input").first().isChecked()) &&
      (await p10Rules().locator("label:has-text('Boroscopia') input").first().isChecked()) &&
      (await page.locator("#requiresTypeRating").isChecked()) &&
      (await page.locator("#minYears").inputValue()) === "3" &&
      (await p10Rules().locator("input[type=checkbox]:checked").count()) === 3;
    ok(
      "PKG P10 4 «Guardar borrador»: the detail shows «Requisitos del perfil» (Categoría B1.1 · Aeronave: A320 Family · Habilitación de tipo · Experiencia mínima: 3 años · Capacidad: Boroscopia); «Editar» restores the six controls",
      /Borrador/.test(p10Draft) &&
        /Categoría B1\.1/.test(p10Draft) &&
        /Aeronave: A320 Family/.test(p10Draft) &&
        /Habilitación de tipo B1\.1 · A320 Family/.test(p10Draft) &&
        /Experiencia mínima: 3 años/.test(p10Draft) &&
        /Capacidad: Boroscopia/.test(p10Draft) &&
        p10Restored,
      `restored=${p10Restored} · ${p10Draft.slice(0, 120)}`,
    );
    // 5. Edited (2 years) and published from the edit form: the detail, the matching rows per candidate, the API.
    await page.fill("#minYears", "2");
    await page.getByRole("button", { name: "Guardar y publicar" }).click();
    await page.waitForURL((u) => u.pathname === `/app/organization/requirements/${p10Id}`, {
      timeout: 30000,
    });
    await page.waitForLoadState("networkidle");
    const p10Open = await p10Main();
    await shot("p10-detail-rules");
    await page.goto(`${BASE}/app/organization/requirements/${p10Id}/matches?eligible=0`);
    await page.waitForLoadState("networkidle");
    await page
      .locator("main article")
      .first()
      .waitFor({ timeout: 20000 })
      .catch(() => {});
    const p10Matches = await p10Main();
    const p10Cards = await page.locator("main article").count();
    const p10CardsWithRules = await page
      .locator("main article")
      .filter({ hasText: /Experiencia mínima: 2 años/ })
      .count();
    const p10Api = (await asSeedUser(ADMIN, "work-requirements", { query: { id: p10Id } })).data
      ?.requirement;
    ok(
      "PKG P10 5 published with «Experiencia mínima: 2 años»: the detail chip, every evaluated candidate card lists the rule rows («Requisitos del perfil» with the type rating and the 2 years, BR-3.8–3.13), the API returns category/aircraft/requiresTypeRating/minYears/requiredSkills",
      /Abierta/.test(p10Open) &&
        /Experiencia mínima: 2 años/.test(p10Open) &&
        p10Cards > 0 &&
        p10CardsWithRules === p10Cards &&
        /Habilitación de tipo B1\.1 · A320 Family/.test(p10Matches) &&
        p10Api?.category === "B1.1" &&
        JSON.stringify(p10Api?.aircraft) === '["A320 Family"]' &&
        p10Api?.requiresTypeRating === true &&
        p10Api?.minYears === 2 &&
        JSON.stringify(p10Api?.requiredSkills) === '["borescope"]',
      `cards=${p10Cards}/${p10CardsWithRules} api=${JSON.stringify({ c: p10Api?.category, a: p10Api?.aircraft, tr: p10Api?.requiresTypeRating, y: p10Api?.minYears, s: p10Api?.requiredSkills })}`,
    );
    await logout();
    // 6. Negatives: a member cannot edit the rules; a rating without aircraft is refused by field; another
    // organization's admin gets a 404 on the need.
    const p10AsMember = await asSeedUser(MEMBER, "work-requirements", {
      method: "PUT",
      body: p10Put(p10Api, { minYears: 9 }),
    });
    const p10BadRating = await asSeedUser(ADMIN, "work-requirements", {
      method: "PUT",
      body: p10Put(p10Api, { requiresTypeRating: true }),
    });
    const p10After = (await asSeedUser(ADMIN, "work-requirements", { query: { id: p10Id } })).data
      ?.requirement;
    await login(OTHER);
    const p10CrossUrl = `${BASE}/app/organization/requirements/${p10Id}`;
    expectedErrorUrls.add(p10CrossUrl);
    const p10Cross = await page.goto(p10CrossUrl);
    await page.waitForLoadState("networkidle");
    expectedErrorUrls.delete(p10CrossUrl);
    ok(
      "PKG P10 6 negatives: charlie (member) PUT minYears → FORBIDDEN; a type rating without aircraft → VALIDATION_ERROR on `requiresTypeRating`; the rules unchanged (2 years, B1.1 · A320 Family); admin.other → 404 on the need",
      p10AsMember.error?.code === "FORBIDDEN" &&
        p10BadRating.error?.code === "VALIDATION_ERROR" &&
        (p10BadRating.error?.issues ?? []).some((i) => i.path === "requiresTypeRating") &&
        p10After?.minYears === 2 &&
        p10After?.category === "B1.1" &&
        p10Cross?.status() === 404,
      `member=${p10AsMember.error?.code} rating=${p10BadRating.error?.code}/${JSON.stringify(p10BadRating.error?.issues ?? []).slice(0, 80)} cross=${p10Cross?.status()}`,
    );
    await logout();
  } finally {
    // Restore: the need closed and archived (never deleted), admin.mro in English, the locale cookie gone.
    const p10Closed = p10Id
      ? (
          await asSeedUser(ADMIN, "work-requirements", {
            method: "PATCH",
            body: { id: p10Id, status: "closed" },
          })
        ).ok === true
      : true;
    const p10Archived = p10Id
      ? (
          await asSeedUser(ADMIN, "work-requirements", {
            method: "PATCH",
            body: { id: p10Id, archive: true },
          })
        ).ok === true
      : true;
    const p10English =
      (await asSeedUser(ADMIN, "user-preferences", { method: "PATCH", body: { locale: "en" } }))
        .ok === true;
    await ctx.clearCookies({ name: "crewflex-locale" });
    ok(
      "PKG P10 7 restore: the need closed and archived, admin.mro in English (seed state back)",
      p10Closed && p10Archived && p10English,
      `${p10Closed} ${p10Archived} ${p10English}`,
    );
  }
}

// PKG P11 (recruiter parity, F3 — ORG-08 #1-#8, #11; migration 20261027200000, T-169, BR-27.6): in Spanish, a staffing
// agency's «Buscar candidatos» reads «Red recruiter» (v1.8 «RED RECRUITER»); the Candidate Pack copy names the client it
// was received for on both sides (v1.8 «Alcance y destinatario: {empresa} para {cliente}»): the agency's «Candidaturas»
// («… recibida para el cliente {cliente}.») and Delta's «Mis candidaturas» → «Ver expediente» («Esta es la copia que
// recibió {org}, para su cliente {cliente}, …»); the API carries the name and never the client's e-mail; after the
// revocation the application still names the client (T-169) while the opportunity is gone (T-134). Negatives: another
// organization's admin cannot add a client to the agency (FORBIDDEN), gets 404 on its need and keeps «Red profesional»;
// echo (another professional) cannot read Delta's copy (NOT_FOUND). Setup through the local API as `PKG recruiter`
// (Lisbon becomes an agency; its open needs paused). Restore: application withdrawn, need closed and archived, client
// revoked, Delta's window removed, Lisbon an MRO again with its needs resumed, both accounts in English, cookie gone.
{
  const AGENCY_ADMIN = "admin.other@crewflex.test";
  const OTHER_ADMIN = "admin.mro@crewflex.test";
  const PRO = "delta@crewflex.test";
  const OTHER_PRO = "echo@crewflex.test";
  const p11Client = `Cliente P11 ${Date.now()}`;
  const p11Email = "p11-client@smoke-client.test";
  const p11Title = `Local UI check · P11 recruiter ${Date.now()}`;
  const p11Main = async () => (await page.locator("main").innerText()).replace(/\s+/g, " ");
  const p11Es = async () => {
    await page.goto(`${BASE}/app/settings`);
    await page.waitForLoadState("networkidle");
    if ((await page.evaluate(() => document.documentElement.lang)) === "es") return;
    await page.locator("[role=radio][lang=es]").first().click();
    await page.waitForSelector("[role=status]:has-text('Idioma actualizado')", { timeout: 15000 });
  };
  const p11Overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
  const [p11Agency] = await seedRest(
    AGENCY_ADMIN,
    "organizations?select=id,type&name=eq.Demo%20Aero%20Services%20Lisbon",
  );
  const p11Headers = await seedHeaders(AGENCY_ADMIN);
  const p11SetType = (type) =>
    fetch(new URL(`/rest/v1/organizations?id=eq.${p11Agency.id}`, supabaseUrl), {
      method: "PATCH",
      headers: { ...p11Headers, Prefer: "return=minimal" },
      body: JSON.stringify({ type }),
    }).then((r) => r.ok);
  let p11Paused = [];
  let p11ClientId;
  let p11Id;
  let p11App;
  let p11Window;
  try {
    // Setup: Lisbon is an agency (its open needs paused, MEDIUM-1 guard), one client activated by the platform admin,
    // a need for that client, Delta available and applied (the copy is frozen on applying).
    p11Paused = (
      await asSeedUser(AGENCY_ADMIN, "work-requirements", {
        query: { organizationId: p11Agency.id, status: "open" },
      })
    ).data.requirements.map((r) => r.id);
    for (const id of p11Paused)
      await asSeedUser(AGENCY_ADMIN, "work-requirements", {
        method: "PATCH",
        body: { id, status: "paused" },
      });
    const p11TypeSet = await p11SetType("staffing_agency");
    const p11Added = await asSeedUser(AGENCY_ADMIN, "represented-clients", {
      method: "POST",
      body: { organizationId: p11Agency.id, name: p11Client, contactEmail: p11Email },
    });
    p11ClientId = p11Added.data?.client?.id;
    const p11Activated = await asSeedUser("platform.admin@crewflex.test", "represented-clients", {
      method: "PATCH",
      body: { id: p11ClientId, action: "activate", note: "P11 smoke: mandate ref. FX-P11" },
    });
    const p11Types = await seedRest(AGENCY_ADMIN, "qualification_types?select=id&code=in.(B1.1)");
    const p11Start = new Date(Date.now() + 45 * 86_400_000);
    p11Start.setUTCHours(6, 0, 0, 0);
    const p11Created = await asSeedUser(AGENCY_ADMIN, "work-requirements", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: {
        organizationId: p11Agency.id,
        title: p11Title,
        location: "Lisbon (LIS)",
        startsAt: p11Start.toISOString(),
        endsAt: new Date(p11Start.getTime() + 36 * 3_600_000).toISOString(),
        shift: "day",
        headcount: 1,
        urgency: "planned",
        qualifications: p11Types.map((q) => ({ qualificationTypeId: q.id, level: "hard" })),
        onBehalfOfClientId: p11ClientId,
      },
    });
    p11Id = p11Created.data?.requirement?.id;
    p11Window = await asSeedUser(PRO, "professional-availability", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: {
        startsAt: new Date(p11Start.getTime() - 86_400_000).toISOString(),
        endsAt: new Date(p11Start.getTime() + 3 * 86_400_000).toISOString(),
        status: "available",
      },
    });
    const p11Applied = await asSeedUser(PRO, "applications", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: { requirementId: p11Id, shareConsent: true },
    });
    p11App = p11Applied.data?.application;
    ok(
      "PKG P11 0 setup: Lisbon is an agency with an active client, a need for it and Delta's application",
      p11TypeSet &&
        p11Activated.data?.client?.status === "active" &&
        p11Created.data?.requirement?.client?.name === p11Client &&
        Boolean(p11App?.id),
      JSON.stringify(
        p11Added.error ?? p11Activated.error ?? p11Created.error ?? p11Applied.error ?? {},
      ),
    );

    // 1. The agency's directory in Spanish: «Red recruiter» (ORG-08 #2).
    await login(AGENCY_ADMIN);
    await p11Es();
    await page.goto(`${BASE}/app/organization/candidates`);
    await page.waitForLoadState("networkidle");
    await expectSpanish("PKG P11 1 «Buscar candidatos» of an agency in Spanish");
    const p11Directory = await p11Main();
    await page.setViewportSize({ width: 1440, height: 900 });
    await shot("p11-directory-recruiter-1440");
    ok(
      "PKG P11 1b the agency's directory reads «Red recruiter» / «Encuentra a tu próximo técnico.» (v1.8 «RED RECRUITER»)",
      // innerText returns the eyebrow as CSS renders it (uppercase).
      /red recruiter/i.test(p11Directory) &&
        p11Directory.includes("Encuentra a tu próximo técnico.") &&
        !/red profesional/i.test(p11Directory),
      p11Directory.slice(0, 160),
    );

    // 2. The agency's «Candidaturas» with the copy open: the intro names the client (ORG-08 #7).
    await page.goto(`${BASE}/app/organization/applications?pack=${p11App.id}#pack-${p11App.id}`);
    await page.waitForLoadState("networkidle");
    const p11OrgPack = await p11Main();
    await shot("p11-org-pack-client-1440");
    ok(
      "PKG P11 2 the agency's «Candidaturas» → «Ver expediente» reads «… recibida para el cliente {cliente}.», the «Expediente compartido» badge; never the client's e-mail",
      p11OrgPack.includes(
        `Copia del expediente técnico que el profesional compartió al presentarse, recibida para el cliente ${p11Client}.`,
      ) &&
        p11OrgPack.includes("Expediente compartido") &&
        !p11OrgPack.includes(p11Email),
      p11OrgPack.slice(0, 200),
    );
    await logout();

    // 3. Delta's «Mis candidaturas» → «Ver expediente»: «Esta es la copia que recibió {org}, para su cliente …».
    await login(PRO);
    await p11Es();
    await page.goto(`${BASE}/app/professional/applications`);
    await page.waitForLoadState("networkidle");
    await expectSpanish("PKG P11 3 «Mis candidaturas» in Spanish");
    await page
      .locator(`article[aria-labelledby="a-${p11App.id}"]`)
      .getByRole("link", { name: "Ver expediente" })
      .click();
    await page.waitForSelector(`#pack-${p11App.id}`, { timeout: 15000 });
    const p11OwnPack = await p11Main();
    await shot("p11-own-pack-client-1440");
    ok(
      "PKG P11 3b the copy's intro: «Esta es la copia que recibió Demo Aero Services Lisbon, para su cliente {cliente}, al presentar tu candidatura.» (v1.8 «Alcance y destinatario»); «Cerrar expediente»; no e-mail",
      p11OwnPack.includes(
        `Esta es la copia que recibió Demo Aero Services Lisbon, para su cliente ${p11Client}, al presentar tu candidatura.`,
      ) &&
        p11OwnPack.includes("Cerrar expediente") &&
        !p11OwnPack.includes(p11Email),
      p11OwnPack.slice(0, 200),
    );
    let p11Spill = false;
    for (const width of [1440, 1024, 768, 390, 360]) {
      await page.setViewportSize({ width, height: width < 800 ? 1100 : 900 });
      await page.waitForTimeout(200);
      if (await p11Overflow()) p11Spill = true;
      if (width === 390) await shot("p11-own-pack-client-390");
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    ok(
      "PKG P11 4 @1440/1024/768/390/360: no horizontal overflow with the copy open",
      !p11Spill,
      "",
    );
    await logout();

    // 5. The API: the name on the card, never the e-mail; the proposal-free list of a plain MRO need stays null.
    const p11Mine = await asSeedUser(PRO, "applications");
    const p11MineRow = (p11Mine.data?.applications ?? []).find((a) => a.id === p11App.id);
    const p11OrgList = await asSeedUser(AGENCY_ADMIN, "applications", {
      query: { view: "list", organizationId: p11Agency.id, requirementId: p11Id },
    });
    ok(
      "PKG P11 5 API: Delta's application and the agency's list carry `requirement.clientName`; the e-mail and the client id never leave the agency's portfolio",
      p11MineRow?.requirement?.clientName === p11Client &&
        p11OrgList.data?.applications?.[0]?.requirement?.clientName === p11Client &&
        !JSON.stringify(p11Mine).includes(p11Email) &&
        !JSON.stringify(p11Mine).includes(p11ClientId),
      JSON.stringify(p11Mine.error ?? p11OrgList.error ?? {}),
    );

    // 6. Negatives: another organization's admin, another professional.
    const p11Intruder = await asSeedUser(OTHER_ADMIN, "represented-clients", {
      method: "POST",
      body: { organizationId: p11Agency.id, name: "Intruso P11", contactEmail: "" },
    });
    const p11EchoPack = await asSeedUser(OTHER_PRO, "applications", {
      query: { view: "pack", applicationId: p11App.id },
    });
    const p11OtherPack = await asSeedUser(OTHER_ADMIN, "applications", {
      query: { view: "pack", applicationId: p11App.id },
    });
    await login(OTHER_ADMIN);
    await page.goto(`${BASE}/app/organization/candidates`);
    await page.waitForLoadState("networkidle");
    const p11OtherDirectory = await p11Main();
    const p11CrossUrl = `${BASE}/app/organization/requirements/${p11Id}`;
    expectedErrorUrls.add(p11CrossUrl);
    const p11Cross = await page.goto(p11CrossUrl);
    await page.waitForLoadState("networkidle");
    expectedErrorUrls.delete(p11CrossUrl);
    ok(
      "PKG P11 6 negatives: admin.mro cannot add a client to Lisbon (FORBIDDEN), gets 404 on its need and keeps «Professional network»; echo and admin.mro get NOT_FOUND on Delta's copy",
      p11Intruder.error?.code === "FORBIDDEN" &&
        p11Cross?.status() === 404 &&
        /professional network/i.test(p11OtherDirectory) &&
        !/recruiter network/i.test(p11OtherDirectory) &&
        p11EchoPack.error?.code === "NOT_FOUND" &&
        p11OtherPack.error?.code === "NOT_FOUND",
      `${p11Intruder.error?.code} ${p11Cross?.status()} ${p11EchoPack.error?.code} ${p11OtherPack.error?.code}`,
    );
    await logout();

    // 7. Revoked: the opportunity is gone (T-134); the application still names the client (T-169).
    const p11Revoked = await asSeedUser(AGENCY_ADMIN, "represented-clients", {
      method: "PATCH",
      body: { id: p11ClientId, action: "revoke" },
    });
    const p11Gone = await asSeedUser(PRO, "opportunities", { query: { id: p11Id } });
    const p11MineAfter = (await asSeedUser(PRO, "applications")).data?.applications?.find(
      (a) => a.id === p11App.id,
    );
    ok(
      "PKG P11 7 revoked: Delta no longer reads the opportunity (NOT_FOUND) but the application still says it was made for the client (T-169)",
      p11Revoked.data?.client?.status === "revoked" &&
        p11Gone.error?.code === "NOT_FOUND" &&
        p11MineAfter?.requirement?.clientName === p11Client,
      JSON.stringify(p11Revoked.error ?? p11Gone.error ?? {}),
    );
  } finally {
    // Seed state back whatever happened: application withdrawn, need closed and archived, client revoked, window
    // removed, Lisbon an MRO with its needs resumed, Delta and admin.other in English, the locale cookie gone.
    try {
      if ((await page.evaluate(() => location.pathname)).startsWith("/app")) await logout();
    } catch {
      /* not signed in */
    }
    const p11Fresh = p11App
      ? (await asSeedUser(PRO, "applications")).data?.applications?.find((a) => a.id === p11App.id)
      : null;
    const p11Withdrawn =
      p11Fresh && p11Fresh.status !== "withdrawn"
        ? (
            await asSeedUser(PRO, "applications", {
              method: "PATCH",
              headers: { "Idempotency-Key": crypto.randomUUID() },
              body: {
                applicationId: p11App.id,
                to: "withdrawn",
                expectedUpdatedAt: p11Fresh.updatedAt,
              },
            })
          ).ok === true
        : true;
    const p11Closed = p11Id
      ? (
          await asSeedUser(AGENCY_ADMIN, "work-requirements", {
            method: "PATCH",
            body: { id: p11Id, status: "closed" },
          })
        ).ok === true
      : true;
    const p11Archived = p11Id
      ? (
          await asSeedUser(AGENCY_ADMIN, "work-requirements", {
            method: "PATCH",
            body: { id: p11Id, archive: true },
          })
        ).ok === true
      : true;
    const p11ClientGone = p11ClientId
      ? ["revoked", undefined].includes(
          (
            await asSeedUser(AGENCY_ADMIN, "represented-clients", {
              method: "PATCH",
              body: { id: p11ClientId, action: "revoke" },
            })
          ).data?.client?.status,
        )
      : true;
    const p11WindowGone = p11Window?.data?.window?.id
      ? (
          await asSeedUser(PRO, "professional-availability", {
            method: "DELETE",
            query: { id: p11Window.data.window.id },
          })
        ).ok === true
      : true;
    const p11TypeBack = await p11SetType(p11Agency.type);
    const p11Resumed = [];
    for (const id of p11Paused)
      p11Resumed.push(
        (
          await asSeedUser(AGENCY_ADMIN, "work-requirements", {
            method: "PATCH",
            body: { id, status: "open" },
          })
        ).ok,
      );
    const p11English =
      (await asSeedUser(PRO, "user-preferences", { method: "PATCH", body: { locale: "en" } }))
        .ok === true &&
      (
        await asSeedUser(AGENCY_ADMIN, "user-preferences", {
          method: "PATCH",
          body: { locale: "en" },
        })
      ).ok === true;
    await ctx.clearCookies({ name: "crewflex-locale" });
    ok(
      "PKG P11 8 restore: application withdrawn, need closed and archived, client revoked, Delta's window removed, Lisbon an MRO again with its needs resumed, both accounts in English",
      p11Withdrawn &&
        p11Closed &&
        p11Archived &&
        p11ClientGone &&
        p11WindowGone &&
        p11TypeBack &&
        p11Resumed.every(Boolean) &&
        p11English,
      `${p11Withdrawn} ${p11Closed} ${p11Archived} ${p11ClientGone} ${p11WindowGone} ${p11TypeBack} ${p11Resumed} ${p11English}`,
    );
  }
}

// PKG P12 (admin parity, F3 — ADM-01 #1/#5, ADM-02 #1-#3/#6-#11/#13/#17, ADM-03 #9/#10; migration 20261027300000,
// T-170): in Spanish, the platform admin lands on «Administración» with the v1.8 figures (counts, no money), the
// invitation panel and the audit; the review queue shows Golf's declared restrictions with v1.8's «Resuelve las
// restricciones con el titular antes de revisar el perfil.»; a verification without evidence is refused in the browser
// and by the API (400 VALIDATION_ERROR); with evidence it is verified, the evidence is readable by the platform admin
// only (RLS) and never reaches Golf's own review note; the audit lists the decision. Negatives: an organization
// manager gets HTTP 404 on every admin route and reads no evidence row; Golf (professional) cannot review (FORBIDDEN);
// anon is 401. Setup through the local API (Golf declares a restriction). Restore: Golf's B1.1 pending again (BR-2.8),
// the restriction removed, the admin back in English, cookie gone.
{
  const GOLF = "golf@crewflex.test";
  const ADMIN = "platform.admin@crewflex.test";
  const p12Restriction =
    "Sin certificación CRS en motores; tareas de motor solo bajo supervisión de un B1 (P12).";
  const p12Main = async () => (await page.locator("main").innerText()).replace(/\s+/g, " ");
  const p12Overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
  const p12Shot = (name) =>
    page.screenshot({
      path: `docs/audit/evidence/parity/P12/P12-${name}.jpg`,
      type: "jpeg",
      quality: 70,
      fullPage: false,
    });
  const p12Golf = async () => (await asSeedUser(GOLF, "professional-profile")).data.profile;
  const p12SetRestriction = async (value) => {
    const now = await p12Golf();
    const body = { ...now, generalRestrictions: value, expectedUpdatedAt: now.updatedAt };
    delete body.updatedAt;
    return (await asSeedUser(GOLF, "professional-profile", { method: "PATCH", body })).ok === true;
  };
  const p12GolfB11 = async () =>
    (await asSeedUser(GOLF, "professional-qualifications")).data.qualifications.find(
      (q) => q.type.code === "B1.1",
    );
  const p12Original = (await p12Golf()).generalRestrictions ?? null;
  try {
    ok(
      "PKG P12 0 setup: Golf's B1.1 pending and a general restriction declared through the local API",
      (await ensureGolfPending()) && (await p12SetRestriction(p12Restriction)),
      "",
    );
    await login(ADMIN);
    await page.goto(`${BASE}/app/settings`);
    await page.waitForLoadState("networkidle");
    await page.locator("[role=radio][lang=es]").first().click();
    await page.waitForSelector("[role=status]:has-text('Idioma actualizado')", { timeout: 15000 });
    await page.goto(`${BASE}/app`);
    await page.waitForLoadState("networkidle");
    await expectSpanish("PKG P12 1 «Administración» in Spanish");
    const p12Home = await p12Main();
    const p12Nav = await page
      .locator("nav a")
      .evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    ok(
      "PKG P12 1b ADM-01 #1/#5, ADM-02 #1-#3/#6-#11/#13/#17: `/app` lands on /app/admin; «Control operativo · datos del servidor», «Tu plataforma, en cifras.», the five counts and «Demanda por licencia» without «€»; «Invitar», «Auditoría»; the menu links verifications, organizations, representations and audit",
      new URL(page.url()).pathname === "/app/admin" &&
        /Administración/.test(p12Home) &&
        /Control operativo · datos del servidor/i.test(p12Home) &&
        /Tu plataforma, en cifras\./.test(p12Home) &&
        /Técnicos registrados/i.test(p12Home) &&
        /Organizaciones/i.test(p12Home) &&
        /Necesidades activas/i.test(p12Home) &&
        /trabajando ahora/i.test(p12Home) &&
        /AOG con vacantes/i.test(p12Home) &&
        /Demanda por licencia/.test(p12Home) &&
        !/€/.test(p12Home) &&
        /Invitar/.test(p12Home) &&
        /Auditoría/.test(p12Home) &&
        [
          "/app/admin/verifications",
          "/app/admin/organizations",
          "/app/admin/representations",
          "/app/admin/audit",
        ].every((h) => p12Nav.includes(h)),
      p12Home.slice(0, 200),
    );
    await page.goto(`${BASE}/app/admin/verifications`);
    await page.waitForLoadState("networkidle");
    const p12Card = page
      .locator("main li")
      .filter({ hasText: "Technician Golf" })
      .filter({ hasText: "B1.1" });
    const p12CardText = (await p12Card.innerText()).replace(/\s+/g, " ");
    ok(
      "PKG P12 2 ADM-03 #9: Golf's pending B1.1 shows «Restricciones declaradas», the declared text and «Resuelve las restricciones con el titular antes de revisar el perfil.»; «Evidencia o motivo» is required for both decisions",
      (await p12Card.count()) === 1 &&
        /Restricciones declaradas/.test(p12CardText) &&
        p12CardText.includes(p12Restriction) &&
        /Resuelve las restricciones con el titular antes de revisar el perfil\./.test(
          p12CardText,
        ) &&
        /Evidencia o motivo/.test(p12CardText) &&
        /Obligatorio\. Al verificar queda como evidencia para la plataforma/.test(p12CardText),
      p12CardText.slice(0, 300),
    );
    await p12Shot("verifications-restrictions-after-1440");
    const p12Widths = {};
    for (const width of [1024, 768, 390, 360]) {
      await page.setViewportSize({ width, height: 1100 });
      await page.waitForTimeout(250);
      p12Widths[width] = await p12Overflow();
      if (width === 390) await p12Shot("verifications-restrictions-after-390");
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    ok(
      "PKG P12 2b no horizontal overflow at 1024 / 768 / 390 / 360",
      Object.values(p12Widths).every((o) => !o),
      JSON.stringify(p12Widths),
    );
    await p12Card.locator("button[value=verified]").click();
    await page.waitForTimeout(300);
    const p12Before = await p12GolfB11();
    const p12ApiNoNote = await asSeedUser(ADMIN, "qualification-reviews", {
      method: "POST",
      body: {
        qualificationId: p12Before.id,
        decision: "verified",
        expectedUpdatedAt: p12Before.updatedAt,
      },
    });
    ok(
      "PKG P12 3 ADM-03 #10: «Verificar» without evidence shows «Indica la evidencia o el motivo de la revisión.» in the card; the API refuses it too (400 VALIDATION_ERROR); B1.1 still pending",
      /Indica la evidencia o el motivo de la revisión\./.test(await p12Card.innerText()) &&
        p12ApiNoNote.ok === false &&
        p12ApiNoNote.error?.code === "VALIDATION_ERROR" &&
        (await p12GolfB11()).verificationStatus === "pending",
      p12ApiNoNote.error?.code ?? "",
    );
    await p12Card
      .locator("textarea[name=note]")
      .fill("P12: comprobado en el registro de la autoridad");
    await p12Card.locator("button[value=verified]").click();
    await page.waitForSelector(
      "[role=status]:has-text('Verificada. La cualificación ya cuenta para el matching.')",
      {
        timeout: 15000,
      },
    );
    await page.reload();
    await page.waitForLoadState("networkidle");
    const p12AfterText = await p12Main();
    const [p12Evidence] = await seedRest(
      ADMIN,
      "qualification_reviews?select=decision,note&order=created_at.desc&limit=1",
    );
    const p12GolfEvidence = await seedRest(GOLF, "qualification_reviews?select=note");
    const p12GolfOwn = await p12GolfB11();
    ok(
      "PKG P12 4 verified with evidence: the card left the queue, «Últimas decisiones» lists «Verificada»; the evidence row is readable by the platform admin, not by Golf (RLS: 0 rows), and Golf's own review note stays empty (T-170)",
      (await p12Card.count()) === 0 &&
        /Últimas decisiones[\s\S]*Verificada/.test(p12AfterText) &&
        p12Evidence?.decision === "verified" &&
        p12Evidence?.note === "P12: comprobado en el registro de la autoridad" &&
        Array.isArray(p12GolfEvidence) &&
        p12GolfEvidence.length === 0 &&
        p12GolfOwn.verificationStatus === "verified" &&
        (p12GolfOwn.reviewNote ?? null) === null,
      `${JSON.stringify(p12Evidence)} golf=${JSON.stringify(p12GolfEvidence)} own=${p12GolfOwn.verificationStatus}/${p12GolfOwn.reviewNote}`,
    );
    await page.goto(`${BASE}/app/admin/audit`);
    await page.waitForLoadState("networkidle");
    const p12Audit = await p12Main();
    await expectSpanish("PKG P12 5 «Auditoría» in Spanish");
    ok(
      "PKG P12 5b ADM-02 #17: the audit lists «qualification.reviewed» newest first with the actor's id and «technician_qualification», no free text",
      /Auditoría/.test(p12Audit) &&
        /qualification\.reviewed/.test(p12Audit) &&
        /technician_qualification/.test(p12Audit) &&
        !/comprobado en el registro/.test(p12Audit),
      p12Audit.slice(0, 200),
    );
    await logout();
    // Negatives: an organization manager, the professional and anon.
    await login("manager.mro@crewflex.test");
    const p12Denied = [];
    for (const path of [
      "/app/admin",
      "/app/admin/verifications",
      "/app/admin/organizations",
      "/app/admin/audit",
    ]) {
      expectedErrorUrls.add(`${BASE}${path}`);
      const response = await page.goto(`${BASE}${path}`);
      p12Denied.push(response?.status());
    }
    const p12ManagerEvidence = await seedRest(
      "manager.mro@crewflex.test",
      "qualification_reviews?select=note",
    );
    const p12GolfReview = await asSeedUser(GOLF, "qualification-reviews", {
      method: "POST",
      body: {
        qualificationId: p12GolfOwn.id,
        decision: "verified",
        note: "self",
        expectedUpdatedAt: p12GolfOwn.updatedAt,
      },
    });
    const p12Anon = await fetch(new URL("/functions/v1/qualification-reviews", supabaseUrl), {
      headers: { apikey: publishableKey },
    });
    ok(
      "PKG P12 6 negatives: manager.mro gets HTTP 404 on /app/admin, verifications, organizations and audit and reads 0 evidence rows; Golf POST qualification-reviews → FORBIDDEN; anon → 401",
      p12Denied.every((s) => s === 404) &&
        Array.isArray(p12ManagerEvidence) &&
        p12ManagerEvidence.length === 0 &&
        p12GolfReview.error?.code === "FORBIDDEN" &&
        p12Anon.status === 401,
      `${JSON.stringify(p12Denied)} ${p12GolfReview.error?.code} anon=${p12Anon.status}`,
    );
    await logout();
  } finally {
    const p12Pending = await ensureGolfPending();
    const p12Restored = await p12SetRestriction(p12Original);
    const p12English =
      (await asSeedUser(ADMIN, "user-preferences", { method: "PATCH", body: { locale: "en" } }))
        .ok === true;
    await ctx.clearCookies({ name: "crewflex-locale" });
    ok(
      "PKG P12 7 restore: Golf's B1.1 pending again, the restriction removed, the admin in English",
      p12Pending && p12Restored && p12English,
      `${p12Pending} ${p12Restored} ${p12English}`,
    );
  }
}

// PKG P13 (notices and messaging parity, F3 — HIRE-07 #1-#6/#8, TEC-07 #2/#5/#11-#17/#19/#21/#22, ACC-03 #2-#4;
// re-verification of v2-18 `20261023800000`, N-10/v2-17 `20261024400000…400200`, S-16 `20261023500000`, v2-16
// `20261024800000`, N-13/N-14 `20261023400100`; no new code): in Spanish, Delta's «Configuración» shows the v1.8
// «Avisos de oportunidades» labels and refuses the v1.8 errors, saves, offers «Exportar mis datos y archivos» →
// «Exportación preparada.» (`CrewFlex-mis-datos.json`) and «Cerrar cuenta» with «Escribe CERRAR» (a wrong word is
// refused and nothing is closed); the passport offers the four v1.8 visibilities and «Organizaciones bloqueadas»;
// «Avisos internos» lists «AOG: {título}» and «Actualización de candidatura · {título} · Demo MRO Madrid ·
// Preseleccionada» (no raw code) with «Nuevo», the bell counts them, «Marcar todas como leídas» empties it, and an
// account without notices reads the empty state. Negatives: an organization account cannot read the notifications
// table (no grant), another professional reads 0 preference rows (RLS), the organization admin cannot mark Delta's
// notice (404) nor read notice preferences (403), anon is 401. Setup through the local API (AOG need, Delta's
// window and preferences, the distribution, the application, the shortlist). Restore in `finally`: Delta's
// preferences as they were, the application withdrawn, the window deleted, the need closed, the notices read,
// Delta back in English, cookie gone.
{
  const DELTA = "delta@crewflex.test";
  const ORG_ADMIN = "admin.mro@crewflex.test";
  const p13Title = `Local UI check · P13 notices ${Date.now()}`;
  const p13Main = async () => (await page.locator("main").innerText()).replace(/\s+/g, " ");
  const p13Overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
  const p13Shot = (name) =>
    page.screenshot({
      path: `docs/audit/evidence/parity/P13/P13-${name}.jpg`,
      type: "jpeg",
      quality: 70,
      fullPage: false,
    });
  const p13Widths = async (name) => {
    const out = {};
    for (const width of [1024, 768, 390, 360]) {
      await page.setViewportSize({ width, height: 1100 });
      await page.waitForTimeout(250);
      out[width] = await p13Overflow();
      if (width === 390) await p13Shot(`${name}-after-390`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    return out;
  };
  const p13Prefs = async () => (await asSeedUser(DELTA, "notice-preferences")).data.preferences;
  const p13PutPrefs = async (p) =>
    (
      await asSeedUser(DELTA, "notice-preferences", {
        method: "PUT",
        body: {
          urgentOptIn: p.urgentOptIn,
          aogOptIn: p.aogOptIn,
          mobilizationHours: p.mobilizationHours,
          timeZone: p.timeZone,
          quietStart: p.quietStart,
          quietEnd: p.quietEnd,
        },
      })
    ).ok === true;
  const p13Before = await p13Prefs();
  let p13NeedId = null;
  let p13WindowId = null;
  let p13ApplicationId = null;
  try {
    // 0) Setup: Delta accepts AOG notices with 12 h of mobilization; an AOG need she is eligible for is
    //    distributed (→ «AOG: {título}»), then she applies and is shortlisted (→ «Actualización de candidatura»).
    const p13Opted = await p13PutPrefs({ ...p13Before, aogOptIn: true, mobilizationHours: 12 });
    const p13Need = await asSeedUser(ORG_ADMIN, "work-requirements", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: {
        organizationId: mroOrg.id,
        title: p13Title,
        location: "Madrid (MAD)",
        startsAt: "2027-02-08T06:00:00.000Z",
        endsAt: "2027-02-09T18:00:00.000Z",
        shift: "day",
        headcount: 1,
        urgency: "aog",
        qualifications: hiringTypes.map((q) => ({ qualificationTypeId: q.id, level: "hard" })),
      },
    });
    p13NeedId = p13Need.data?.requirement.id ?? null;
    const p13Window = await asSeedUser(DELTA, "professional-availability", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: {
        startsAt: "2027-02-08T00:00:00.000Z",
        endsAt: "2027-02-10T00:00:00.000Z",
        status: "available",
      },
    });
    p13WindowId = p13Window.data?.window.id ?? null;
    const p13Outreach = await asSeedUser(ORG_ADMIN, "requirement-outreach", {
      method: "POST",
      body: { requirementId: p13NeedId },
    });
    const p13Application = await asSeedUser(DELTA, "applications", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: { requirementId: p13NeedId, shareConsent: true },
    });
    p13ApplicationId = p13Application.data?.application.id ?? null;
    const p13OrgView = await asSeedUser(ORG_ADMIN, "applications", {
      query: { requirementId: p13NeedId },
    });
    const p13Shortlisted = await asSeedUser(ORG_ADMIN, "applications", {
      method: "PATCH",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: {
        applicationId: p13ApplicationId,
        to: "shortlisted",
        expectedUpdatedAt: p13OrgView.data?.applications.find((a) => a.id === p13ApplicationId)
          ?.updatedAt,
      },
    });
    ok(
      "PKG P13 0 setup through the local API: Delta opted in to AOG, an AOG need distributed once, her application shortlisted",
      p13Opted &&
        Boolean(p13NeedId) &&
        Boolean(p13WindowId) &&
        p13Outreach.ok === true &&
        Boolean(p13ApplicationId) &&
        p13Shortlisted.ok === true,
      `${p13Opted} need=${p13NeedId} window=${p13WindowId} outreach=${p13Outreach.ok ?? p13Outreach.error?.code} application=${p13ApplicationId} shortlist=${p13Shortlisted.ok ?? p13Shortlisted.error?.code}`,
    );

    // 1) Settings in Spanish: the v1.8 «Avisos de oportunidades» block (TEC-07 #12-#17, ACC-03 #4).
    await login(DELTA);
    await page.goto(`${BASE}/app/settings`);
    await page.waitForLoadState("networkidle");
    await page.locator("[role=radio][lang=es]").first().click();
    await page.waitForSelector("[role=status]:has-text('Idioma actualizado')", { timeout: 15000 });
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expectSpanish("PKG P13 1 «Configuración» in Spanish");
    const p13Settings = await p13Main();
    ok(
      "PKG P13 1b TEC-07 #12-#17: «Avisos de oportunidades» with the v1.8 connected labels («Quiero avisos internos de trabajos urgentes», «Quiero avisos internos AOG», «Horas mínimas que necesitas para movilizarte», «Zona horaria IANA para avisos», «Silencio desde/hasta (opcional)») and its note; «Tus datos» offers «Exportar mis datos y archivos» and «Cerrar cuenta»",
      /Avisos de oportunidades/.test(p13Settings) &&
        /Quiero avisos internos de trabajos urgentes/.test(p13Settings) &&
        /Quiero avisos internos AOG/.test(p13Settings) &&
        /Horas mínimas que necesitas para movilizarte/.test(p13Settings) &&
        /Zona horaria IANA para avisos/.test(p13Settings) &&
        /Silencio desde \(opcional\)/.test(p13Settings) &&
        /Silencio hasta \(opcional\)/.test(p13Settings) &&
        /Sin movilización declarada no se distribuyen avisos\. El silencio también se respeta para AOG; no se envían correos o SMS\./.test(
          p13Settings,
        ) &&
        /Tus datos/.test(p13Settings) &&
        /Exportar mis datos y archivos/.test(p13Settings) &&
        /Cerrar cuenta/.test(p13Settings),
      p13Settings.slice(0, 200),
    );
    await p13Shot("settings-after-1440");
    const p13SettingsWidths = await p13Widths("settings");
    ok(
      "PKG P13 1c no horizontal overflow at 1024 / 768 / 390 / 360 on «Configuración»",
      Object.values(p13SettingsWidths).every((o) => !o),
      JSON.stringify(p13SettingsWidths),
    );
    const p13Panel = page.locator("#notice-preferences");
    const p13Save = p13Panel.getByRole("button", { name: "Guardar preferencias de avisos" });
    await p13Panel.getByLabel("Zona horaria IANA para avisos").fill("Mars/Olympus");
    await p13Panel.getByLabel("Silencio desde (opcional)").fill("22:00");
    await p13Panel.getByLabel("Silencio hasta (opcional)").fill("");
    await p13Save.click();
    await p13Panel
      .getByText("Horas de silencio no válidas.")
      .waitFor({ timeout: 15000 })
      .catch(() => {});
    const p13PanelErrors = (await p13Panel.innerText()).replace(/\s+/g, " ");
    ok(
      "PKG P13 2 TEC-07 #15/#16: the v1.8 errors «Zona horaria no válida.» and «Horas de silencio no válidas.» show in the panel and nothing was saved (the API still has Europe/Madrid, no quiet hours)",
      /Zona horaria no válida\./.test(p13PanelErrors) &&
        /Horas de silencio no válidas\./.test(p13PanelErrors) &&
        (await p13Prefs()).timeZone === "Europe/Madrid" &&
        (await p13Prefs()).quietStart === null,
      p13PanelErrors.slice(0, 200),
    );
    await p13Panel.getByLabel("Zona horaria IANA para avisos").fill("Europe/Madrid");
    await p13Panel.getByLabel("Silencio desde (opcional)").fill("23:00");
    await p13Panel.getByLabel("Silencio hasta (opcional)").fill("06:30");
    await p13Save.click();
    const p13Saved = await p13Panel
      .getByRole("status")
      .filter({ hasText: "Preferencias de avisos guardadas." })
      .waitFor({ timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    const p13AfterSave = await p13Prefs();
    ok(
      "PKG P13 2b a valid form saves («Preferencias de avisos guardadas.») and the API reads the quiet hours 23:00–06:30",
      p13Saved && p13AfterSave.quietStart === "23:00" && p13AfterSave.quietEnd === "06:30",
      `${p13Saved} ${p13AfterSave.quietStart}-${p13AfterSave.quietEnd}`,
    );

    // 3) «Tus datos»: the export (TEC-07 #21) and a refused closure (TEC-07 #22) — the account stays.
    const [p13Download] = await Promise.all([
      page.waitForEvent("download", { timeout: 20000 }).catch(() => null),
      page.getByRole("link", { name: "Exportar mis datos y archivos" }).click(),
    ]);
    const p13ExportReady = await page
      .waitForSelector("[role=status]:has-text('Exportación preparada.')", { timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    ok(
      "PKG P13 3 TEC-07 #21: «Exportar mis datos y archivos» → «Exportación preparada.» and the v1.8 file name «CrewFlex-mis-datos.json»",
      p13ExportReady && p13Download?.suggestedFilename() === "CrewFlex-mis-datos.json",
      `${p13ExportReady} ${p13Download?.suggestedFilename()}`,
    );
    await page.locator("summary", { hasText: "Cerrar cuenta" }).click();
    const p13CloseText = (
      await page.locator("details:has(summary:has-text('Cerrar cuenta'))").innerText()
    ).replace(/\s+/g, " ");
    await page.fill("#confirm", "NO");
    await page.getByRole("button", { name: "Cerrar mi cuenta" }).click();
    const p13Refused = await page
      .waitForSelector("text=Escribe CERRAR para confirmar.", { timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    const p13StillThere = (await asSeedUser(DELTA, "notice-preferences")).ok === true;
    ok(
      "PKG P13 3b TEC-07 #22: «Cerrar cuenta» shows the v1.8 text («Elimina credenciales, perfil y archivos. …»), «Escribe CERRAR» and «Cerrar mi cuenta»; another word is refused with «Escribe CERRAR para confirmar.» and the account still answers",
      /Elimina credenciales, perfil y archivos\. Los registros de compromisos y auditoría se conservan sin el perfil para resolver el historial operativo\./.test(
        p13CloseText,
      ) &&
        /Escribe CERRAR/.test(p13CloseText) &&
        /Cerrar mi cuenta/.test(p13CloseText) &&
        p13Refused &&
        p13StillThere,
      `${p13Refused} ${p13StillThere} ${p13CloseText.slice(0, 160)}`,
    );

    // 4) The passport: four v1.8 visibilities and the blocks per organization (TEC-07 #2/#5/#11, ACC-03 #2/#3).
    await page.goto(`${BASE}/app/professional/profile`);
    await page.waitForLoadState("networkidle");
    await expectSpanish("PKG P13 4 «Mi pasaporte» in Spanish");
    const p13Radios = await page
      .locator("[role=radiogroup][aria-label='Visibilidad'] [role=radio]")
      .allInnerTexts();
    const p13Passport = await p13Main();
    ok(
      "PKG P13 4b TEC-07 #2/#5, ACC-03 #2: four visibility radios in v1.8 order «Privado · Anónimo · Empresas verificadas · Abierto», «Empresas verificadas» described as an anonymous profile for reviewed organizations; TEC-07 #11, ACC-03 #3: «Organizaciones bloqueadas» lists «Demo MRO Madrid» as a checkbox",
      p13Radios.length === 4 &&
        /^Privado/.test(p13Radios[0]) &&
        /^Anónimo/.test(p13Radios[1]) &&
        /^Empresas verificadas/.test(p13Radios[2]) &&
        /Perfil anónimo, en el matching y en el directorio solo de las organizaciones con la revisión registrada por la plataforma\./.test(
          p13Radios[2],
        ) &&
        /^Abierto/.test(p13Radios[3]) &&
        /Organizaciones bloqueadas/.test(p13Passport) &&
        (await page.locator(`input[name=blockedOrganizationIds][value='${mroOrg.id}']`).count()) ===
          1,
      p13Radios.map((r) => r.slice(0, 30)).join(" | "),
    );
    await page
      .locator("[role=radiogroup][aria-label='Visibilidad']")
      .scrollIntoViewIfNeeded()
      .catch(() => {});
    await p13Shot("passport-visibility-after-1440");

    // 5) «Avisos internos» (HIRE-07 #1-#6/#8, TEC-07 #19).
    await page.goto(`${BASE}/app/notices`);
    await page.waitForLoadState("networkidle");
    await expectSpanish("PKG P13 5 «Avisos internos» in Spanish");
    const p13Bell = () =>
      page.locator("a[href='/app/notices'][aria-label]").first().getAttribute("aria-label");
    const p13Notices = await p13Main();
    const p13AogCard = page.locator("main article", { hasText: `AOG: ${p13Title}` });
    const p13UpdateCard = page
      .locator("main article", { hasText: "Actualización de candidatura" })
      .filter({ hasText: p13Title });
    const p13AogText = (await p13AogCard.count()) ? await p13AogCard.innerText() : "";
    const p13UpdateText = (await p13UpdateCard.count()) ? await p13UpdateCard.innerText() : "";
    ok(
      "PKG P13 5b HIRE-07 #1-#4, TEC-07 #19: «Avisos internos» lists «AOG: {título} · Demo MRO Madrid · Consulta las condiciones…» and «Actualización de candidatura · {título} · Demo MRO Madrid · Preseleccionada» (no raw «shortlisted»), each with «Nuevo»; the bell reads «Avisos: n sin leer»; no e-mail/push sentence",
      /Avisos internos/.test(p13Notices) &&
        /No se envían correos ni notificaciones push\./.test(p13Notices) &&
        (await p13AogCard.count()) === 1 &&
        /Demo MRO Madrid · Consulta las condiciones y decide si quieres presentar candidatura\./.test(
          p13AogText,
        ) &&
        (await p13AogCard.getByText("Nuevo", { exact: true }).count()) === 1 &&
        (await p13UpdateCard.count()) === 1 &&
        /Demo MRO Madrid · Preseleccionada/.test(p13UpdateText) &&
        !/shortlisted/.test(p13UpdateText) &&
        (await p13UpdateCard.getByText("Nuevo", { exact: true }).count()) === 1 &&
        /^Avisos: [1-9]\d* sin leer$/.test((await p13Bell()) ?? ""),
      `bell=${await p13Bell()} aog=${p13AogText.slice(0, 80)} update=${p13UpdateText.slice(0, 80)}`,
    );
    await p13Shot("notices-after-1440");
    const p13NoticesWidths = await p13Widths("notices");
    ok(
      "PKG P13 5c no horizontal overflow at 1024 / 768 / 390 / 360 on «Avisos internos»",
      Object.values(p13NoticesWidths).every((o) => !o),
      JSON.stringify(p13NoticesWidths),
    );
    ok(
      "PKG P13 5d HIRE-07 #5: the action names its destination — «Ver oportunidad» on the distribution notice, «Ver candidatura» on the application notice (v1.8: «Ver oportunidades» on both)",
      (await p13AogCard.getByRole("button", { name: "Ver oportunidad" }).count()) === 1 &&
        (await p13UpdateCard.getByRole("button", { name: "Ver candidatura" }).count()) === 1,
      "",
    );
    await page.getByRole("button", { name: "Marcar todas como leídas" }).click();
    const p13AllRead = await page
      .getByRole("status")
      .filter({ hasText: "Todos tus avisos están leídos." })
      .waitFor({ timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    await page.reload();
    await page.waitForLoadState("networkidle");
    const p13BellAfter = await page
      .locator("a[href='/app/notices']")
      .first()
      .getAttribute("aria-label");
    ok(
      "PKG P13 5e HIRE-07 #8: «Marcar todas como leídas» → «Todos tus avisos están leídos.», no «Nuevo» chip left on the two notices and the bell is back to its plain name «Avisos» (no count)",
      p13AllRead &&
        (await p13AogCard.getByText("Nuevo", { exact: true }).count()) === 0 &&
        (await p13UpdateCard.getByText("Nuevo", { exact: true }).count()) === 0 &&
        p13BellAfter === "Avisos",
      `${p13AllRead} bell=${p13BellAfter}`,
    );
    await logout();

    // 6) Empty state (HIRE-07 #6): a seed account with no notices at all (English account; the Spanish
    //    literal is es.json «No tienes avisos.»).
    let p13Empty = null;
    for (const email of [
      "alpha@crewflex.test",
      "golf@crewflex.test",
      "platform.admin@crewflex.test",
    ]) {
      const total = (
        await asSeedUser(email, "notifications", { query: { offset: "0", limit: "1" } })
      ).data?.total;
      if (total === 0) {
        p13Empty = email;
        break;
      }
    }
    if (p13Empty) {
      await login(p13Empty);
      await page.goto(`${BASE}/app/notices`);
      await page.waitForLoadState("networkidle");
      ok(
        "PKG P13 6 HIRE-07 #6: an account with 0 notices (API total 0) reads the empty state «You have no notices.» and no «Mark all as read» button",
        /You have no notices\./.test(await p13Main()) &&
          (await page.getByRole("button", { name: "Mark all as read" }).count()) === 0,
        p13Empty,
      );
      await logout();
    } else {
      ok("PKG P13 6 HIRE-07 #6: empty state (skipped: no seed account without notices)", false, "");
    }

    // 7) Negatives (isolation): nobody reads or marks another person's notices or preferences.
    const p13DeltaNotices = await asSeedUser(DELTA, "notifications", {
      query: { offset: "0", limit: "5" },
    });
    const p13DeltaNoticeId = p13DeltaNotices.data?.notices.find(
      (n) => n.requirementTitle === p13Title,
    )?.id;
    const p13OrgTable = await seedRest(ORG_ADMIN, "notifications?select=id&limit=1");
    const p13OrgMark = await asSeedUser(ORG_ADMIN, "notifications", {
      method: "PATCH",
      body: { id: p13DeltaNoticeId },
    });
    const p13OrgPrefs = await asSeedUser(ORG_ADMIN, "notice-preferences");
    const p13AlphaPrefRows = await seedRest(
      "alpha@crewflex.test",
      "technician_notice_preferences?select=profile_id",
    );
    const p13DeltaPrefRows = await seedRest(
      DELTA,
      "technician_notice_preferences?select=profile_id",
    );
    const p13AnonNotices = await fetch(new URL("/functions/v1/notifications", supabaseUrl), {
      headers: { apikey: publishableKey },
    });
    const p13AnonPrefs = await fetch(new URL("/functions/v1/notice-preferences", supabaseUrl), {
      headers: { apikey: publishableKey },
    });
    ok(
      "PKG P13 7 negatives: admin.mro cannot SELECT the notifications table (42501, no grant), cannot mark Delta's notice (404 NOT_FOUND) and has no notice preferences (403 FORBIDDEN); Alpha reads 0 preference rows while Delta reads her own (RLS); anon → 401 on both functions",
      Boolean(p13DeltaNoticeId) &&
        !Array.isArray(p13OrgTable) &&
        p13OrgTable?.code === "42501" &&
        p13OrgMark.error?.code === "NOT_FOUND" &&
        p13OrgPrefs.error?.code === "FORBIDDEN" &&
        Array.isArray(p13AlphaPrefRows) &&
        p13AlphaPrefRows.length === 0 &&
        Array.isArray(p13DeltaPrefRows) &&
        p13DeltaPrefRows.length === 1 &&
        p13AnonNotices.status === 401 &&
        p13AnonPrefs.status === 401,
      `id=${Boolean(p13DeltaNoticeId)} table=${p13OrgTable?.code} mark=${p13OrgMark.error?.code} prefs=${p13OrgPrefs.error?.code} alpha=${JSON.stringify(p13AlphaPrefRows)} delta=${p13DeltaPrefRows?.length} anon=${p13AnonNotices.status}/${p13AnonPrefs.status}`,
    );
  } finally {
    // Restore: preferences, application, window, need, notices, language, cookie.
    const p13PrefsBack = await p13PutPrefs(p13Before);
    let p13Withdrawn = p13ApplicationId === null;
    if (p13ApplicationId) {
      const mine = await asSeedUser(DELTA, "applications");
      const current = mine.data?.applications.find((a) => a.id === p13ApplicationId);
      p13Withdrawn =
        current?.status === "withdrawn" ||
        (
          await asSeedUser(DELTA, "applications", {
            method: "PATCH",
            headers: { "Idempotency-Key": crypto.randomUUID() },
            body: {
              applicationId: p13ApplicationId,
              to: "withdrawn",
              expectedUpdatedAt: current?.updatedAt,
            },
          })
        ).ok === true;
    }
    const p13WindowGone =
      p13WindowId === null ||
      (
        await asSeedUser(DELTA, "professional-availability", {
          method: "DELETE",
          query: { id: p13WindowId },
        })
      ).ok === true;
    const p13NeedClosed =
      p13NeedId === null ||
      (
        await asSeedUser(ORG_ADMIN, "work-requirements", {
          method: "PATCH",
          body: { id: p13NeedId, status: "closed" },
        })
      ).ok === true;
    for (const email of [DELTA, ORG_ADMIN, "manager.mro@crewflex.test"]) {
      await asSeedUser(email, "notifications", { method: "PATCH", body: { all: true } });
    }
    const p13English =
      (await asSeedUser(DELTA, "user-preferences", { method: "PATCH", body: { locale: "en" } }))
        .ok === true;
    await ctx.clearCookies({ name: "crewflex-locale" });
    ok(
      "PKG P13 8 restore: Delta's notice preference values as before (the row may now exist), the application withdrawn, the window deleted, the need closed, Delta in English",
      p13PrefsBack && p13Withdrawn && p13WindowGone && p13NeedClosed && p13English,
      `${p13PrefsBack} ${p13Withdrawn} ${p13WindowGone} ${p13NeedClosed} ${p13English}`,
    );
  }
}

// PKG P14a (shell parity, F3 — SH-01 #12/#13, SH-02 #19/#21-#23/#25, SH-03 #1-#11/#13/#14/#16-#22/#24/#25/#27-#29/#31/#32,
// SH-04 #1-#3/#6/#9-#11, SH-05 #1-#4/#6/#9-#11, SH-06 #10, SH-07 #3-#5/#9/#10/#14/#15, SHOT-09 #1/#2; re-verification of
// shell-visual T-140…T-148 `44045db`, notices `cb13e1e`, logbook `ebb38c2`, hiring-polish `7d6fda7`, directory `2944b64`,
// admin-org `302bff1`, recruiter `0db7ce6`, D-13 `d3b876f`; no new code): in Spanish, Delta's shell shows the v1.8 brand,
// the «CrewFlex / {entrada}» header with the bell, the professional menu in the v1.8 order (with «Logbook» and «Avisos»),
// the footer motto and the person line; below lg the «Menú» disclosure, the navy bar with the bell and «Cerrar sesión»,
// and the five-shortcut dock that follows the workspace on shared pages; the skip link does not navigate; sign-out ends
// on «Sesión cerrada.». Negatives: a professional has no organization or platform section and no «Ver como», gets a real
// 404 on the platform pages and on an unknown /app path and is sent from /app/organization to /app/professional; an
// organization-only account has no professional section, its dock is the company one and the technician pages tell it
// where its applications are; a manager has no platform section; the platform admin lands on /app/admin with the four
// views and a two-shortcut dock; anonymous requests are redirected to /login?next=… (also /app/tools) while /tools is
// public with «Acceder a mi cuenta». Nothing is written except Delta's language, restored in `finally` (API + cookie).
{
  const DELTA = "delta@crewflex.test";
  const p14Shot = (name) =>
    page.screenshot({
      path: `docs/audit/evidence/parity/P14a/P14a-${name}.jpg`,
      type: "jpeg",
      quality: 70,
      fullPage: false,
    });
  const p14Overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
  const p14Widths = async (name) => {
    const out = {};
    for (const width of [1024, 768, 390, 360]) {
      await page.setViewportSize({ width, height: 1100 });
      await page.waitForTimeout(250);
      out[width] = await p14Overflow();
      if (width === 390) await p14Shot(`${name}-after-390`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    return out;
  };
  /** The shell as the signed-in account sees it: sidebar sections, switcher, header, footer, person, dock. */
  const p14Shell = () =>
    page.evaluate(() => {
      const visible = (el) => !!el && el.getClientRects().length > 0;
      const text = (el) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
      // A menu entry's own label: without the unread badge (decorative count + sr-only reading).
      const label = (a) => {
        const clone = a.cloneNode(true);
        clone.querySelectorAll("span").forEach((s) => s.remove());
        return text(clone);
      };
      const aside = document.querySelector("aside");
      const header = document.querySelector("header");
      const footer = document.querySelector("footer");
      const dock = document.querySelector(
        "nav[aria-label='Accesos rápidos'], nav[aria-label='Quick access']",
      );
      const menuButton = aside.querySelector("button[aria-expanded]");
      const switcher = aside.querySelector("nav[aria-labelledby]");
      return {
        sections: [...aside.querySelectorAll("nav[aria-label]")].map((nav) => ({
          label: nav.getAttribute("aria-label"),
          visible: visible(nav),
          headingVisible: visible(nav.previousElementSibling),
          items: [...nav.querySelectorAll("a")].map((a) => ({
            href: a.getAttribute("href"),
            text: label(a),
            current: a.getAttribute("aria-current"),
            icon: !!a.querySelector("svg path"),
          })),
        })),
        switcher: switcher
          ? [...switcher.querySelectorAll("a")].map((a) => ({
              text: text(a),
              current: a.getAttribute("aria-current"),
            }))
          : null,
        brand: text(aside.querySelector("a[href='/app']")),
        brandPlane: !!aside.querySelector("a[href='/app'] svg path"),
        // The breadcrumb items joined as read («CrewFlex / Mi espacio»); the footer as rendered (CSS uppercase).
        crumb: visible(header)
          ? [...header.querySelectorAll("nav ol > li")].map(text).join(" ")
          : null,
        headerBell: visible(header) && !!header.querySelector("a[href='/app/notices'][aria-label]"),
        barBells: [...aside.querySelectorAll("a[href='/app/notices'][aria-label]")].filter(visible)
          .length,
        bellLabels: [...document.querySelectorAll("a[href='/app/notices'][aria-label]")]
          .filter(visible)
          .map((b) => b.getAttribute("aria-label")),
        footer: footer
          ? [...footer.querySelectorAll("span")].filter(visible).map((s) => s.innerText.trim())
          : [],
        person: [...aside.querySelectorAll(":scope > div:last-child p")].filter(visible).map(text),
        signOut: [...aside.querySelectorAll("form button")].filter(visible).map(text),
        menuButton: visible(menuButton) ? menuButton.getAttribute("aria-expanded") : null,
        dock:
          dock && visible(dock)
            ? [...dock.querySelectorAll("a")].map((a) => ({
                text: text(a),
                current: a.getAttribute("aria-current"),
              }))
            : null,
        title: document.title,
      };
    });
  const p14Menu = (shell) =>
    shell.sections.map((s) => `${s.label}: ${s.items.map((i) => i.text).join(" · ")}`).join(" | ");
  const p14Dock = (shell) => shell.dock?.map((d) => d.text).join(" · ") ?? "none";
  const p14Current = (shell) => shell.dock?.find((d) => d.current === "page")?.text ?? "none";
  try {
    // 0) Anonymous: every /app path → /login?next=<path+query> (SH-07 #5), /app/tools included; /tools is public
    //    with the v1.8 anonymous shell's «Acceder a mi cuenta» and no dock (SH-01 #13, SH-05 #3).
    const p14AnonCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p14Anon = await p14AnonCtx.newPage();
    const p14Redirects = {};
    for (const path of ["/app/professional", "/app/tools", "/app/notices?page=2"]) {
      const r = await p14Anon.request.get(`${BASE}${path}`, { maxRedirects: 0 });
      p14Redirects[path] = `${r.status()} ${r.headers().location ?? ""}`;
    }
    const p14ToolsResponse = await p14Anon.goto(`${BASE}/tools`);
    await p14Anon.waitForLoadState("networkidle");
    const p14PublicTools = await p14Anon.evaluate(() => ({
      signIn: [...document.querySelectorAll("header a[href='/login']")].map((a) =>
        a.textContent.trim(),
      ),
      dock: document.querySelectorAll(
        "nav[aria-label='Quick access'], nav[aria-label='Accesos rápidos']",
      ).length,
      brand: document.querySelector("header a[href='/']")?.textContent.replace(/\s+/g, "") ?? "",
      plane: !!document.querySelector("header a[href='/'] svg path"),
    }));
    await p14Anon.screenshot({
      path: "docs/audit/evidence/parity/P14a/P14a-tools-public-after-1440.jpg",
      type: "jpeg",
      quality: 70,
    });
    await p14AnonCtx.close();
    ok(
      "PKG P14a 0 anon: /app/professional, /app/tools and /app/notices?page=2 answer 307 to /login?next=<path+query>; /tools answers 200 with the v1.8 brand and «Sign in to my account» (es «Acceder a mi cuenta») in its header and no dock",
      /^307 .*\/login\?next=%2Fapp%2Fprofessional$/.test(p14Redirects["/app/professional"]) &&
        /^307 .*\/login\?next=%2Fapp%2Ftools$/.test(p14Redirects["/app/tools"]) &&
        /^307 .*\/login\?next=%2Fapp%2Fnotices%3Fpage%3D2$/.test(
          p14Redirects["/app/notices?page=2"],
        ) &&
        p14ToolsResponse?.status() === 200 &&
        p14PublicTools.signIn.join() === "Sign in to my account" &&
        p14PublicTools.dock === 0 &&
        p14PublicTools.brand === "CrewFlexAVIATION" &&
        p14PublicTools.plane,
      `${JSON.stringify(p14Redirects)} ${p14ToolsResponse?.status()} ${JSON.stringify(p14PublicTools)}`,
    );

    // 1) Delta (professional, no membership) in Spanish on «Mi espacio».
    await login(DELTA);
    await page.goto(`${BASE}/app/settings`);
    await page.waitForLoadState("networkidle");
    await page.locator("[role=radio][lang=es]").first().click();
    await page.waitForSelector("[role=status]:has-text('Idioma actualizado')", { timeout: 15000 });
    await page.goto(`${BASE}/app/professional`);
    await page.waitForLoadState("networkidle");
    await expectSpanish("PKG P14a 1 «Mi espacio» in Spanish");
    const p14Delta = await p14Shell();
    ok(
      "PKG P14a 1b SH-03 #1/#3-#11/#13/#14, SH-02 #21: Delta's sidebar has exactly «Profesional» (Mi espacio · Mi pasaporte · Cualificaciones · Disponibilidad · Oportunidades · Mis candidaturas · Documentos · Logbook) and «Cuenta» (Avisos · Herramientas · Configuración), headings visible, an icon on every entry, «Mi espacio» aria-current=page; no organization or platform section and no «Ver como»",
      p14Menu(p14Delta) ===
        "Profesional: Mi espacio · Mi pasaporte · Cualificaciones · Disponibilidad · Oportunidades · Mis candidaturas · Documentos · Logbook | Cuenta: Avisos · Herramientas · Configuración" &&
        p14Delta.sections.every(
          (s) => s.visible && s.headingVisible && s.items.every((i) => i.icon),
        ) &&
        p14Delta.sections
          .flatMap((s) => s.items)
          .filter((i) => i.current === "page")
          .map((i) => i.text)
          .join() === "Mi espacio" &&
        p14Delta.switcher === null,
      p14Menu(p14Delta),
    );
    ok(
      "PKG P14a 1c SH-04 #1/#2/#3/#6/#9/#10/#11, SH-03 #32: at 1440 the header reads «CrewFlex / Mi espacio» with the bell (named «Avisos…», none in the sidebar), the brand is the plane + «CrewFlex AVIATION» linking to /app, the footer reads «CREWFLEX AVIATION» · «Cualificación · Disponibilidad · Confianza» (no version), the person line «Technician Delta» / «Profesional» with «Cerrar sesión», no «Menú» button, no dock, title «Mi espacio · CrewFlex»",
      p14Delta.crumb === "CrewFlex / Mi espacio" &&
        p14Delta.headerBell &&
        p14Delta.barBells === 0 &&
        p14Delta.bellLabels.length === 1 &&
        p14Delta.bellLabels.every((l) => /^Avisos/.test(l)) &&
        p14Delta.brand === "CrewFlexAVIATION" &&
        p14Delta.brandPlane &&
        p14Delta.footer.join(" · ") ===
          "CREWFLEX AVIATION · Cualificación · Disponibilidad · Confianza" &&
        p14Delta.person.join(" / ") === "Technician Delta / Profesional" &&
        p14Delta.signOut.join() === "Cerrar sesión" &&
        p14Delta.menuButton === null &&
        p14Delta.dock === null &&
        p14Delta.title === "Mi espacio · CrewFlex",
      JSON.stringify({ ...p14Delta, sections: undefined }),
    );
    await p14Shot("shell-after-1440");
    const p14DeltaWidths = await p14Widths("shell");
    ok(
      "PKG P14a 1d SH-05 #11: no horizontal overflow at 1024 / 768 / 390 / 360 on «Mi espacio»",
      Object.values(p14DeltaWidths).every((o) => o === false),
      JSON.stringify(p14DeltaWidths),
    );

    // 2) Below lg: the navy bar, the «Menú» disclosure and the dock (SH-05, SHOT-09).
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);
    const p14Closed = await p14Shell();
    await page.getByRole("button", { name: "Menú", exact: true }).click();
    await page.waitForTimeout(250);
    const p14Open = await p14Shell();
    const p14OpenOverflow = await p14Overflow();
    await p14Shot("menu-after-390");
    ok(
      "PKG P14a 2 SH-05 #4/#9/#11, SH-04 #2, SHOT-09 #1: at 390 the header crumb is gone, one bell and «Cerrar sesión»; «Menú» (aria-expanded=false, sections hidden) opens the same two sections (aria-expanded=true, section headings hidden) without horizontal overflow; the footer keeps «CREWFLEX AVIATION» and hides the motto",
      p14Closed.crumb === null &&
        p14Closed.barBells === 1 &&
        p14Closed.signOut.join() === "Cerrar sesión" &&
        p14Closed.menuButton === "false" &&
        p14Closed.sections.every((s) => !s.visible) &&
        p14Open.menuButton === "true" &&
        p14Open.sections.every((s) => s.visible && !s.headingVisible) &&
        p14Menu(p14Open) === p14Menu(p14Delta) &&
        !p14OpenOverflow &&
        p14Closed.footer.join() === "CREWFLEX AVIATION",
      JSON.stringify({
        crumb: p14Closed.crumb,
        bells: p14Closed.barBells,
        signOut: p14Closed.signOut,
        menu: [p14Closed.menuButton, p14Open.menuButton],
        footer: p14Closed.footer,
        overflow: p14OpenOverflow,
      }),
    );
    await page
      .getByRole("navigation", { name: "Profesional", exact: true })
      .getByRole("link", { name: "Disponibilidad", exact: true })
      .click();
    await page.waitForURL(/\/app\/professional\/availability$/, { timeout: 20000 });
    await page.waitForLoadState("networkidle");
    const p14Availability = await p14Shell();
    await page.goto(`${BASE}/app/tools`);
    await page.waitForLoadState("networkidle");
    const p14ToolsShell = await p14Shell();
    ok(
      "PKG P14a 2b SH-05 #1/#6, SHOT-09 #2: the dock reads «Inicio · Ofertas · Calendario · Candidaturas · Herramientas» with «Inicio» current on Mi espacio; choosing «Disponibilidad» in the open menu closes it and the dock marks «Calendario»; on the shared «Herramientas» the technician's dock stays, «Herramientas» current",
      p14Dock(p14Closed) === "Inicio · Ofertas · Calendario · Candidaturas · Herramientas" &&
        p14Current(p14Closed) === "Inicio" &&
        p14Availability.menuButton === "false" &&
        p14Current(p14Availability) === "Calendario" &&
        p14Dock(p14ToolsShell) === "Inicio · Ofertas · Calendario · Candidaturas · Herramientas" &&
        p14Current(p14ToolsShell) === "Herramientas",
      `${p14Dock(p14Closed)} / ${p14Current(p14Closed)} → ${p14Availability.menuButton} ${p14Current(p14Availability)} → ${p14Dock(p14ToolsShell)} / ${p14Current(p14ToolsShell)}`,
    );
    await page.setViewportSize({ width: 1440, height: 900 });

    // 3) The header names the entry the path belongs to, query included (SH-04 #1, SH-07 #2).
    const p14Crumbs = {};
    for (const path of [
      "/app/notices",
      "/app/professional/availability?month=2027-02",
      "/app/settings",
    ]) {
      await page.goto(`${BASE}${path}`);
      await page.waitForLoadState("networkidle");
      p14Crumbs[path] = (await p14Shell()).crumb;
    }
    ok(
      "PKG P14a 3 SH-04 #1, SH-07 #2: the header reads «CrewFlex / Avisos», «CrewFlex / Disponibilidad» (with ?month=) and «CrewFlex / Configuración»",
      Object.values(p14Crumbs).join(" | ") ===
        "CrewFlex / Avisos | CrewFlex / Disponibilidad | CrewFlex / Configuración",
      JSON.stringify(p14Crumbs),
    );

    // 4) The skip link (SH-07 #9): v1.8 «Ir al contenido» navigated to Inicio; Next's stays on the page.
    await page.goto(`${BASE}/app/professional`);
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Tab");
    const p14Skip = await page.evaluate(() => {
      const a = document.activeElement;
      return {
        text: a?.textContent?.trim(),
        href: a?.getAttribute("href"),
        width: a?.getBoundingClientRect().width ?? 0,
      };
    });
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    const p14AfterSkip = await page.evaluate(() => `${location.pathname}${location.hash}`);
    ok(
      "PKG P14a 4 SH-07 #9: Tab reaches «Saltar al contenido» (href #main, visible when focused); Enter stays on /app/professional#main",
      p14Skip.text === "Saltar al contenido" &&
        p14Skip.href === "#main" &&
        p14Skip.width > 1 &&
        p14AfterSkip === "/app/professional#main",
      `${JSON.stringify(p14Skip)} → ${p14AfterSkip}`,
    );

    // 5) Negatives for a professional: platform pages and an unknown path are real 404s (X-11, T-147);
    //    /app/organization redirects without membership (SH-07 #3).
    const p14Denied = {};
    for (const path of [
      "/app/admin",
      "/app/recruiter",
      "/app/admin/verifications",
      "/app/no-existe",
    ]) {
      expectedErrorUrls.add(`${BASE}${path}`);
      const response = await page.goto(`${BASE}${path}`);
      await page.waitForLoadState("networkidle");
      p14Denied[path] = {
        status: response?.status(),
        title: await page.title(),
        aside: await page.locator("aside").count(),
        h1: (await page.locator("h1").allInnerTexts()).join(),
      };
      expectedErrorUrls.delete(`${BASE}${path}`);
    }
    await page.goto(`${BASE}/app/organization`);
    await page.waitForLoadState("networkidle");
    const p14OrgRedirect = new URL(page.url()).pathname;
    ok(
      "PKG P14a 5 SH-07 #3/#4/#14, SH-06 #10: as a professional, /app/admin, /app/recruiter, /app/admin/verifications and /app/no-existe answer HTTP 404 titled «CrewFlex» with the h1 «No encontrado» and no sidebar; /app/organization lands on /app/professional",
      Object.values(p14Denied).every(
        (d) =>
          d.status === 404 && d.title === "CrewFlex" && d.aside === 0 && d.h1 === "No encontrado",
      ) && p14OrgRedirect === "/app/professional",
      `${JSON.stringify(p14Denied)} org→${p14OrgRedirect}`,
    );

    // 6) Sign out ends on the login page with the v1.8 notice (SH-04 #6).
    await logout();
    await page.waitForLoadState("networkidle");
    const p14SignedOut = await page.locator("[role=status]").allInnerTexts();
    ok(
      "PKG P14a 6 SH-04 #6: «Cerrar sesión» ends on /login with the v1.8 notice «Sesión cerrada.»",
      /\/login/.test(page.url()) && p14SignedOut.some((t) => t.trim() === "Sesión cerrada."),
      `${page.url()} ${p14SignedOut.join(" | ")}`,
    );

    // 7) An organization-only account (admin.mro, en): the company menu and dock, no professional section,
    //    and the technician pages name the organization's own place (SH-03 #17-#22, SH-05 #2, SH-07 #15).
    await login("admin.mro@crewflex.test");
    await page.goto(`${BASE}/app/organization`);
    await page.waitForLoadState("networkidle");
    const p14Org = await p14Shell();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);
    const p14OrgMobile = await p14Shell();
    await p14Shot("org-dock-after-390");
    await page.setViewportSize({ width: 1440, height: 900 });
    const p14OrgPages = {};
    for (const path of ["/app/professional/applications", "/app/professional/opportunities"]) {
      await page.goto(`${BASE}${path}`);
      await page.waitForLoadState("networkidle");
      p14OrgPages[path] = {
        text: (await page.locator("main").innerText()).replace(/\s+/g, " "),
        link: await page.locator("main a[href='/app/organization/applications']").count(),
      };
    }
    ok(
      "PKG P14a 7 SH-03 #2/#17-#22/#24/#27/#31, SH-05 #2, SH-07 #15: admin.mro (organization only) has «Demo MRO Madrid» (Dashboard · Requirements · Find candidates · Applications · Offers in the network · Workforce · Organization) and «Account» (Notices · Tools · Settings) — no professional or platform section, no «View as», no «New requirement» entry —, the person line «Admin Demo MRO» / «Organization · Admin», header «CrewFlex / Dashboard»; at 390 the dock reads «Home · Offers · Candidates · Applications · Tools»; «My applications» says it is for professionals and links the organization's «Applications», «Opportunities» says the account has no professional passport",
      p14Menu(p14Org) ===
        "Demo MRO Madrid: Dashboard · Requirements · Find candidates · Applications · Offers in the network · Workforce · Organization | Account: Notices · Tools · Settings" &&
        p14Org.switcher === null &&
        p14Org.person.join(" / ") === "Admin Demo MRO / Organization · Admin" &&
        p14Org.crumb === "CrewFlex / Dashboard" &&
        p14Dock(p14OrgMobile) === "Home · Offers · Candidates · Applications · Tools" &&
        p14Current(p14OrgMobile) === "Home" &&
        /«My applications» is for professionals/.test(
          p14OrgPages["/app/professional/applications"].text,
        ) &&
        p14OrgPages["/app/professional/applications"].link === 1 &&
        /no professional passport/.test(p14OrgPages["/app/professional/opportunities"].text),
      `${p14Menu(p14Org)} · ${p14Org.person.join(" / ")} · ${p14Org.crumb} · ${p14Dock(p14OrgMobile)} · ${p14OrgPages["/app/professional/applications"].text.slice(0, 120)}`,
    );

    // 8) Professional + manager (manager.mro, en): three sections in order, the dock follows the workspace.
    await logout();
    await login("manager.mro@crewflex.test");
    await page.goto(`${BASE}/app/organization`);
    await page.waitForLoadState("networkidle");
    const p14Manager = await p14Shell();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);
    const p14ManagerOrgDock = p14Dock(await p14Shell());
    await page.goto(`${BASE}/app/professional`);
    await page.waitForLoadState("networkidle");
    const p14ManagerProDock = p14Dock(await p14Shell());
    await page.setViewportSize({ width: 1440, height: 900 });
    ok(
      "PKG P14a 8 SH-03 #28/#32, SH-05 #1/#2: manager.mro (professional + manager) has «Demo MRO Madrid» → «Professional» → «Account» in that order, no platform section nor «View as», the person line «Ops Manager Demo MRO» / «Professional · Manager»; at 390 the dock is the company one on Dashboard and the technician one on Overview",
      p14Manager.sections.map((s) => s.label).join(" → ") ===
        "Demo MRO Madrid → Professional → Account" &&
        p14Manager.switcher === null &&
        p14Manager.person.join(" / ") === "Ops Manager Demo MRO / Professional · Manager" &&
        p14ManagerOrgDock === "Home · Offers · Candidates · Applications · Tools" &&
        p14ManagerProDock === "Home · Offers · Calendar · Applications · Tools",
      `${p14Manager.sections.map((s) => s.label).join(" → ")} · ${p14Manager.person.join(" / ")} · ${p14ManagerOrgDock} · ${p14ManagerProDock}`,
    );

    // 9) The platform admin (en): lands on /app/admin, «View as» with the four views, the admin dock (D-13, T-141).
    await logout();
    await login("platform.admin@crewflex.test");
    const p14AdminLanding = new URL(page.url()).pathname;
    const p14Admin = await p14Shell();
    await p14Shot("admin-after-1440");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);
    const p14AdminDock = await p14Shell();
    await page.setViewportSize({ width: 1440, height: 900 });
    ok(
      "PKG P14a 9 SH-01 #12, SH-07 #10, SH-02 #19/#22/#23/#25, SH-03 #25, SH-05 #3: platform.admin lands on /app/admin; «View as» offers Technician · Company · Recruiter · Administration with «Administration» aria-current=page; the sidebar shows only «Platform» (Administration · Verifications · Organizations · Representations · Audit) and «Account»; the person line «Platform Admin» / «Professional · Platform admin», header «CrewFlex / Administration»; at 390 the dock reads «Administration · Tools»",
      p14AdminLanding === "/app/admin" &&
        p14Admin.switcher?.map((v) => v.text).join(" · ") ===
          "Technician · Company · Recruiter · Administration" &&
        p14Admin.switcher.find((v) => v.current === "page")?.text === "Administration" &&
        p14Menu(p14Admin) ===
          "Platform: Administration · Verifications · Organizations · Representations · Audit | Account: Notices · Tools · Settings" &&
        p14Admin.person.join(" / ") === "Platform Admin / Professional · Platform admin" &&
        p14Admin.crumb === "CrewFlex / Administration" &&
        p14Dock(p14AdminDock) === "Administration · Tools" &&
        p14Current(p14AdminDock) === "Administration",
      `${p14AdminLanding} · ${p14Admin.switcher?.map((v) => `${v.text}${v.current ? `(${v.current})` : ""}`).join(" · ")} · ${p14Menu(p14Admin)} · ${p14Admin.person.join(" / ")} · ${p14Admin.crumb} · ${p14Dock(p14AdminDock)}`,
    );
    await logout();
  } finally {
    await page.setViewportSize({ width: 1440, height: 900 });
    if (/\/app/.test(page.url())) await logout().catch(() => {});
    const p14English =
      (await asSeedUser(DELTA, "user-preferences", { method: "PATCH", body: { locale: "en" } }))
        .ok === true;
    await ctx.clearCookies({ name: "crewflex-locale" });
    ok(
      "PKG P14a 10 restore: Delta in English, locale cookie cleared",
      p14English,
      String(p14English),
    );
  }
}

// PKG P14b (access and account parity, F3 — AUTH-01 #4-#9/#11/#12/#15-#17, AUTH-02 #2/#5/#6/#9-#13/#17, AUTH-03 #1-#5/#7,
// AUTH-04 #1-#5/#9-#18, AUTH-05 #8/#9/#11, AUTH-06 #7-#9/#11, ACC-01 #1/#2/#4/#5/#9-#11, ACC-02 #2-#5, SH-07 #5/#6/#8,
// SH-08 #4; re-verification of the account package `83fc371` (T-40 flag, T-41 confirmation, N-13 export, N-14 close,
// 12 h session), `4ff9852` (no enumeration at sign-up) and T-145; no new code): Spanish anonymous pages through the
// ES/EN switch of the auth layout (cookie only): the login, sign-up and recovery literals, the empty submit, a wrong
// password (same answer for an unknown address), the 11-character password refused before Auth, the security headers;
// then one throwaway professional account created through the local sign-up: «Revisa tu bandeja de entrada», the
// login refused before the confirmation, the Mailpit link → «Correo confirmado…», the same link reused and two forged
// links → their own notices, the recovery e-mail → the reset form (mismatch, same password, new password), every
// session closed by the reset (second browser context), the old password refused, `next` honoured and an external
// `next` ignored, «Configuración» (account facts, language persisted on the profile, cookies readable from JS),
// «Cerrar sesión» → «Sesión cerrada.» and the protected route back to 307, «Cerrar cuenta» (wrong word refused) →
// «Cuenta cerrada.». No seed account is written: the seed logins are two refused attempts; the throwaway account is
// closed at the end (or through the API in `finally`), the locale cookie cleared.
{
  const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:56324";
  const P14B_EMAIL = `p14b-${Date.now()}@crewflex.test`;
  const P14B_PW1 = `${PW}-p14b-uno`;
  const P14B_PW2 = `${PW}-p14b-dos`;
  let p14bCreated = false;
  let p14bClosed = false;
  let p14bPassword = P14B_PW1;
  let p14bCtxB = null;
  const p14bShot = (name) =>
    page.screenshot({
      path: `docs/audit/evidence/parity/P14b/P14b-${name}.jpg`,
      type: "jpeg",
      quality: 70,
      fullPage: false,
    });
  const p14bOverflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
  /** Overflow at the four widths (SH-05 #11 for the access pages); the 390 capture. */
  const p14bWidths = async (name) => {
    const out = {};
    for (const width of [1024, 768, 390, 360]) {
      await page.setViewportSize({ width, height: 1100 });
      await page.waitForTimeout(250);
      out[width] = await p14bOverflow();
      if (width === 390) await p14bShot(`${name}-after-390`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    return out;
  };
  const p14bAlerts = async () =>
    (await page.locator("main [role=alert]").allInnerTexts()).map((t) => t.trim());
  const p14bStatus = async () =>
    (await page.locator("main [role=status]").allInnerTexts()).map((t) =>
      t.replace(/\s+/g, " ").trim(),
    );
  const p14bGoEs = async (path) => {
    await page.goto(`${BASE}${path}`);
    await page.waitForLoadState("networkidle");
    if ((await page.evaluate(() => document.documentElement.lang)) !== "es") {
      await page.locator("[role=radio][lang=es]").first().click();
      await page.waitForFunction(() => document.documentElement.lang === "es", null, {
        timeout: 15000,
      });
      await page.waitForLoadState("networkidle");
    }
  };
  /** The newest Mailpit message for the throwaway address whose link matches `where`. */
  const p14bMailLink = async (where) => {
    for (let i = 0; i < 24; i++) {
      await page.waitForTimeout(500);
      const found = await fetch(
        `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${P14B_EMAIL}"`)}`,
      ).then(
        (r) => (r.ok ? r.json() : null),
        () => null,
      );
      for (const m of found?.messages ?? []) {
        const message = await fetch(`${MAILPIT}/api/v1/message/${m.ID}`).then((r) => r.json());
        const link = /href="([^"]+)"/.exec(message.HTML ?? "")?.[1]?.replaceAll("&amp;", "&");
        if (link && where.test(decodeURIComponent(link))) return link;
      }
    }
    return null;
  };
  const p14bSignIn = async (email, password) => {
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.click("main form button[type=submit]");
  };
  try {
    // 0) Anonymous, before any page: the security headers of /login (AUTH-06 #7/#8) and the guard with `next`
    //    (SH-07 #5) on two account routes.
    const p14bHead = await page.request.get(`${BASE}/login`, { maxRedirects: 0 });
    const p14bHeaders = p14bHead.headers();
    const p14bRedirects = {};
    for (const path of ["/app/settings", "/app/professional/profile?tab=visibility"]) {
      const r = await page.request.get(`${BASE}${path}`, { maxRedirects: 0 });
      p14bRedirects[path] = `${r.status()} ${r.headers().location ?? ""}`;
    }
    ok(
      "PKG P14b 0 AUTH-06 #7/#8, SH-07 #5: /login answers 200 with Content-Security-Policy-Report-Only (default-src 'self', script nonce + strict-dynamic, frame-ancestors 'none'; no enforcing header), X-Content-Type-Options nosniff, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy camera/microphone/geolocation and no X-Powered-By; anonymous /app/settings and /app/professional/profile?tab=visibility answer 307 to /login?next=<path+query>",
      p14bHead.status() === 200 &&
        /default-src 'self'/.test(p14bHeaders["content-security-policy-report-only"] ?? "") &&
        /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/.test(
          p14bHeaders["content-security-policy-report-only"] ?? "",
        ) &&
        /frame-ancestors 'none'/.test(p14bHeaders["content-security-policy-report-only"] ?? "") &&
        p14bHeaders["content-security-policy"] === undefined &&
        p14bHeaders["x-content-type-options"] === "nosniff" &&
        p14bHeaders["x-frame-options"] === "DENY" &&
        p14bHeaders["referrer-policy"] === "strict-origin-when-cross-origin" &&
        p14bHeaders["permissions-policy"] === "camera=(), microphone=(), geolocation=()" &&
        p14bHeaders["x-powered-by"] === undefined &&
        /^307 .*\/login\?next=%2Fapp%2Fsettings$/.test(p14bRedirects["/app/settings"]) &&
        /^307 .*\/login\?next=%2Fapp%2Fprofessional%2Fprofile%3Ftab%3Dvisibility$/.test(
          p14bRedirects["/app/professional/profile?tab=visibility"],
        ),
      `${p14bHead.status()} csp-ro=${(p14bHeaders["content-security-policy-report-only"] ?? "").slice(0, 80)} xfo=${p14bHeaders["x-frame-options"]} rp=${p14bHeaders["referrer-policy"]} ${JSON.stringify(p14bRedirects)}`,
    );

    // 1) The login in Spanish (AUTH-01 #1/#2/#4-#6/#8-#10, SH-01 #13): literals, links and the card.
    await p14bGoEs("/login");
    await expectSpanish("PKG P14b 1 «Iniciar sesión» in Spanish");
    const p14bLogin = await page.evaluate(() => {
      const text = (el) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
      const main = document.querySelector("main");
      const pw = document.querySelector("#password");
      return {
        h1: text(main.querySelector("h1")),
        lead: text(main.querySelector("h1 + p")),
        emailLabel: text(main.querySelector("label[for=email]")),
        emailType: document.querySelector("#email")?.getAttribute("type"),
        emailAuto: document.querySelector("#email")?.getAttribute("autocomplete"),
        passwordLabel: text(main.querySelector("label[for=password]")),
        passwordAuto: pw?.getAttribute("autocomplete"),
        passwordMin: pw?.getAttribute("minlength"),
        noValidate: main.querySelector("form")?.hasAttribute("novalidate"),
        submit: text(main.querySelector("form button[type=submit]")),
        links: [...main.querySelectorAll("a")].map((a) => `${text(a)}→${a.getAttribute("href")}`),
        tail: [...main.querySelectorAll(":scope > p")].map(text),
        brand: text(document.querySelector("a[href='/']")).replace(/\s+/g, ""),
        plane: !!document.querySelector("a[href='/'] svg path"),
        switcher: [...document.querySelectorAll("[role=radiogroup] [role=radio]")].map(
          (b) => `${b.textContent.trim()}:${b.getAttribute("aria-checked")}`,
        ),
        title: document.title,
      };
    });
    ok(
      "PKG P14b 1b AUTH-01 #1/#2/#4-#6/#8-#10, SH-01 #13: the card reads «Iniciar sesión» / «Accede a tu espacio de CrewFlex.», «Correo electrónico» (type=email, autocomplete email), «Contraseña» (current-password, no minLength at sign-in), form noValidate, button «Iniciar sesión», links «¿Has olvidado tu contraseña?» → /forgot-password, «Crea una» → /register after «¿Sin cuenta?» (flag `invitation_signup` off in this environment), «Abrir herramientas» → /tools after «Las herramientas se pueden utilizar sin abrir una cuenta.»; the brand (plane + «CrewFlex AVIATION») links to / and the ES/EN switch marks ES; title «Iniciar sesión · CrewFlex»",
      p14bLogin.h1 === "Iniciar sesión" &&
        p14bLogin.lead === "Accede a tu espacio de CrewFlex." &&
        p14bLogin.emailLabel === "Correo electrónico" &&
        p14bLogin.emailType === "email" &&
        p14bLogin.emailAuto === "email" &&
        p14bLogin.passwordLabel === "Contraseña" &&
        p14bLogin.passwordAuto === "current-password" &&
        p14bLogin.passwordMin === null &&
        p14bLogin.noValidate === true &&
        p14bLogin.submit === "Iniciar sesión" &&
        p14bLogin.links.join(" | ") ===
          "¿Has olvidado tu contraseña?→/forgot-password | Crea una→/register | Abrir herramientas→/tools" &&
        p14bLogin.tail.join(" | ") ===
          "Accede a tu espacio de CrewFlex. | ¿Has olvidado tu contraseña? | ¿Sin cuenta? Crea una | Las herramientas se pueden utilizar sin abrir una cuenta. Abrir herramientas" &&
        p14bLogin.brand === "CrewFlexAVIATION" &&
        p14bLogin.plane &&
        p14bLogin.switcher.join() === "es:true,en:false" &&
        p14bLogin.title === "Iniciar sesión · CrewFlex",
      JSON.stringify(p14bLogin),
    );
    await p14bShot("login-after-1440");
    const p14bLoginWidths = await p14bWidths("login");
    ok(
      "PKG P14b 1c no horizontal overflow at 1024 / 768 / 390 / 360 on /login",
      Object.values(p14bLoginWidths).every((o) => o === false),
      JSON.stringify(p14bLoginWidths),
    );

    // 1d) The empty submit: the catalogue messages, not the browser's (AUTH-01 #7).
    await page.click("main form button[type=submit]");
    await page.waitForSelector("main [role=alert]:has-text('Revisa los campos marcados.')", {
      timeout: 15000,
    });
    const p14bEmpty = {
      alert: await p14bAlerts(),
      email: (await page.locator("#email-error").allInnerTexts()).join(),
      password: (await page.locator("#password-error").allInnerTexts()).join(),
      invalid: await page.evaluate(() =>
        ["#email", "#password"].map((s) => document.querySelector(s)?.getAttribute("aria-invalid")),
      ),
    };
    ok(
      "PKG P14b 1d AUTH-01 #7: the empty submit shows «Revisa los campos marcados.» and the field errors «Introduce un correo electrónico válido» / «Introduce tu contraseña» (aria-invalid on both)",
      p14bEmpty.alert.includes("Revisa los campos marcados.") &&
        p14bEmpty.email === "Introduce un correo electrónico válido" &&
        p14bEmpty.password === "Introduce tu contraseña" &&
        p14bEmpty.invalid.join() === "true,true",
      JSON.stringify(p14bEmpty),
    );

    // 1e) A wrong password for a seed account and an unknown address: the same answer, the e-mail kept, the
    //     password never echoed (AUTH-01 #11/#16; no enumeration).
    const p14bWrong = {};
    for (const email of ["delta@crewflex.test", "p14b.nobody@example.test"]) {
      await p14bGoEs("/login");
      await p14bSignIn(email, `${PW}-wrong`);
      await page.waitForSelector("main [role=alert]:has-text('no son correctos')", {
        timeout: 20000,
      });
      p14bWrong[email] = {
        alert: await p14bAlerts(),
        email: await page.inputValue("#email"),
        password: await page.inputValue("#password"),
        url: new URL(page.url()).pathname,
      };
    }
    ok(
      "PKG P14b 1e AUTH-01 #11/#16: a wrong password for delta and for an unknown address both answer «El correo o la contraseña no son correctos.», the e-mail stays in the field, the password is cleared and the page stays on /login (no account enumeration)",
      Object.entries(p14bWrong).every(
        ([email, r]) =>
          r.alert.join() === "El correo o la contraseña no son correctos." &&
          r.email === email &&
          r.password === "" &&
          r.url === "/login",
      ),
      JSON.stringify(p14bWrong),
    );

    // 2) The sign-up in Spanish with the flag off (AUTH-02 #2/#3/#5/#6/#9-#11/#17): the open form as it is.
    await p14bGoEs("/register");
    await expectSpanish("PKG P14b 2 «Crear cuenta» in Spanish");
    const p14bRegister = await page.evaluate(() => {
      const text = (el) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
      const main = document.querySelector("main");
      const pw = document.querySelector("#password");
      return {
        h1: text(main.querySelector("h1")),
        lead: text(main.querySelector("h1 + p")),
        legend: text(main.querySelector("fieldset legend")),
        types: [...main.querySelectorAll("input[name=accountType]")].map(
          (i) => `${i.value}:${i.checked}`,
        ),
        typeLabels: [...main.querySelectorAll("fieldset label")].map((l) =>
          [...l.querySelectorAll("span")].map(text).join(" "),
        ),
        labels: [...main.querySelectorAll("label[for]")].map((l) => text(l)),
        hints: [...main.querySelectorAll("p[id$='-hint']")].map(text),
        orgTypes: [...main.querySelectorAll("#organizationType option")].map(text),
        passwordMin: pw?.getAttribute("minlength"),
        passwordMax: pw?.getAttribute("maxlength"),
        passwordAuto: pw?.getAttribute("autocomplete"),
        noValidate: main.querySelector("form")?.hasAttribute("novalidate"),
        invitationCode: !!document.querySelector("#invitationCode, #invite"),
        checkbox: main.querySelectorAll("input[type=checkbox]").length,
        submit: text(main.querySelector("form button[type=submit]")),
        tail: [...main.querySelectorAll(":scope > p")].map(text),
        links: [...main.querySelectorAll("a")].map((a) => `${text(a)}→${a.getAttribute("href")}`),
        title: document.title,
      };
    });
    ok(
      "PKG P14b 2b AUTH-02 #2/#3/#5/#6/#9-#11/#17: «Crear cuenta» / «Tu perfil es privado por defecto. Tú decides qué se ve y cuándo.»; «Me registro como» with «Organización» (MRO, aerolínea, operador; checked) and «Profesional» (Técnico / ingeniero); «Tu nombre», «Correo electrónico», «Contraseña» (minLength 12, maxLength 72, new-password, hint «Al menos 12 caracteres.»), «Nombre de la organización», «Tipo de organización» (MRO · Aerolínea · Operador · Agencia de personal · Otra), «País (código ISO)» with «p. ej. ES»; form noValidate; no invitation code nor conditions checkbox (flag off); button «Crear cuenta»; «¿Ya estás registrado? Inicia sesión» → /login; title «Crear cuenta · CrewFlex»",
      p14bRegister.h1 === "Crear cuenta" &&
        p14bRegister.lead === "Tu perfil es privado por defecto. Tú decides qué se ve y cuándo." &&
        p14bRegister.legend === "Me registro como" &&
        p14bRegister.types.join() === "organization:true,professional:false" &&
        p14bRegister.typeLabels.join(" | ") ===
          "Organización MRO, aerolínea, operador | Profesional Técnico / ingeniero" &&
        p14bRegister.labels.join(" | ") ===
          "Tu nombre | Correo electrónico | Contraseña | Nombre de la organización | Tipo de organización | País (código ISO)" &&
        p14bRegister.hints.join(" | ") === "Al menos 12 caracteres. | p. ej. ES" &&
        p14bRegister.orgTypes.join(" · ") ===
          "MRO · Aerolínea · Operador · Agencia de personal · Otra" &&
        p14bRegister.passwordMin === "12" &&
        p14bRegister.passwordMax === "72" &&
        p14bRegister.passwordAuto === "new-password" &&
        p14bRegister.noValidate === true &&
        !p14bRegister.invitationCode &&
        p14bRegister.checkbox === 0 &&
        p14bRegister.submit === "Crear cuenta" &&
        p14bRegister.tail.join(" | ") ===
          "Tu perfil es privado por defecto. Tú decides qué se ve y cuándo. | ¿Ya estás registrado? Inicia sesión" &&
        p14bRegister.links.join() === "Inicia sesión→/login" &&
        p14bRegister.title === "Crear cuenta · CrewFlex",
      JSON.stringify(p14bRegister),
    );
    await p14bShot("register-after-1440");
    const p14bRegisterWidths = await p14bWidths("register");
    ok(
      "PKG P14b 2c no horizontal overflow at 1024 / 768 / 390 / 360 on /register",
      Object.values(p14bRegisterWidths).every((o) => o === false),
      JSON.stringify(p14bRegisterWidths),
    );

    // 2d) 11 characters: refused by the server action with the catalogue message, the name and e-mail kept, no
    //     «Revisa tu bandeja» (Auth was not called) (AUTH-02 #6).
    await page.check("input[name=accountType][value=professional]");
    await page.fill("#displayName", "P14b Acceso");
    await page.fill("#email", P14B_EMAIL);
    await page.fill("#password", "a".repeat(11));
    await page.click("main form button[type=submit]");
    await page.waitForSelector("main [role=alert]:has-text('Revisa los campos marcados.')", {
      timeout: 20000,
    });
    const p14bShort = {
      alert: await p14bAlerts(),
      password: (await page.locator("#password-error").allInnerTexts()).join(),
      name: await page.inputValue("#displayName"),
      email: await page.inputValue("#email"),
      pw: await page.inputValue("#password"),
      status: await p14bStatus(),
      type: await page.inputValue("input[name=accountType]:checked"),
    };
    ok(
      "PKG P14b 2d AUTH-02 #6: an 11-character password answers «Revisa los campos marcados.» + «Usa al menos 12 caracteres», keeps the name, e-mail and «Profesional», clears the password and shows no «Revisa tu bandeja de entrada»",
      p14bShort.alert.join() === "Revisa los campos marcados." &&
        p14bShort.password === "Usa al menos 12 caracteres" &&
        p14bShort.name === "P14b Acceso" &&
        p14bShort.email === P14B_EMAIL &&
        p14bShort.pw === "" &&
        p14bShort.status.length === 0 &&
        p14bShort.type === "professional",
      JSON.stringify(p14bShort),
    );

    // 3) The throwaway account: sign-up → «Revisa tu bandeja de entrada» (AUTH-02 #12), the login refused before
    //    the confirmation (AUTH-01 #12, AUTH-03 #7), the Mailpit link → «Correo confirmado…» (AUTH-03 #2-#4).
    await page.fill("#password", P14B_PW1);
    await page.click("main form button[type=submit]");
    await page.waitForSelector("main [role=status]:has-text('Revisa tu bandeja de entrada')", {
      timeout: 20000,
    });
    p14bCreated = true;
    const p14bInbox = await p14bStatus();
    await p14bGoEs("/login");
    await p14bSignIn(P14B_EMAIL, P14B_PW1);
    await page.waitForSelector("main [role=alert]", { timeout: 20000 });
    const p14bUnconfirmed = await p14bAlerts();
    const p14bConfirmLink = await p14bMailLink(/auth\/confirm\?next=\/app/);
    let p14bConfirmed = { url: "no e-mail in Mailpit", status: [] };
    if (p14bConfirmLink) {
      await page.goto(p14bConfirmLink);
      await page.waitForURL((u) => u.pathname === "/login", { timeout: 20000 });
      await page.waitForLoadState("networkidle");
      p14bConfirmed = { url: page.url(), status: await p14bStatus() };
      await p14bShot("confirmed-after-1440");
    }
    ok(
      "PKG P14b 3 AUTH-02 #12, AUTH-01 #12, AUTH-03 #2-#4/#7: the sign-up answers «Revisa tu bandeja de entrada» + «Hemos enviado un enlace de confirmación a {email}. Confírmalo y después inicia sesión.»; signing in before confirming is refused with «Confirma tu correo antes de iniciar sesión.»; the e-mail's link (/auth/confirm?next=/app) lands on /login?confirmed=1 with «Correo confirmado. Ya puedes iniciar sesión.» and no session (/app/settings still 307)",
      p14bInbox.join(" ") ===
        `Revisa tu bandeja de entrada Hemos enviado un enlace de confirmación a ${P14B_EMAIL}. Confírmalo y después inicia sesión.` &&
        p14bUnconfirmed.join() === "Confirma tu correo antes de iniciar sesión." &&
        /\/login\?confirmed=1$/.test(p14bConfirmed.url) &&
        p14bConfirmed.status.join() === "Correo confirmado. Ya puedes iniciar sesión." &&
        (await page.locator("main form #email").count()) === 1 &&
        (await page.request.get(`${BASE}/app/settings`, { maxRedirects: 0 })).status() === 307,
      `${JSON.stringify(p14bInbox)} ${JSON.stringify(p14bUnconfirmed)} ${JSON.stringify(p14bConfirmed)}`,
    );

    // 3b) The same link again and two forged ones: each kind lands on its own notice (AUTH-03 #5, AUTH-04 #9/#10,
    //     AUTH-06 #11): a sign-up link never reaches the reset form, a recovery one never the login banner.
    const p14bBad = {};
    for (const [name, url] of [
      ["reused", p14bConfirmLink],
      ["forged-signup", `${BASE}/auth/confirm?token_hash=x&type=signup&next=/app`],
      ["forged-recovery", `${BASE}/auth/confirm?token_hash=x&type=recovery&next=/reset-password`],
      ["empty", `${BASE}/auth/confirm`],
      // Reported, not endorsed (P14b-S5): a forged PKCE code is never exchanged in the sign-up branch and only
      // shows the «Correo confirmado…» banner; the assertion is that no session exists afterwards.
      ["forged-code", `${BASE}/auth/confirm?code=p14b-forged&next=/app`],
    ]) {
      if (!url) continue;
      await page.goto(url);
      await page.waitForURL((u) => u.pathname === "/login" || u.pathname === "/forgot-password", {
        timeout: 20000,
      });
      await page.waitForLoadState("networkidle");
      p14bBad[name] = {
        url: `${new URL(page.url()).pathname}${new URL(page.url()).search}`,
        alert: await p14bAlerts(),
        status: await p14bStatus(),
        session: (await page.request.get(`${BASE}/app/settings`, { maxRedirects: 0 })).status(),
      };
    }
    await page.goto(`${BASE}/reset-password`);
    await page.waitForLoadState("networkidle");
    const p14bNoSession = {
      h1: (await page.locator("main h1").allInnerTexts()).join(),
      alert: await p14bAlerts(),
      inputs: await page.locator("main input").count(),
      link: await page.locator("main a[href='/forgot-password']").allInnerTexts(),
    };
    ok(
      "PKG P14b 3b AUTH-03 #5, AUTH-04 #9/#10, AUTH-06 #11: the reused confirmation link, a forged sign-up token and an empty /auth/confirm land on /login?confirmError=1 with «Enlace caducado, utilizado o no válido. Inicia sesión; si tu correo no está confirmado, regístrate de nuevo para recibir otro enlace.»; a forged recovery token lands on /forgot-password?expired=1 with «Ese enlace ha caducado o ya se ha usado. Solicita uno nuevo.»; a forged ?code= (reported, P14b-S5) lands on /login?confirmed=1 showing «Correo confirmado…» without opening a session (/app/settings 307); /reset-password without a recovery session shows «Elige una contraseña nueva» + «Esta página necesita un enlace de restablecimiento válido.» and «Solicitar un enlace nuevo», no fields",
      ["reused", "forged-signup", "empty"].every(
        (k) =>
          p14bBad[k]?.url === "/login?confirmError=1" &&
          p14bBad[k].alert.join() ===
            "Enlace caducado, utilizado o no válido. Inicia sesión; si tu correo no está confirmado, regístrate de nuevo para recibir otro enlace.",
      ) &&
        p14bBad["forged-recovery"]?.url === "/forgot-password?expired=1" &&
        p14bBad["forged-recovery"].alert.join() ===
          "Ese enlace ha caducado o ya se ha usado. Solicita uno nuevo." &&
        p14bBad["forged-code"]?.url === "/login?confirmed=1" &&
        p14bBad["forged-code"].status.join() === "Correo confirmado. Ya puedes iniciar sesión." &&
        p14bBad["forged-code"].session === 307 &&
        p14bNoSession.h1 === "Elige una contraseña nueva" &&
        p14bNoSession.alert.join() ===
          "Esta página necesita un enlace de restablecimiento válido. Solicitar un enlace nuevo" &&
        p14bNoSession.inputs === 0 &&
        p14bNoSession.link.join() === "Solicitar un enlace nuevo",
      `${JSON.stringify(p14bBad)} ${JSON.stringify(p14bNoSession)}`,
    );

    // 4) Recovery in Spanish (AUTH-04 #1-#5): the request page, the uniform answer for an unknown and for the
    //    throwaway address.
    await p14bGoEs("/forgot-password");
    await expectSpanish("PKG P14b 4 «Restablece tu contraseña» in Spanish");
    const p14bForgot = await page.evaluate(() => {
      const text = (el) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
      const main = document.querySelector("main");
      return {
        h1: text(main.querySelector("h1")),
        lead: text(main.querySelector("h1 + p")),
        label: text(main.querySelector("label[for=email]")),
        submit: text(main.querySelector("form button[type=submit]")),
        links: [...main.querySelectorAll("a")].map((a) => `${text(a)}→${a.getAttribute("href")}`),
        title: document.title,
      };
    });
    await p14bShot("forgot-after-1440");
    const p14bForgotWidths = await p14bWidths("forgot");
    const p14bSent = {};
    for (const email of ["p14b.nobody@example.test", P14B_EMAIL]) {
      await p14bGoEs("/forgot-password");
      await page.fill("#email", email);
      await page.click("main form button[type=submit]");
      await page.waitForSelector("main [role=status]:has-text('Revisa tu correo')", {
        timeout: 20000,
      });
      p14bSent[email] = (await p14bStatus()).join(" ").replace(email, "{email}");
    }
    ok(
      "PKG P14b 4b AUTH-04 #1-#5, SH-05 #11: «Restablece tu contraseña» / «Indica el correo de tu cuenta. Si existe, te enviaremos un enlace para elegir una contraseña nueva.», «Correo electrónico», button «Enviar enlace», «Volver a iniciar sesión» → /login, title «Restablecer contraseña · CrewFlex»; no overflow at 1024 / 768 / 390 / 360; an unknown address and the throwaway one get the same «Revisa tu correo» + «Si existe una cuenta con {email}, recibirás un enlace para elegir una contraseña nueva. Caduca en una hora.»",
      p14bForgot.h1 === "Restablece tu contraseña" &&
        p14bForgot.lead ===
          "Indica el correo de tu cuenta. Si existe, te enviaremos un enlace para elegir una contraseña nueva." &&
        p14bForgot.label === "Correo electrónico" &&
        p14bForgot.submit === "Enviar enlace" &&
        p14bForgot.links.join() === "Volver a iniciar sesión→/login" &&
        p14bForgot.title === "Restablecer contraseña · CrewFlex" &&
        Object.values(p14bForgotWidths).every((o) => o === false) &&
        new Set(Object.values(p14bSent)).size === 1 &&
        Object.values(p14bSent)[0] ===
          "Revisa tu correo Si existe una cuenta con {email}, recibirás un enlace para elegir una contraseña nueva. Caduca en una hora.",
      `${JSON.stringify(p14bForgot)} ${JSON.stringify(p14bForgotWidths)} ${JSON.stringify(p14bSent)}`,
    );

    // 5) A second browser signs the throwaway in (it will lose its session at the reset, AUTH-04 #16).
    p14bCtxB = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p14bPageB = await p14bCtxB.newPage();
    await p14bPageB.goto(`${BASE}/login`);
    await p14bPageB.fill("#email", P14B_EMAIL);
    await p14bPageB.fill("#password", P14B_PW1);
    await p14bPageB.click("main form button[type=submit]");
    await p14bPageB.waitForURL((u) => u.pathname.startsWith("/app/"), { timeout: 30000 });
    const p14bBefore = new URL(p14bPageB.url()).pathname;

    // 5b) The recovery link opens the reset form in the browser that asked (AUTH-04 #8/#11-#14): mismatch, the
    //     same password (AUTH-04 #15), then the new one → /login?reset=1 (AUTH-04 #16/#17, AUTH-01 #17).
    const p14bResetLink = await p14bMailLink(/next=\/reset-password/);
    let p14bResetForm = null;
    let p14bResetWidths = {};
    let p14bMismatch = [];
    let p14bSame = [];
    let p14bAfterReset = null;
    if (p14bResetLink) {
      await page.goto(p14bResetLink);
      await page.waitForURL((u) => u.pathname === "/reset-password", { timeout: 20000 });
      await page.waitForLoadState("networkidle");
      p14bResetForm = await page.evaluate(() => {
        const text = (el) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
        const main = document.querySelector("main");
        const pw = document.querySelector("#password");
        const confirm = document.querySelector("#confirm");
        return {
          h1: text(main.querySelector("h1")),
          lead: text(main.querySelector("h1 + p")),
          labels: [...main.querySelectorAll("label[for]")].map(text),
          hints: [...main.querySelectorAll("p[id$='-hint']")].map(text),
          min: [pw?.getAttribute("minlength"), confirm?.getAttribute("minlength")],
          max: [pw?.getAttribute("maxlength"), confirm?.getAttribute("maxlength")],
          auto: [pw?.getAttribute("autocomplete"), confirm?.getAttribute("autocomplete")],
          submit: text(main.querySelector("form button[type=submit]")),
          lang: document.documentElement.lang,
        };
      });
      await p14bShot("reset-after-1440");
      p14bResetWidths = await p14bWidths("reset");
      await page.fill("#password", P14B_PW2);
      await page.fill("#confirm", `${P14B_PW2}x`);
      await page.click("main form button[type=submit]");
      await page.waitForSelector("#confirm-error", { timeout: 20000 });
      p14bMismatch = [
        ...(await p14bAlerts()),
        ...(await page.locator("#confirm-error").allInnerTexts()),
      ];
      await page.fill("#password", P14B_PW1);
      await page.fill("#confirm", P14B_PW1);
      await page.click("main form button[type=submit]");
      await page.waitForSelector("main [role=alert]:has-text('distinta de la actual')", {
        timeout: 20000,
      });
      p14bSame = await p14bAlerts();
      await page.fill("#password", P14B_PW2);
      await page.fill("#confirm", P14B_PW2);
      await page.click("main form button[type=submit]");
      await page.waitForURL((u) => u.pathname === "/login", { timeout: 30000 });
      await page.waitForLoadState("networkidle");
      p14bPassword = P14B_PW2;
      p14bAfterReset = { url: page.url(), status: await p14bStatus() };
    }
    // The second browser after the reset: Auth revoked its refresh token (`signOut({ scope: "global" })`);
    // its access token is a stateless JWT that stays valid until `jwt_expiry` (600 s locally since P14b-S1; was 1 h) — measured, not hidden:
    // the page answer is reported in the detail, the assertion is the provider's refusal to refresh.
    const p14bB = await p14bPageB.request.get(`${BASE}/app/settings`, { maxRedirects: 0 });
    const p14bBAfter = `${p14bB.status()} ${p14bB.headers().location ?? ""}`;
    const p14bBChunks = (await p14bCtxB.cookies())
      .filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => c.value)
      .join("");
    const p14bBSession = (() => {
      try {
        return JSON.parse(
          p14bBChunks.startsWith("base64-")
            ? Buffer.from(p14bBChunks.slice(7), "base64url").toString("utf8")
            : decodeURIComponent(p14bBChunks),
        );
      } catch {
        return null;
      }
    })();
    const p14bBRefresh = p14bBSession?.refresh_token
      ? await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
          method: "POST",
          headers: { apikey: publishableKey, "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: p14bBSession.refresh_token }),
        }).then(async (r) => {
          // Status and error code only: the body is never printed (security review).
          const body = await r.json().catch(() => ({}));
          return { status: r.status, error_code: body.error_code ?? null };
        })
      : { status: "no session cookie", error_code: null };
    await p14bCtxB.close();
    p14bCtxB = null;
    ok(
      "PKG P14b 5 AUTH-04 #8/#11-#17, AUTH-01 #17: the recovery e-mail's link (/auth/confirm?next=/reset-password) opens «Elige una contraseña nueva» / «Al guardarla se cerrarán todas tus sesiones, también esta.» with «Contraseña nueva» (minLength 12, hint «Al menos 12 caracteres.») and «Repite la contraseña nueva» (both maxLength 72, new-password), button «Guardar contraseña», no overflow at the four widths; a mismatch → «Revisa los campos marcados.» + «Las contraseñas no coinciden.»; the current password → «Elige una contraseña distinta de la actual.»; the new one → /login?reset=1 «Contraseña cambiada. Se han cerrado todas las sesiones: entra con tu nueva contraseña.»; the second browser (signed in on /app/professional) can no longer refresh its session (Auth answers 400 refresh_token_not_found to its refresh token) — its still-valid JWT is reported in the detail, not asserted (jwt_expiry 600 s locally)",
      p14bResetForm?.h1 === "Elige una contraseña nueva" &&
        p14bResetForm.lead === "Al guardarla se cerrarán todas tus sesiones, también esta." &&
        p14bResetForm.labels.join(" | ") === "Contraseña nueva | Repite la contraseña nueva" &&
        p14bResetForm.hints.join() === "Al menos 12 caracteres." &&
        p14bResetForm.min.join() === "12," &&
        p14bResetForm.max.join() === "72,72" &&
        p14bResetForm.auto.join() === "new-password,new-password" &&
        p14bResetForm.submit === "Guardar contraseña" &&
        p14bResetForm.lang === "es" &&
        Object.values(p14bResetWidths).every((o) => o === false) &&
        p14bMismatch.join(" | ") ===
          "Revisa los campos marcados. | Las contraseñas no coinciden." &&
        p14bSame.join() === "Elige una contraseña distinta de la actual." &&
        /\/login\?reset=1$/.test(p14bAfterReset?.url ?? "") &&
        p14bAfterReset.status.join() ===
          "Contraseña cambiada. Se han cerrado todas las sesiones: entra con tu nueva contraseña." &&
        p14bBefore === "/app/professional" &&
        p14bBRefresh.status === 400 &&
        p14bBRefresh.error_code === "refresh_token_not_found",
      `${JSON.stringify(p14bResetForm)} ${JSON.stringify(p14bResetWidths)} ${JSON.stringify(p14bMismatch)} ${JSON.stringify(p14bSame)} ${JSON.stringify(p14bAfterReset)} B:${p14bBefore} → page ${p14bBAfter} · refresh ${JSON.stringify(p14bBRefresh)}`,
    );

    // 6) The old password is refused; the new one honours `next` (SH-07 #6, AUTH-01 #15) → «Configuración» in
    //    Spanish (ACC-01 #1/#2/#4/#5, ACC-02 #3), cookies readable from JS (AUTH-06 #9).
    await p14bGoEs("/login?next=%2Fapp%2Fsettings");
    await p14bSignIn(P14B_EMAIL, P14B_PW1);
    await page.waitForSelector("main [role=alert]:has-text('no son correctos')", {
      timeout: 20000,
    });
    const p14bOld = await p14bAlerts();
    await p14bSignIn(P14B_EMAIL, P14B_PW2);
    await page.waitForURL((u) => u.pathname === "/app/settings", { timeout: 30000 });
    await page.waitForLoadState("networkidle");
    await expectSpanish("PKG P14b 6 «Configuración» in Spanish");
    const p14bSettings = await page.evaluate(() => {
      const text = (el) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
      const main = document.querySelector("main");
      const panels = [...main.querySelectorAll("section, article")]
        .map((s) => text(s.querySelector("h2")))
        .filter(Boolean);
      return {
        h1: text(main.querySelector("h1")),
        lead: text(main.querySelector("h1 + p")),
        panels,
        facts: [...main.querySelectorAll("dl > div")].map(
          (d) => `${text(d.querySelector("dt"))}=${text(d.querySelector("dd"))}`,
        ),
        radios: [...main.querySelectorAll("[role=radio]")].map(
          (r) =>
            `${[...r.querySelectorAll("span")].map(text).join(" ")}:${r.getAttribute("aria-checked")}`,
        ),
        cookies: document.cookie
          .split(";")
          .map((c) => c.trim().split("=")[0])
          .filter(Boolean),
        crumb: [...document.querySelectorAll("header nav ol > li")].map(text).join(" "),
        menu: [...document.querySelectorAll("aside nav[aria-label='Cuenta'] a")].map((a) =>
          text(a)
            .replace(/\d+.*$/, "")
            .trim(),
        ),
      };
    });
    ok(
      "PKG P14b 6b ACC-01 #1/#2/#4/#5, ACC-02 #3, AUTH-06 #9, SH-07 #6: the old password is refused («El correo o la contraseña no son correctos.»), the new one lands on the `next` page /app/settings: «Configuración» / «Tu cuenta y cómo ves CrewFlex. …», header «CrewFlex / Configuración», «Configuración» under the «Cuenta» menu; panels «Idioma / Language» (radios «Español ES» checked · «English EN»), «Avisos de oportunidades», «Cuenta» (Nombre=P14b Acceso · Correo electrónico=<the address> · Tipo de cuenta=Profesional; no «Organización», «Rol» nor «Rol de plataforma») and «Tus datos»; the Supabase session cookies and crewflex-locale are readable from document.cookie",
      p14bOld.join() === "El correo o la contraseña no son correctos." &&
        p14bSettings.h1 === "Configuración" &&
        /^Tu cuenta y cómo ves CrewFlex\./.test(p14bSettings.lead) &&
        p14bSettings.crumb === "CrewFlex / Configuración" &&
        p14bSettings.menu.includes("Configuración") &&
        p14bSettings.panels.join(" | ") ===
          "Idioma / Language | Avisos de oportunidades | Cuenta | Tus datos" &&
        p14bSettings.facts.join(" | ") ===
          `Nombre=P14b Acceso | Correo electrónico=${P14B_EMAIL} | Tipo de cuenta=Profesional` &&
        p14bSettings.radios.join(" · ") === "Español es:true · English en:false" &&
        p14bSettings.cookies.some((c) => /^sb-.*-auth-token/.test(c)) &&
        p14bSettings.cookies.includes("crewflex-locale"),
      `${JSON.stringify(p14bOld)} ${JSON.stringify(p14bSettings)}`,
    );
    await p14bShot("settings-after-1440");
    const p14bSettingsWidths = await p14bWidths("settings");
    ok(
      "PKG P14b 6c no horizontal overflow at 1024 / 768 / 390 / 360 on «Configuración»",
      Object.values(p14bSettingsWidths).every((o) => o === false),
      JSON.stringify(p14bSettingsWidths),
    );

    // 6d) The language follows the account (ACC-02 #4/#5): EN → «Language updated.», persisted on the profile
    //     (survives a cleared cookie), then back to ES → «Idioma actualizado.».
    await page.locator("main [role=radio][lang=en]").click();
    await page.waitForSelector("main [role=status]:has-text('Language updated.')", {
      timeout: 15000,
    });
    await ctx.clearCookies({ name: "crewflex-locale" });
    await page.reload();
    await page.waitForLoadState("networkidle");
    const p14bEnglish = {
      lang: await page.evaluate(() => document.documentElement.lang),
      h1: (await page.locator("main h1").allInnerTexts()).join(),
      cookie: (await ctx.cookies()).find((c) => c.name === "crewflex-locale")?.value ?? null,
    };
    await page.locator("main [role=radio][lang=es]").click();
    await page.waitForSelector("main [role=status]:has-text('Idioma actualizado.')", {
      timeout: 15000,
    });
    const p14bEsCookie =
      (await ctx.cookies()).find((c) => c.name === "crewflex-locale")?.value ?? null;
    ok(
      "PKG P14b 6d ACC-02 #4/#5: «English» → «Language updated.» in the new language; with the locale cookie cleared the reload is still English («Settings») because the preference lives on the profile (no cookie needed); «Español» → «Idioma actualizado.» and the cookie is written again as es",
      p14bEnglish.lang === "en" &&
        p14bEnglish.h1 === "Settings" &&
        p14bEnglish.cookie === null &&
        p14bEsCookie === "es",
      `${JSON.stringify(p14bEnglish)} → cookie ${p14bEsCookie}`,
    );

    // 7) «Cerrar sesión» from the sidebar → «Sesión cerrada.» and the guard is back (AUTH-05 #8/#9).
    await page
      .locator("aside form:has(button:has-text('Cerrar sesión'))")
      .last()
      .evaluate((f) => f.requestSubmit());
    await page.waitForURL((u) => u.pathname === "/login", { timeout: 20000 });
    await page.waitForLoadState("networkidle");
    const p14bSignedOut = { url: page.url(), status: await p14bStatus() };
    const p14bGuard = await page.request.get(`${BASE}/app/settings`, { maxRedirects: 0 });
    ok(
      "PKG P14b 7 AUTH-05 #8/#9: «Cerrar sesión» ends on /login?signedOut=1 with «Sesión cerrada.» (role=status) and /app/settings answers 307 to the login again (the session cookies are gone)",
      /\/login\?signedOut=1$/.test(p14bSignedOut.url) &&
        p14bSignedOut.status.join() === "Sesión cerrada." &&
        p14bGuard.status() === 307 &&
        /\/login\?next=%2Fapp%2Fsettings$/.test(p14bGuard.headers().location ?? ""),
      `${JSON.stringify(p14bSignedOut)} ${p14bGuard.status()} ${p14bGuard.headers().location}`,
    );

    // 8) An external `next` is ignored (SH-07 #6); «Cerrar cuenta» (ACC-01 #9-#11): the v1.8 texts, a wrong word
    //    refused, then «Cuenta cerrada.».
    await p14bGoEs("/login?next=//evil.example/x");
    await p14bSignIn(P14B_EMAIL, P14B_PW2);
    await page.waitForURL((u) => u.pathname.startsWith("/app/"), { timeout: 30000 });
    const p14bLanding = `${new URL(page.url()).host}${new URL(page.url()).pathname}`;
    await page.goto(`${BASE}/app/settings`);
    await page.waitForLoadState("networkidle");
    await page.locator("main summary", { hasText: "Cerrar cuenta" }).click();
    const p14bClose = await page.evaluate(() => {
      const text = (el) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
      const details = document.querySelector("main details");
      return {
        open: details?.open,
        summary: text(details?.querySelector("summary")),
        paragraphs: [...(details?.querySelectorAll("form p") ?? [])].map(text),
        label: text(details?.querySelector("label[for=confirm]")),
        submit: text(details?.querySelector("form button[type=submit]")),
        exportLink: text(document.querySelector("main a[href='/app/settings/export']")),
      };
    });
    await page.fill("#confirm", "CLOSE");
    await page.click("main details form button[type=submit]");
    await page.waitForSelector("#confirm-error", { timeout: 20000 });
    const p14bWrongWord = (await page.locator("#confirm-error").allInnerTexts()).join();
    const p14bStillIn = (
      await page.request.get(`${BASE}/app/settings`, { maxRedirects: 0 })
    ).status();
    await page.fill("#confirm", "CERRAR");
    await page.click("main details form button[type=submit]");
    await page.waitForURL((u) => u.pathname === "/login", { timeout: 30000 });
    await page.waitForLoadState("networkidle");
    const p14bClosedNotice = await p14bStatus();
    p14bClosed = /closed=1/.test(page.url());
    ok(
      "PKG P14b 8 SH-07 #6, ACC-01 #7/#9-#11: signing in from /login?next=//evil.example/x lands on this host's /app/professional; «Tus datos» offers «Exportar mis datos y archivos» and the closed disclosure «Cerrar cuenta» opens with the v1.8 text «Elimina credenciales, perfil y archivos. Los registros de compromisos y auditoría se conservan sin el perfil para resolver el historial operativo.», «Escribe CERRAR» and «Cerrar mi cuenta»; «CLOSE» is refused with «Escribe CERRAR para confirmar.» and the session stays (200); «CERRAR» → /login?closed=1 «Cuenta cerrada.»",
      p14bLanding === `${new URL(BASE).host}/app/professional` &&
        p14bClose.open === true &&
        p14bClose.summary === "Cerrar cuenta" &&
        p14bClose.paragraphs[0] ===
          "Elimina credenciales, perfil y archivos. Los registros de compromisos y auditoría se conservan sin el perfil para resolver el historial operativo." &&
        p14bClose.label === "Escribe CERRAR" &&
        p14bClose.submit === "Cerrar mi cuenta" &&
        p14bClose.exportLink === "Exportar mis datos y archivos" &&
        p14bWrongWord === "Escribe CERRAR para confirmar." &&
        p14bStillIn === 200 &&
        p14bClosed &&
        p14bClosedNotice.join() === "Cuenta cerrada.",
      `${p14bLanding} ${JSON.stringify(p14bClose)} «${p14bWrongWord}» ${p14bStillIn} ${page.url()} ${JSON.stringify(p14bClosedNotice)}`,
    );
  } finally {
    await page.setViewportSize({ width: 1440, height: 900 });
    if (p14bCtxB) await p14bCtxB.close().catch(() => {});
    if (/\/app/.test(page.url())) await logout().catch(() => {});
    // The throwaway account must not survive this run: if the UI closure did not happen, close it through the
    // local API with its own password (never a seed account).
    let p14bGone = p14bClosed || !p14bCreated;
    if (!p14bGone) {
      const auth = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: publishableKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email: P14B_EMAIL, password: p14bPassword }),
      })
        .then((r) => r.json())
        .catch(() => ({}));
      if (auth.access_token) {
        const closed = await fetch(new URL("/functions/v1/account", supabaseUrl), {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${auth.access_token}`,
            apikey: publishableKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ confirm: "CERRAR" }),
        })
          .then((r) => r.json())
          .catch(() => ({}));
        p14bGone = closed.ok === true;
      }
    }
    await ctx.clearCookies({ name: "crewflex-locale" });
    ok(
      "PKG P14b 9 restore: the throwaway account is closed (UI or API), no seed account was written, locale cookie cleared",
      p14bGone,
      `${P14B_EMAIL} created=${p14bCreated} closedByUi=${p14bClosed}`,
    );
  }
}

// PKG P14c (visual system and meta parity, F3 — VIS-01 #2/#3/#5/#6/#7/#8/#9/#12, VIS-02 #1/#2/#3/#6/#17, VIS-03 #1/#2/#4/#5/#9,
// VIS-04 #1/#2/#3, VIS-05 #4/#5/#6, VIS-06 #2/#3/#4/#5/#11/#14, VIS-07 #1/#22, VIS-08 #1/#2/#3/#4/#5, VIS-09 #1/#3/#4/#6,
// META-01 #1-#5, META-02 #1-#3, META-03 #1-#5; re-verification of shell-visual T-140…T-148 `44045db`, W3-01/W3-02/W3-06,
// X-20 and the product name fix of this package; no other code): in Spanish, the document and the shell MEASURE the
// design tokens — `@theme` custom properties on :root and the computed colours, sizes, radii, fonts and spacing of the
// sidebar, the active entry, the brand mark, the header, the footer, panels, chips, the primary button, a field and the
// focus ring equal the token values of `globals.css`; Inter is the font actually loaded (v1.8 never loaded it); every
// menu page is titled «{entrada} · CrewFlex» with `lang=es`; the favicon is the navy square with the orange plane and
// there is no manifest, theme-color, apple icon or service worker (NEW-01 / AB-37 open); the shell switches at `lg`
// (sidebar + white header at 1024, navy bar + «Menú» + five-shortcut dock at 1000/390) without horizontal overflow at
// 1024/768/390/360; reduced motion leaves zero running animations; print has no stylesheet of its own and there is no
// dark scheme (both documented). Negatives: no colour measured on the shell is outside the token set, no font or asset
// comes from another origin, no service worker is registered. Nothing is written except Delta's language, restored
// in `finally` (API + cookie); media emulation and the viewport are restored too.
{
  const DELTA = "delta@crewflex.test";
  const p14cShot = (name) =>
    page.screenshot({
      path: `docs/audit/evidence/parity/P14c/P14c-${name}.jpg`,
      type: "jpeg",
      quality: 70,
      fullPage: false,
    });
  /** `#rrggbb` → the `rgb(r, g, b)` string `getComputedStyle` returns. */
  const p14cRgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
  };
  // The token values of `src/app/globals.css` (DESIGN_SYSTEM.md «Tokens»); the smoke reads the same ones from :root.
  const P14C_TOKENS = {
    navy: "#0c2137",
    "navy-700": "#203b54",
    ink: "#172c44",
    muted: "#5b6f84",
    line: "#dce4ed",
    canvas: "#f5f7fa",
    accent: "#ff982f",
    "accent-hover": "#ffa747",
    blue: "#18558f",
    ok: "#16745d",
    "ok-bg": "#e7f5ee",
    warn: "#aa5916",
    danger: "#ad3b44",
    tool: "#057f7d",
    "tool-hero": "#112e40",
  };
  const p14cOverflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
  /** The measurable visual facts of the signed-in shell on the current page. */
  const p14cShell = () =>
    page.evaluate((hexes) => {
      const cs = (el) => (el ? getComputedStyle(el) : null);
      const pick = (el, props) => {
        const s = cs(el);
        if (!s) return null;
        const out = {};
        for (const p of props) out[p] = s[p];
        return out;
      };
      const rect = (el) => {
        const r = el?.getBoundingClientRect();
        return r ? { w: Math.round(r.width), h: Math.round(r.height) } : null;
      };
      const visible = (el) => !!el && el.getClientRects().length > 0;
      const root = getComputedStyle(document.documentElement);
      const tokens = Object.fromEntries(
        Object.keys(hexes).map((k) => [k, root.getPropertyValue(`--color-${k}`).trim()]),
      );
      const aside = document.querySelector("aside");
      const active = aside?.querySelector("nav[aria-label] a[aria-current='page']");
      const inactive = aside?.querySelector("nav[aria-label] a:not([aria-current])");
      const mark = aside?.querySelector("a[href='/app'] span[aria-hidden]");
      const sectionLabel = [...(aside?.querySelectorAll("p.uppercase") ?? [])].find(visible);
      const header = document.querySelector("header");
      const crumb = header?.querySelector("nav ol");
      const footer = document.querySelector("footer");
      const h1 = document.querySelector("main h1");
      const panel = document.querySelector("main section.rounded-xl.border-line");
      const dock = document.querySelector(
        "nav[aria-label='Accesos rápidos'], nav[aria-label='Quick access']",
      );
      const dockLinks = dock ? [...dock.querySelectorAll("a")] : [];
      const dockCurrent = dockLinks.find((a) => a.getAttribute("aria-current") === "page");
      const menuButton = aside?.querySelector("button[aria-expanded]");
      // Every colour painted on the shell's surfaces and text (sidebar, entries, header, footer, dock).
      const palette = [
        cs(document.documentElement)?.backgroundColor,
        cs(document.documentElement)?.color,
        cs(aside)?.backgroundColor,
        cs(active)?.backgroundColor,
        cs(active)?.color,
        cs(active?.querySelector("svg"))?.color,
        cs(mark)?.backgroundColor,
        cs(mark)?.color,
        visible(header) ? cs(header)?.backgroundColor : null,
        visible(header) ? cs(header)?.borderBottomColor : null,
        visible(header) ? cs(crumb)?.color : null,
        cs(footer)?.color,
        cs(footer)?.borderTopColor,
        cs(panel)?.backgroundColor,
        cs(panel)?.borderColor,
        visible(dock) ? cs(dock)?.borderTopColor : null,
        visible(dock) ? cs(dockLinks[0])?.color : null,
        visible(dock) ? cs(dockCurrent)?.backgroundColor : null,
        visible(dock) ? cs(dockCurrent)?.color : null,
      ].filter(Boolean);
      return {
        tokens,
        lang: document.documentElement.lang,
        title: document.title,
        html: pick(document.documentElement, ["backgroundColor", "color"]),
        body: pick(document.body, ["fontFamily", "fontSize", "lineHeight"]),
        fontsLoaded: [...document.fonts]
          .filter((f) => f.status === "loaded")
          .map((f) => f.family.replace(/"/g, "")),
        aside: { ...pick(aside, ["backgroundColor", "color", "position"]), ...rect(aside) },
        active: {
          ...pick(active, ["backgroundColor", "color", "borderRadius", "fontSize"]),
          icon: {
            ...pick(active?.querySelector("svg"), ["color", "strokeWidth"]),
            ...rect(active?.querySelector("svg")),
          },
        },
        inactive: pick(inactive, ["color"]),
        mark: {
          ...pick(mark, ["backgroundColor", "color", "borderRadius"]),
          ...rect(mark),
          svg: rect(mark?.querySelector("svg")),
        },
        sectionLabel: pick(sectionLabel, ["fontSize", "letterSpacing", "color", "textTransform"]),
        header: visible(header)
          ? {
              ...pick(header, ["backgroundColor", "borderBottomColor"]),
              ...rect(header),
              crumb: pick(crumb, ["fontSize", "color"]),
            }
          : null,
        footer: {
          ...pick(footer, ["fontSize", "color", "letterSpacing", "borderTopColor"]),
          visible: visible(footer),
        },
        h1: pick(h1, ["fontSize", "fontWeight", "letterSpacing"]),
        panel: pick(panel, ["backgroundColor", "borderColor", "borderRadius"]),
        menuButton: visible(menuButton),
        dock: visible(dock)
          ? {
              ...pick(dock, ["position", "bottom"]),
              ...rect(dock),
              links: dockLinks.length,
              // A shortcut that is not the current one: the muted label (the current one is ok on ok-bg).
              label: pick(dockLinks.find((a) => a !== dockCurrent) ?? dockLinks[0], [
                "fontSize",
                "color",
              ]),
              icon: rect(dockLinks[0]?.querySelector("svg")),
              current: dockCurrent
                ? {
                    text: dockCurrent.textContent.trim(),
                    ...pick(dockCurrent, ["backgroundColor", "color", "fontWeight"]),
                  }
                : null,
              minTarget: Math.min(...dockLinks.map((a) => a.getBoundingClientRect().height)),
            }
          : null,
        palette: [...new Set(palette)],
      };
    }, P14C_TOKENS);
  const p14cTokenRgb = Object.fromEntries(
    Object.entries(P14C_TOKENS).map(([k, v]) => [k, p14cRgb(v)]),
  );
  const p14cAllowed = new Set([
    ...Object.values(p14cTokenRgb),
    "rgb(255, 255, 255)",
    "rgba(255, 255, 255, 0.95)", // dock surface (`bg-white/95`)
    p14cRgb("#c4d3e1"), // sidebar text (v1.8 `.sidebar` color #c4d3e1)
    p14cRgb("#91aac1"), // sidebar section titles and «AVIATION» (v1.8 `.sidebar-label`-like)
  ]);
  try {
    // 0) The anonymous document in Spanish (META-01 #1-#4, META-02 #1, META-03 #1-#4, VIS-08 #4/#5, VIS-09 #1/#6):
    //    lang, charset, viewport, description, title, favicon, no manifest / theme-color / apple icon / service worker;
    //    the primary button and a field measured on /login; assets only from this origin.
    const p14cAnonCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await p14cAnonCtx.addCookies([{ name: "crewflex-locale", value: "es", url: BASE }]);
    const p14cAnon = await p14cAnonCtx.newPage();
    await p14cAnon.goto(`${BASE}/login`);
    await p14cAnon.waitForLoadState("networkidle");
    const p14cDoc = await p14cAnon.evaluate(async () => {
      await document.fonts.ready;
      const meta = (n) =>
        document.querySelector(`meta[name='${n}']`)?.getAttribute("content") ?? null;
      const pick = (el, props) => {
        const s = el ? getComputedStyle(el) : null;
        return s ? Object.fromEntries(props.map((p) => [p, s[p]])) : null;
      };
      const button = document.querySelector("form button[type=submit]");
      const field = document.querySelector("#email");
      const sw =
        "serviceWorker" in navigator
          ? (await navigator.serviceWorker.getRegistrations()).length
          : -1;
      return {
        lang: document.documentElement.lang,
        title: document.title,
        charset: document.characterSet,
        viewport: meta("viewport"),
        description: meta("description"),
        themeColor: meta("theme-color"),
        icons: [...document.querySelectorAll("link[rel~='icon']")].map((l) => ({
          href: l.getAttribute("href"),
          type: l.getAttribute("type"),
          rel: l.getAttribute("rel"),
        })),
        manifest: document.querySelectorAll("link[rel='manifest']").length,
        appleIcon: document.querySelectorAll("link[rel='apple-touch-icon']").length,
        sw,
        bodyFont: getComputedStyle(document.body).fontFamily,
        fontsLoaded: [...document.fonts]
          .filter((f) => f.status === "loaded")
          .map((f) => f.family.replace(/"/g, "")),
        foreign: [
          ...new Set(
            performance
              .getEntriesByType("resource")
              .map((r) => new URL(r.name).origin)
              .filter((o) => o !== location.origin),
          ),
        ],
        button: {
          ...pick(button, [
            "backgroundColor",
            "color",
            "borderRadius",
            "minHeight",
            "fontSize",
            "fontWeight",
          ]),
          h: Math.round(button?.getBoundingClientRect().height ?? 0),
        },
        field: pick(field, [
          "borderColor",
          "borderRadius",
          "minHeight",
          "fontSize",
          "backgroundColor",
        ]),
      };
    });
    const p14cAssets = {};
    for (const path of [
      "/icon.svg",
      "/sw.js",
      "/manifest.webmanifest",
      "/favicon.ico",
      "/apple-icon.png",
    ]) {
      const r = await p14cAnon.request.get(`${BASE}${path}`, { maxRedirects: 0 });
      p14cAssets[path] = {
        status: r.status(),
        type: r.headers()["content-type"] ?? "",
        body: path === "/icon.svg" ? await r.text() : "",
      };
    }
    await p14cAnonCtx.close();
    ok(
      "PKG P14c 0 META-01 #1-#4, META-02 #1, META-03 #1-#4, VIS-08 #4/#5: /login (es) renders <html lang=es>, UTF-8, viewport «width=device-width, initial-scale=1, viewport-fit=cover», the Spanish description, title «Iniciar sesión · CrewFlex», one `rel=icon` → /icon.svg (image/svg+xml) that answers 200 as the navy square (#0c2137) with the orange plane (#ff982f, the sidebar's path); no manifest, theme-color or apple-touch-icon; /sw.js, /manifest.webmanifest, /favicon.ico and /apple-icon.png answer 404 and no service worker is registered",
      p14cDoc.lang === "es" &&
        p14cDoc.charset === "UTF-8" &&
        p14cDoc.viewport === "width=device-width, initial-scale=1, viewport-fit=cover" &&
        p14cDoc.description ===
          "Convierte cualificaciones, disponibilidad y demanda operativa en capacidad técnica movilizable." &&
        p14cDoc.title === "Iniciar sesión · CrewFlex" &&
        p14cDoc.icons.length === 1 &&
        /^\/icon\.svg/.test(p14cDoc.icons[0].href) &&
        p14cDoc.icons[0].type === "image/svg+xml" &&
        p14cDoc.themeColor === null &&
        p14cDoc.manifest === 0 &&
        p14cDoc.appleIcon === 0 &&
        p14cAssets["/icon.svg"].status === 200 &&
        /image\/svg\+xml/.test(p14cAssets["/icon.svg"].type) &&
        p14cAssets["/icon.svg"].body.includes(
          '<rect width="64" height="64" rx="14" fill="#0c2137"/>',
        ) &&
        p14cAssets["/icon.svg"].body.includes('stroke="#ff982f"') &&
        p14cAssets["/icon.svg"].body.includes("M17.8 19.2 16 11l3.5-3.5") &&
        ["/sw.js", "/manifest.webmanifest", "/favicon.ico", "/apple-icon.png"].every(
          (p) => p14cAssets[p].status === 404,
        ) &&
        p14cDoc.sw === 0,
      `${JSON.stringify({ ...p14cDoc, button: undefined, field: undefined, bodyFont: undefined, fontsLoaded: undefined, foreign: undefined })} ${JSON.stringify(Object.fromEntries(Object.entries(p14cAssets).map(([k, v]) => [k, v.status])))}`,
    );
    ok(
      "PKG P14c 0b VIS-03 #1/#2, VIS-09 #1/#6, VIS-04 #1, META-01 #5: Inter is declared on body AND loaded (document.fonts), every resource comes from this origin; «Iniciar sesión» is the primary button — accent background, ink text, 8 px radius, 40 px, 14 px semibold —; the «Correo electrónico» field has the line border, 8 px radius, 40 px and 15 px text",
      /Inter/.test(p14cDoc.bodyFont) &&
        p14cDoc.fontsLoaded.some((f) => /Inter/.test(f)) &&
        p14cDoc.foreign.length === 0 &&
        p14cDoc.button.backgroundColor === p14cTokenRgb.accent &&
        p14cDoc.button.color === p14cTokenRgb.ink &&
        p14cDoc.button.borderRadius === "8px" &&
        p14cDoc.button.minHeight === "40px" &&
        p14cDoc.button.h === 40 &&
        p14cDoc.button.fontSize === "14px" &&
        p14cDoc.button.fontWeight === "600" &&
        p14cDoc.field.borderColor === p14cTokenRgb.line &&
        p14cDoc.field.borderRadius === "8px" &&
        p14cDoc.field.minHeight === "40px" &&
        p14cDoc.field.fontSize === "15px" &&
        p14cDoc.field.backgroundColor === "rgb(255, 255, 255)",
      `${p14cDoc.bodyFont.slice(0, 60)} loaded=${p14cDoc.fontsLoaded.join("|")} foreign=${p14cDoc.foreign.join(",")} ${JSON.stringify(p14cDoc.button)} ${JSON.stringify(p14cDoc.field)}`,
    );

    // 1) Delta (professional) in Spanish on «Mi espacio»: the tokens and the shell at 1440 (VIS-01, VIS-02, VIS-03,
    //    VIS-04, VIS-06 #3/#4/#5/#14, VIS-07 #1, VIS-08 #1/#2, VIS-09 #4).
    await login(DELTA);
    await page.goto(`${BASE}/app/settings`);
    await page.waitForLoadState("networkidle");
    await page.locator("[role=radio][lang=es]").first().click();
    await page.waitForSelector("[role=status]:has-text('Idioma actualizado')", { timeout: 15000 });
    await page.goto(`${BASE}/app/professional`);
    await page.waitForLoadState("networkidle");
    await expectSpanish("PKG P14c 1 «Mi espacio» in Spanish");
    const p14cDesk = await p14cShell();
    ok(
      "PKG P14c 1b VIS-01 #2/#3/#5/#6/#7/#8/#9/#12/#17, VIS-02 #17: :root exposes the @theme tokens with the values of globals.css (navy #0c2137, navy-700 #203b54, ink #172c44, muted #5b6f84, line #dce4ed, canvas #f5f7fa, accent #ff982f, accent-hover #ffa747, blue #18558f, ok #16745d, ok-bg #e7f5ee, warn #aa5916, danger #ad3b44, tool #057f7d, tool-hero #112e40); the document paints canvas and ink; no `dark:` scheme",
      Object.entries(P14C_TOKENS).every(([k, v]) => p14cDesk.tokens[k] === v) &&
        p14cDesk.html.backgroundColor === p14cTokenRgb.canvas &&
        p14cDesk.html.color === p14cTokenRgb.ink,
      JSON.stringify({ tokens: p14cDesk.tokens, html: p14cDesk.html }),
    );
    ok(
      "PKG P14c 1c VIS-02 #1/#2, VIS-03 #1/#2/#4/#5, VIS-06 #3/#4/#5/#14, VIS-07 #1, VIS-08 #1/#2: at 1440 the sidebar is sticky, 256 px, navy, text #c4d3e1; the active entry is navy-700 with white text, 8 px radius, 14 px, its 18 px icon in accent; section titles 11 px, .16em, #91aac1, uppercase; the brand mark is a 36 px accent square, 10 px radius, navy 20 px plane; body Inter 15 px / 24 px, the h1 30 px bold tight; the white header is ≥ 72 px with the line border and a 12 px muted crumb; the footer 12 px muted on the line border; the panel white, line border, 12 px radius",
      p14cDesk.aside.position === "sticky" &&
        p14cDesk.aside.w === 256 &&
        p14cDesk.aside.backgroundColor === p14cTokenRgb.navy &&
        p14cDesk.aside.color === p14cRgb("#c4d3e1") &&
        p14cDesk.active.backgroundColor === p14cTokenRgb["navy-700"] &&
        p14cDesk.active.color === "rgb(255, 255, 255)" &&
        p14cDesk.active.borderRadius === "8px" &&
        p14cDesk.active.fontSize === "14px" &&
        p14cDesk.active.icon.color === p14cTokenRgb.accent &&
        p14cDesk.active.icon.w === 18 &&
        p14cDesk.active.icon.h === 18 &&
        p14cDesk.inactive.color === p14cRgb("#c4d3e1") &&
        p14cDesk.sectionLabel.fontSize === "11px" &&
        p14cDesk.sectionLabel.letterSpacing === "1.76px" &&
        p14cDesk.sectionLabel.color === p14cRgb("#91aac1") &&
        p14cDesk.sectionLabel.textTransform === "uppercase" &&
        p14cDesk.mark.backgroundColor === p14cTokenRgb.accent &&
        p14cDesk.mark.color === p14cTokenRgb.navy &&
        p14cDesk.mark.borderRadius === "10px" &&
        p14cDesk.mark.w === 36 &&
        p14cDesk.mark.h === 36 &&
        p14cDesk.mark.svg.w === 20 &&
        /Inter/.test(p14cDesk.body.fontFamily) &&
        p14cDesk.fontsLoaded.some((f) => /Inter/.test(f)) &&
        p14cDesk.body.fontSize === "15px" &&
        p14cDesk.body.lineHeight === "24px" &&
        p14cDesk.h1.fontSize === "30px" &&
        p14cDesk.h1.fontWeight === "700" &&
        p14cDesk.h1.letterSpacing === "-0.75px" &&
        p14cDesk.header !== null &&
        p14cDesk.header.h >= 72 &&
        p14cDesk.header.backgroundColor === "rgb(255, 255, 255)" &&
        p14cDesk.header.borderBottomColor === p14cTokenRgb.line &&
        p14cDesk.header.crumb.fontSize === "12px" &&
        p14cDesk.header.crumb.color === p14cTokenRgb.muted &&
        p14cDesk.footer.visible &&
        p14cDesk.footer.fontSize === "12px" &&
        p14cDesk.footer.color === p14cTokenRgb.muted &&
        p14cDesk.footer.borderTopColor === p14cTokenRgb.line &&
        p14cDesk.panel.backgroundColor === "rgb(255, 255, 255)" &&
        p14cDesk.panel.borderColor === p14cTokenRgb.line &&
        p14cDesk.panel.borderRadius === "12px" &&
        p14cDesk.dock === null &&
        !p14cDesk.menuButton,
      JSON.stringify({
        ...p14cDesk,
        tokens: undefined,
        palette: undefined,
        fontsLoaded: undefined,
      }),
    );
    ok(
      "PKG P14c 1d VIS-01 #19 (negative): every colour painted on the shell at 1440 (document, sidebar, active entry and its icon, brand mark, header, crumb, footer, panel) is a token value, white or one of the two documented sidebar greys (#c4d3e1, #91aac1) — nothing else",
      p14cDesk.palette.length >= 8 && p14cDesk.palette.every((c) => p14cAllowed.has(c)),
      p14cDesk.palette.filter((c) => !p14cAllowed.has(c)).join(", ") ||
        `${p14cDesk.palette.length} colours, all tokens`,
    );
    await p14cShot("shell-after-1440");

    // 2) The focus ring (VIS-01 #9 as a token; v1.8 `outline:3px solid #e88b26; outline-offset:3px`): Tab reaches the
    //    skip link; its ring is the 3 px accent outline 2 px out plus the 2 px navy box-shadow of `globals.css`.
    await page.keyboard.press("Tab");
    const p14cFocus = await page.evaluate(() => {
      const el = document.activeElement;
      const s = getComputedStyle(el);
      return {
        text: el?.textContent?.trim(),
        outlineColor: s.outlineColor,
        outlineWidth: s.outlineWidth,
        outlineStyle: s.outlineStyle,
        outlineOffset: s.outlineOffset,
        boxShadow: s.boxShadow,
      };
    });
    await p14cShot("focus-after-1440");
    ok(
      "PKG P14c 2 focus ring (globals.css :focus-visible; v1.8 3 px #e88b26 offset 3 px): the focused skip link shows a 3 px solid accent outline, 2 px offset, over a 2 px navy box-shadow",
      p14cFocus.text === "Saltar al contenido" &&
        p14cFocus.outlineColor === p14cTokenRgb.accent &&
        p14cFocus.outlineWidth === "3px" &&
        p14cFocus.outlineStyle === "solid" &&
        p14cFocus.outlineOffset === "2px" &&
        p14cFocus.boxShadow === `${p14cTokenRgb.navy} 0px 0px 0px 2px`,
      JSON.stringify(p14cFocus),
    );

    // 3) Chips (VIS-02 #6, VIS-04 #3, VIS-03 #10) on «Cualificaciones», and the tools palette on «Herramientas»
    //    (VIS-01 #17, VIS-02 #4/#5): teal only there.
    await page.goto(`${BASE}/app/professional/qualifications`);
    await page.waitForLoadState("networkidle");
    const p14cChips = await page.evaluate(() => {
      const chips = [...document.querySelectorAll("main span.rounded-md.font-bold")];
      const s = chips[0] ? getComputedStyle(chips[0]) : null;
      return {
        count: chips.length,
        fontSize: s?.fontSize,
        fontWeight: s?.fontWeight,
        borderRadius: s?.borderRadius,
        borderWidth: s?.borderWidth,
        textTransform: s?.textTransform,
        uppercaseText: chips.filter((c) => /^[A-ZÁÉÍÓÚÑ ]{4,}$/.test(c.textContent.trim())).length,
      };
    });
    await page.goto(`${BASE}/app/tools`);
    await page.waitForLoadState("networkidle");
    const p14cTools = await page.evaluate(() => {
      const hero = document.querySelector("main [class*='bg-tool-hero']");
      const accentInMain = [...document.querySelectorAll("main *")].filter(
        (el) => getComputedStyle(el).backgroundColor === "rgb(255, 152, 47)",
      ).length;
      return {
        title: document.title,
        hero: hero ? getComputedStyle(hero).backgroundColor : null,
        heroRadius: hero ? getComputedStyle(hero).borderRadius : null,
        accentInMain,
      };
    });
    await p14cShot("tools-after-1440");
    ok(
      "PKG P14c 3 VIS-02 #4/#5/#6, VIS-03 #10, VIS-04 #3, VIS-01 #17: the status chips on «Cualificaciones» are 12 px bold, 6 px radius, 1 px border, sentence case (no all-caps chip); «Herramientas · CrewFlex» paints its hero in tool-hero #112e40 with the v1.8 18 px radius and no accent-orange surface in its content (teal workbench only under /app/tools)",
      p14cChips.count > 0 &&
        p14cChips.fontSize === "12px" &&
        p14cChips.fontWeight === "700" &&
        p14cChips.borderRadius === "6px" &&
        p14cChips.borderWidth === "1px" &&
        p14cChips.textTransform === "none" &&
        p14cChips.uppercaseText === 0 &&
        p14cTools.title === "Herramientas · CrewFlex" &&
        p14cTools.hero === p14cTokenRgb["tool-hero"] &&
        p14cTools.heroRadius === "18px" &&
        p14cTools.accentInMain === 0,
      `${JSON.stringify(p14cChips)} ${JSON.stringify(p14cTools)}`,
    );

    // 4) One <title> per screen with its menu label and lang=es (META-02 #2/#3, META-01 #1).
    const p14cTitles = {};
    for (const [path, expected] of [
      ["/app/professional", "Mi espacio"],
      ["/app/professional/profile", "Mi pasaporte"],
      ["/app/professional/qualifications", "Cualificaciones"],
      ["/app/professional/availability", "Disponibilidad"],
      ["/app/professional/opportunities", "Oportunidades"],
      ["/app/professional/applications", "Mis candidaturas"],
      ["/app/professional/documents", "Documentos"],
      ["/app/professional/logbook", "Logbook"],
      ["/app/notices", "Avisos"],
      ["/app/settings", "Configuración"],
    ]) {
      await page.goto(`${BASE}${path}`);
      await page.waitForLoadState("networkidle");
      const got = await page.evaluate(() => ({
        title: document.title,
        lang: document.documentElement.lang,
      }));
      p14cTitles[path] = {
        ...got,
        pass: got.title === `${expected} · CrewFlex` && got.lang === "es",
      };
    }
    ok(
      "PKG P14c 4 META-02 #1/#2/#3, META-01 #1: the ten professional and account pages are titled «{entrada del menú} · CrewFlex» (Mi espacio, Mi pasaporte, Cualificaciones, Disponibilidad, Oportunidades, Mis candidaturas, Documentos, Logbook, Avisos, Configuración) with <html lang=es>",
      Object.values(p14cTitles).every((t) => t.pass),
      Object.entries(p14cTitles)
        .filter(([, t]) => !t.pass)
        .map(([p, t]) => `${p}: ${t.title} (${t.lang})`)
        .join(" | ") || "10/10",
    );

    // 5) The breakpoint (VIS-06 #2/#3/#11/#14, VIS-07 #22, META-01 #3): at 1024 the sidebar + header; at 1000 the navy
    //    bar with «Menú» and the fixed dock (five 11 px labels, 20 px icons, ≥ 48 px targets, the current one ok on
    //    ok-bg); no overflow at 1024 / 768 / 390 / 360.
    await page.goto(`${BASE}/app/professional`);
    await page.waitForLoadState("networkidle");
    const p14cAt = {};
    for (const width of [1024, 1000, 768, 390, 360]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(250);
      const shell = await p14cShell();
      p14cAt[width] = {
        overflow: await p14cOverflow(),
        asideW: shell.aside.w,
        asidePosition: shell.aside.position,
        header: shell.header !== null,
        menu: shell.menuButton,
        dock: shell.dock,
        footer: shell.footer.visible,
        palette: shell.palette,
      };
      if (width === 390) await p14cShot("shell-after-390");
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    const p14cDock = p14cAt[390].dock;
    ok(
      "PKG P14c 5 VIS-06 #2/#3/#11/#14, VIS-07 #22, VIS-04 #8: at 1024 the sticky 256 px sidebar and the white header, no «Menú», no dock; at 1000 and below the sidebar is the full-width navy bar with «Menú», the header is gone and the dock is fixed at bottom 0 with five shortcuts — 11 px muted labels, 20 px icons, targets ≥ 48 px, the current «Inicio» semibold ok on ok-bg —; the footer stays; no horizontal overflow at 1024 / 768 / 390 / 360",
      !p14cAt[1024].overflow &&
        p14cAt[1024].asideW === 256 &&
        p14cAt[1024].asidePosition === "sticky" &&
        p14cAt[1024].header &&
        !p14cAt[1024].menu &&
        p14cAt[1024].dock === null &&
        [1000, 768, 390, 360].every(
          (w) =>
            p14cAt[w].asideW === w &&
            !p14cAt[w].header &&
            p14cAt[w].menu &&
            p14cAt[w].dock !== null &&
            p14cAt[w].dock.links === 5 &&
            p14cAt[w].footer,
        ) &&
        [768, 390, 360].every((w) => !p14cAt[w].overflow) &&
        p14cDock.position === "fixed" &&
        p14cDock.bottom === "0px" &&
        p14cDock.label.fontSize === "11px" &&
        p14cDock.label.color === p14cTokenRgb.muted &&
        p14cDock.icon.w === 20 &&
        p14cDock.icon.h === 20 &&
        p14cDock.minTarget >= 48 &&
        p14cDock.current?.text === "Inicio" &&
        p14cDock.current.backgroundColor === p14cTokenRgb["ok-bg"] &&
        p14cDock.current.color === p14cTokenRgb.ok &&
        p14cDock.current.fontWeight === "600",
      JSON.stringify(
        Object.fromEntries(
          Object.entries(p14cAt).map(([w, a]) => [
            w,
            {
              ...a,
              palette: undefined,
              dock: a.dock
                ? { links: a.dock.links, h: a.dock.h, current: a.dock.current?.text }
                : null,
            },
          ]),
        ),
      ) + ` dock390=${JSON.stringify(p14cDock)}`,
    );
    ok(
      "PKG P14c 5b VIS-01 #19 (negative, below lg): the colours painted on the navy bar, the dock and its current shortcut at 1000 / 768 / 390 / 360 are token values (muted, ok, ok-bg, line, white/95) or the documented sidebar greys — nothing else",
      [1000, 768, 390, 360].every((w) => p14cAt[w].palette.every((c) => p14cAllowed.has(c))),
      [1000, 768, 390, 360]
        .flatMap((w) =>
          p14cAt[w].palette.filter((c) => !p14cAllowed.has(c)).map((c) => `${w}:${c}`),
        )
        .join(", ") || "all tokens",
    );

    // 6) Media (VIS-05 #4/#5/#6): reduced motion → zero running animations; print → no print stylesheet (the
    //    sidebar is still displayed: documented ≠); dark scheme → the document keeps canvas (no dark mode, =).
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${BASE}/app/professional`);
    await page.waitForLoadState("networkidle");
    const p14cReduce = await page.evaluate(() => ({
      running: document.getAnimations().length,
      named: [...document.querySelectorAll("*")].filter(
        (el) => getComputedStyle(el).animationName !== "none",
      ).length,
      matches: matchMedia("(prefers-reduced-motion: reduce)").matches,
    }));
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.reload();
    await page.waitForLoadState("networkidle");
    const p14cMotion = await page.evaluate(() => ({ running: document.getAnimations().length }));
    await page.emulateMedia({ media: "print" });
    const p14cPrint = await page.evaluate(() => ({
      aside: getComputedStyle(document.querySelector("aside")).display,
      dock: getComputedStyle(document.querySelector("nav[aria-label='Accesos rápidos']")).display,
      matches: matchMedia("print").matches,
    }));
    await page.emulateMedia({ media: "screen", colorScheme: "dark" });
    const p14cDark = await page.evaluate(() => ({
      matches: matchMedia("(prefers-color-scheme: dark)").matches,
      html: getComputedStyle(document.documentElement).backgroundColor,
      aside: getComputedStyle(document.querySelector("aside")).backgroundColor,
    }));
    await page.emulateMedia({ media: null, colorScheme: null, reducedMotion: null });
    ok(
      "PKG P14c 6 VIS-05 #4/#5/#6, VIS-02 #17: with prefers-reduced-motion emulated «Mi espacio» runs zero animations and no element computes an animation-name; without it, still zero running on the loaded page (the only `animate-pulse` is the loading skeleton, under motion-safe); under print media the sidebar stays displayed (the dock is lg:hidden at 1440) (no print stylesheet, documented ≠); under a dark scheme the document keeps canvas and the sidebar navy (no dark mode, =)",
      p14cReduce.matches &&
        p14cReduce.running === 0 &&
        p14cReduce.named === 0 &&
        p14cMotion.running === 0 &&
        p14cPrint.matches &&
        p14cPrint.aside !== "none" &&
        p14cPrint.dock === "none" &&
        p14cDark.matches &&
        p14cDark.html === p14cTokenRgb.canvas &&
        p14cDark.aside === p14cTokenRgb.navy,
      `${JSON.stringify(p14cReduce)} ${JSON.stringify(p14cMotion)} ${JSON.stringify(p14cPrint)} ${JSON.stringify(p14cDark)}`,
    );
    await logout();
  } finally {
    await page
      .emulateMedia({ media: null, colorScheme: null, reducedMotion: null })
      .catch(() => {});
    await page.setViewportSize({ width: 1440, height: 900 });
    if (/\/app/.test(page.url())) await logout().catch(() => {});
    const p14cEnglish =
      (await asSeedUser(DELTA, "user-preferences", { method: "PATCH", body: { locale: "en" } }))
        .ok === true;
    await ctx.clearCookies({ name: "crewflex-locale" });
    ok(
      "PKG P14c 7 restore: Delta in English, locale cookie cleared, media emulation and viewport reset",
      p14cEnglish,
      String(p14cEnglish),
    );
  }
}

// PKG P15 (accessibility and i18n parity, F3 — A11Y-01 #1-#7, A11Y-02 #1/#2/#4/#5, A11Y-03 #2/#3/#5, A11Y-04 #1/#3/#5,
// A11Y-05 #1/#2/#8/#11/#12/#13, A11Y-06 #1/#2/#4/#13/#15/#20, I18N-01 #2/#3/#4, I18N-03 #1/#3/#5, I18N-04 #1/#3,
// I18N-05; re-verification of the a11y and i18n rows of the 22/10 inventory after F3, plus the four small gaps closed
// by this package — the navy ring under `shadow-*`/`ring-*` utilities, «Accesos directos» for the dashboard quick
// links, the 44 px application title link and brand mark, `muted` for the 12 px tools disclosures — and the activity
// labels): in Spanish the pages MEASURE their landmarks (one `main#main`, named `nav`s, one visible
// `aria-current="page"`), the skip link reaching `main`, the native `<dialog>` (modal, labelled, focus inside, Escape
// returns focus), the double focus ring computed after the 150 ms transition on today's mini-calendar day and on the
// pressed tools toggle, the `role=status` / `role=alert` live regions on save and on a failed submit, the touch
// targets of three pages under touch emulation at 390 (≥ 44 px, the documented exceptions apart), the WCAG ratios of
// every visible text computed from the live colours (≥ 4.5:1, 3:1 for large text), `<html lang>` following the ES/EN
// switch, no English UI word on Spanish pages and no Spanish UI word on English ones, an ICU plural rendered for 1
// («1 oportunidad») and n («N necesidades»), and unique landmark names on the organization dashboard. Negatives: no
// skip link outside `/app` (documented ≈), a blurred control has no outline, no raw audit code in the activity trail.
// Nothing is written except Delta's and admin.mro's language, restored in `finally` (API + cookie); the touch and
// anonymous contexts are closed and the viewport reset.
{
  const DELTA = "delta@crewflex.test";
  const MRO = "admin.mro@crewflex.test";
  const p15Shot = (name, target = page) =>
    target.screenshot({
      path: `docs/audit/evidence/parity/P15/P15-${name}.jpg`,
      type: "jpeg",
      quality: 70,
      fullPage: false,
    });
  const p15Rgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
  };
  const P15_NAVY = p15Rgb("#0c2137");
  const P15_ACCENT = p15Rgb("#ff982f");
  // Words that only exist in the Spanish catalog: seeing them on an English page = untranslated text
  // («Idioma / Language» is bilingual by design, I18N_STRATEGY §5, so «Idioma» is not one).
  const P15_ES_SENTINELS =
    /\b(Cerrar sesión|Configuración|Disponibilidad|Cualificaciones|Mi espacio|Avisos|Herramientas|Guardar|Mis candidaturas|Oportunidades|Necesidades|Saltar al contenido)\b/;
  /** Landmarks, names and ARIA facts of the current page (A11Y-01, A11Y-04). */
  const p15Landmarks = (target = page) =>
    target.evaluate(() => {
      const vis = (el) => el.getClientRects().length > 0;
      const name = (n) =>
        n.getAttribute("aria-label") ??
        document.getElementById(n.getAttribute("aria-labelledby") ?? "")?.textContent.trim() ??
        null;
      const navs = [...document.querySelectorAll("nav")];
      return {
        lang: document.documentElement.lang,
        title: document.title,
        mains: [...document.querySelectorAll("main")].map((m) => m.id),
        navs: navs.map(name),
        visibleNavs: navs.filter(vis).map(name),
        header: [...document.querySelectorAll("body header")].filter(
          (h) => vis(h) && !h.closest("main, section, article, aside"),
        ).length,
        footer: document.querySelectorAll("footer").length,
        aside: document.querySelectorAll("aside").length,
        h1: [...document.querySelectorAll("h1")].map((h) => h.textContent.trim()),
        skip: document.querySelector("a[href='#main']")?.textContent.trim() ?? null,
        currentPage: [...document.querySelectorAll("[aria-current='page']")]
          .filter(vis)
          .map((e) => e.textContent.trim()),
        unlabelledInputs: [
          ...document.querySelectorAll("input:not([type=hidden]), select, textarea"),
        ].filter(
          (i) =>
            vis(i) &&
            !(i.labels && i.labels.length) &&
            !i.getAttribute("aria-label") &&
            !i.getAttribute("aria-labelledby"),
        ).length,
        unnamedControls: [...document.querySelectorAll("button, a[href]")].filter(
          (b) =>
            vis(b) &&
            !(
              b.textContent.trim() ||
              b.getAttribute("aria-label") ||
              b.getAttribute("aria-labelledby") ||
              b.getAttribute("title")
            ),
        ).length,
        danglingDescribedBy: [...document.querySelectorAll("[aria-describedby]")].filter(
          (e) =>
            !e
              .getAttribute("aria-describedby")
              .split(/\s+/)
              .every((id) => document.getElementById(id)),
        ).length,
        radiogroups: [...document.querySelectorAll("[role=radiogroup]")].map((g) => ({
          radios: g.querySelectorAll("[role=radio]").length,
          tabbable: [...g.querySelectorAll("[role=radio]")].filter((r) => r.tabIndex === 0).length,
        })),
      };
    });
  /** The focus ring of the active element, read after Button's 150 ms colour transition. */
  const p15Ring = (target = page) =>
    target.evaluate(async () => {
      await new Promise((r) => setTimeout(r, 220));
      const el = document.activeElement;
      const s = getComputedStyle(el);
      return {
        name: (el.getAttribute("aria-label") ?? el.textContent.trim()).slice(0, 40),
        focusVisible: el.matches(":focus-visible"),
        outline: `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`,
        offset: s.outlineOffset,
        shadow: s.boxShadow,
      };
    });
  const p15DoubleRing = (r) =>
    r.focusVisible &&
    r.outline === `3px solid ${P15_ACCENT}` &&
    r.offset === "2px" &&
    r.shadow.includes(`${P15_NAVY} 0px 0px 0px 2px`);
  /** WCAG 2.x ratio of every visible text element against its composited background (A11Y-06). */
  const p15Contrast = (target = page) =>
    target.evaluate(() => {
      const parse = (c) => {
        const m = c.match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const [r, g, b, a] = m[1].split(",").map(Number);
        return { r, g, b, a: a === undefined || Number.isNaN(a) ? 1 : a };
      };
      const lum = ({ r, g, b }) => {
        const f = (c) => {
          c /= 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const ratio = (a, b) => {
        const [h, l] = [lum(a), lum(b)].sort((x, y) => y - x);
        return (h + 0.05) / (l + 0.05);
      };
      const blend = (fg, bg) => ({
        r: fg.r * fg.a + bg.r * (1 - fg.a),
        g: fg.g * fg.a + bg.g * (1 - fg.a),
        b: fg.b * fg.a + bg.b * (1 - fg.a),
        a: 1,
      });
      const hex = (c) =>
        `#${[c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
      // Background: the composited stack of ancestor backgrounds (gradients are skipped: reported apart).
      const bgOf = (el) => {
        const layers = [];
        for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
          const s = getComputedStyle(n);
          const c = parse(s.backgroundColor);
          if (c && c.a > 0) layers.push(c);
          if (s.backgroundImage !== "none") return null;
        }
        let out = parse(getComputedStyle(document.documentElement).backgroundColor) ?? {
          r: 255,
          g: 255,
          b: 255,
          a: 1,
        };
        for (const l of layers.reverse()) out = l.a < 1 ? blend(l, out) : l;
        return out;
      };
      const opacityOf = (el) => {
        let o = 1;
        for (let n = el; n && n !== document.documentElement; n = n.parentElement)
          o *= parseFloat(getComputedStyle(n).opacity);
        return o;
      };
      const rows = [];
      let gradients = 0;
      for (const el of document.querySelectorAll("body *")) {
        if (!el.getClientRects().length) continue;
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        const s = getComputedStyle(el);
        if (s.visibility === "hidden") continue;
        const fg = parse(s.color);
        const bg = bgOf(el);
        if (!fg || !bg) {
          gradients += 1;
          continue;
        }
        const op = opacityOf(el);
        const fgE = op < 1 || fg.a < 1 ? blend({ ...fg, a: fg.a * op }, bg) : fg;
        const size = parseFloat(s.fontSize);
        const large = size >= 24 || (size >= 18.66 && parseInt(s.fontWeight) >= 700);
        rows.push({
          text: el.textContent.trim().slice(0, 40),
          fg: hex(fgE),
          bg: hex(bg),
          ratio: Math.round(ratio(fgE, bg) * 100) / 100,
          size,
          large,
          disabled: el.closest("[disabled], [aria-disabled='true']") !== null,
        });
      }
      const live = rows.filter((r) => !r.disabled);
      return {
        n: live.length,
        gradients,
        min: Math.min(...live.map((r) => r.ratio)),
        fails: live.filter((r) => r.ratio < (r.large ? 3 : 4.5)),
        disabledBelow: rows.filter((r) => r.disabled && r.ratio < 4.5).length,
        rows: live,
      };
    });
  /** Interactive targets below 44 × 44 CSS px, with the documented exceptions named (A11Y-05). */
  const p15Targets = (target) =>
    target.evaluate(() =>
      [
        ...document.querySelectorAll(
          "a[href], button, input:not([type=hidden]), select, textarea, summary, [role=radio], [role=button], [tabindex]:not([tabindex='-1'])",
        ),
      ]
        .filter((el) => el.getClientRects().length > 0)
        .map((el) => {
          const r = el.getBoundingClientRect();
          let { width: w, height: h } = r;
          if ((el.type === "checkbox" || el.type === "radio") && el.labels?.[0]) {
            const lr = el.labels[0].getBoundingClientRect();
            w = Math.max(w, lr.width);
            h = Math.max(h, lr.height);
          }
          const inSentence =
            el.tagName === "A" &&
            getComputedStyle(el).display === "inline" &&
            el.parentElement.textContent.trim().length > el.textContent.trim().length + 2;
          return {
            tag: el.tagName.toLowerCase(),
            name: (el.getAttribute("aria-label") ?? el.textContent.trim()).slice(0, 40),
            w: Math.round(w * 10) / 10,
            h: Math.round(h * 10) / 10,
            exception: inSentence
              ? "inline link in a sentence (WCAG 2.5.8)"
              : el.getAttribute("href") === "#main"
                ? "skip link (sr-only until focused)"
                : /^\d{4}-\d\d-\d\d: /.test(el.getAttribute("aria-label") ?? "")
                  ? "calendar day: 7 columns in 316 px (41.7 px wide, v1.8 42.3)"
                  : null,
          };
        }),
    );
  const p15Small = (targets) => targets.filter((t) => (t.w < 44 || t.h < 44) && !t.exception);
  let p15Touch = null;
  let p15AnonCtx = null;
  try {
    // 0) Anonymous /login in Spanish: landmarks of a single-block page, the ES/EN radiogroup and `<html lang>`,
    //    the failed submit's alert (A11Y-01 #3/#4, A11Y-03 #2, A11Y-04 #1/#3, I18N-01 #2/#4, I18N-05).
    p15AnonCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await p15AnonCtx.addCookies([{ name: "crewflex-locale", value: "es", url: BASE }]);
    const p15Anon = await p15AnonCtx.newPage();
    await p15Anon.goto(`${BASE}/login`);
    await p15Anon.waitForLoadState("networkidle");
    const p15LoginEs = await p15Landmarks(p15Anon);
    await p15Anon.keyboard.press("Tab");
    const p15FirstTab = await p15Anon.evaluate(() => ({
      text: document.activeElement.textContent.trim(),
      href: document.activeElement.getAttribute("href"),
    }));
    const p15EsText = await p15Anon.locator("body").innerText();
    await p15Anon.locator("[role=radio][lang=en]").first().click();
    await p15Anon.waitForFunction(() => document.documentElement.lang === "en", null, {
      timeout: 15000,
    });
    const p15LoginEn = {
      lang: await p15Anon.evaluate(() => document.documentElement.lang),
      title: await p15Anon.title(),
      cookie: (await p15AnonCtx.cookies()).find((c) => c.name === "crewflex-locale")?.value,
      esHits: [
        ...new Set(
          (await p15Anon.locator("body").innerText()).match(
            new RegExp(P15_ES_SENTINELS.source, "g"),
          ) ?? [],
        ),
      ],
      checked: await p15Anon.evaluate(() =>
        [...document.querySelectorAll("[role=radio]")].map(
          (r) => `${r.getAttribute("lang")}:${r.getAttribute("aria-checked")}:${r.tabIndex}`,
        ),
      ),
    };
    await p15Anon.locator("[role=radio][lang=es]").first().click();
    await p15Anon.waitForFunction(() => document.documentElement.lang === "es", null, {
      timeout: 15000,
    });
    await p15Anon.click("button[type=submit]");
    await p15Anon.waitForSelector("[role=alert]:has-text('Revisa los campos marcados.')", {
      timeout: 15000,
    });
    const p15Alert = await p15Anon.evaluate(() => ({
      alerts: [...document.querySelectorAll("[role=alert]")].map((e) => e.textContent.trim()),
      invalid: [...document.querySelectorAll("[aria-invalid='true']")].map((i) => ({
        id: i.id,
        error: document
          .getElementById(i.getAttribute("aria-describedby") ?? "")
          ?.textContent.trim(),
      })),
    }));
    await p15AnonCtx.close();
    p15AnonCtx = null;
    ok(
      "PKG P15 0 A11Y-01 #3/#4, A11Y-04 #1, I18N-01 #2/#4, I18N-05: /login (es) is one `main`, no `nav`, no skip link (single-block page, documented ≈), one h1 «Iniciar sesión», every field labelled, every control named; the first Tab lands on the brand link to /; the ES/EN `radiogroup` has 2 radios and one Tab stop; EN → <html lang=en>, title «Sign in · CrewFlex», cookie en, EN marked and no Spanish UI word on the page; ES again → lang es; no English UI word on the Spanish page",
      p15LoginEs.lang === "es" &&
        p15LoginEs.mains.length === 1 &&
        p15LoginEs.navs.length === 0 &&
        p15LoginEs.skip === null &&
        p15LoginEs.h1.length === 1 &&
        p15LoginEs.h1[0] === "Iniciar sesión" &&
        p15LoginEs.unlabelledInputs === 0 &&
        p15LoginEs.unnamedControls === 0 &&
        p15LoginEs.radiogroups.length === 1 &&
        p15LoginEs.radiogroups[0].radios === 2 &&
        p15LoginEs.radiogroups[0].tabbable === 1 &&
        p15FirstTab.href === "/" &&
        /CrewFlex/.test(p15FirstTab.text) &&
        p15LoginEn.lang === "en" &&
        p15LoginEn.title === "Sign in · CrewFlex" &&
        p15LoginEn.cookie === "en" &&
        p15LoginEn.esHits.length === 0 &&
        p15LoginEn.checked.includes("en:true:0") &&
        p15LoginEn.checked.includes("es:false:-1") &&
        !EN_SENTINELS.test(p15EsText),
      `${JSON.stringify({ ...p15LoginEs, radiogroups: undefined })} firstTab=${JSON.stringify(p15FirstTab)} en=${JSON.stringify(p15LoginEn)} enHits=${JSON.stringify(p15EsText.match(new RegExp(EN_SENTINELS.source, "g")))}`,
    );
    ok(
      "PKG P15 0b A11Y-03 #2/#4, A11Y-04 #3: the empty sign-in shows one `role=alert` «Revisa los campos marcados.» and both fields carry aria-invalid with an aria-describedby that resolves to «Introduce un correo electrónico válido» / «Introduce tu contraseña»",
      p15Alert.alerts.length === 1 &&
        p15Alert.alerts[0] === "Revisa los campos marcados." &&
        p15Alert.invalid.length === 2 &&
        p15Alert.invalid.some(
          (i) => i.id === "email" && i.error === "Introduce un correo electrónico válido",
        ) &&
        p15Alert.invalid.some((i) => i.id === "password" && i.error === "Introduce tu contraseña"),
      JSON.stringify(p15Alert),
    );

    // 1) Delta in Spanish on «Mi espacio»: landmarks, names, one current entry, the skip link (A11Y-01 #1/#2/#4/#6,
    //    A11Y-04 #3/#5, I18N-03 #1/#3).
    await login(DELTA);
    await page.goto(`${BASE}/app/settings`);
    await page.waitForLoadState("networkidle");
    await page.locator("[role=radio][lang=es]").first().click();
    await page.waitForSelector("[role=status]:has-text('Idioma actualizado')", { timeout: 15000 });
    await page.goto(`${BASE}/app/professional`);
    await page.waitForLoadState("networkidle");
    await expectSpanish("PKG P15 1 «Mi espacio» in Spanish");
    const p15Home = await p15Landmarks();
    await page.keyboard.press("Tab");
    const p15Skip = await page.evaluate(() => {
      const el = document.activeElement;
      const r = el.getBoundingClientRect();
      return {
        text: el.textContent.trim(),
        href: el.getAttribute("href"),
        w: r.width,
        h: r.height,
      };
    });
    const p15SkipRing = await p15Ring();
    await p15Shot("home-after-1440");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    await page.keyboard.press("Tab");
    const p15AfterSkip = await page.evaluate(() => ({
      hash: location.hash,
      inMain: !!document.activeElement.closest("main#main"),
      text: document.activeElement.textContent.trim().slice(0, 40),
    }));
    ok(
      "PKG P15 1b A11Y-01 #1/#2/#4/#6, A11Y-04 #3/#5, I18N-03 #1/#3: «Mi espacio» (es) has one `main#main`, the `nav`s «Profesional», «Cuenta», «Ruta de navegación» (visible at 1440) and «Accesos rápidos» (the dock, hidden at 1440), one banner header, one footer, one aside, one h1; exactly one visible aria-current=page (the menu's «Mi espacio»); every visible field labelled, every control named, every aria-describedby resolves; the first Tab is «Saltar al contenido» (href #main, visible when focused, double ring), Enter → #main and the next Tab is inside `main`",
      p15Home.lang === "es" &&
        p15Home.mains.length === 1 &&
        p15Home.mains[0] === "main" &&
        ["Profesional", "Cuenta", "Ruta de navegación", "Accesos rápidos"].every((n) =>
          p15Home.navs.includes(n),
        ) &&
        p15Home.navs.length === 4 &&
        p15Home.visibleNavs.length === 3 &&
        !p15Home.visibleNavs.includes("Accesos rápidos") &&
        p15Home.header === 1 &&
        p15Home.footer === 1 &&
        p15Home.aside === 1 &&
        p15Home.h1.length === 1 &&
        p15Home.currentPage.length === 1 &&
        p15Home.currentPage[0] === "Mi espacio" &&
        p15Home.unlabelledInputs === 0 &&
        p15Home.unnamedControls === 0 &&
        p15Home.danglingDescribedBy === 0 &&
        p15Skip.text === "Saltar al contenido" &&
        p15Skip.href === "#main" &&
        p15Skip.w > 100 &&
        p15Skip.h >= 36 &&
        p15DoubleRing(p15SkipRing) &&
        p15AfterSkip.hash === "#main" &&
        p15AfterSkip.inMain,
      `${JSON.stringify({ ...p15Home, radiogroups: undefined })} skip=${JSON.stringify(p15Skip)} ring=${JSON.stringify(p15SkipRing)} after=${JSON.stringify(p15AfterSkip)}`,
    );

    // 2) The native modal «Estado de mi perfil» (A11Y-02 #2/#4; v1.8 modal: focus on «Cerrar ventana», Escape
    //    closes and returns focus).
    const p15Opener = page.locator("main button[aria-haspopup=dialog]").first();
    const p15OpenerText = (await p15Opener.textContent()).trim();
    await p15Opener.focus();
    await page.keyboard.press("Enter");
    await page.waitForSelector("dialog[open]", { timeout: 10000 });
    const p15Dialog = await page.evaluate(() => {
      const d = document.querySelector("dialog[open]");
      const title = document.getElementById(d.getAttribute("aria-labelledby") ?? "");
      return {
        modal: d.matches(":modal"),
        title: title?.textContent.trim() ?? null,
        focusInside: !!document.activeElement.closest("dialog[open]"),
        active: document.activeElement.textContent.trim().slice(0, 40),
        mainInert: document.querySelector("main").matches(":modal *") === false,
      };
    });
    const p15DialogRing = await p15Ring();
    await p15Shot("dialog-after-1440");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    const p15Closed = await page.evaluate(() => ({
      open: document.querySelectorAll("dialog[open]").length,
      active: document.activeElement.textContent.trim(),
    }));
    ok(
      "PKG P15 2 A11Y-02 #2/#4: Enter on «Estado de mi perfil ↗» opens a `:modal` <dialog> labelled by a non-empty title («Estado del perfil · N%»), focus lands inside on «Cerrar» with the double ring; Escape closes it and focus returns to the opener",
      p15OpenerText.startsWith("Estado de mi perfil") &&
        p15Dialog.modal &&
        /^Estado del perfil · \d+%$/.test(p15Dialog.title ?? "") &&
        p15Dialog.focusInside &&
        p15Dialog.active === "Cerrar" &&
        p15DoubleRing(p15DialogRing) &&
        p15Closed.open === 0 &&
        p15Closed.active === p15OpenerText,
      `${JSON.stringify(p15Dialog)} ring=${JSON.stringify(p15DialogRing)} closed=${JSON.stringify(p15Closed)}`,
    );

    // 3) Focus rings on the two controls whose own utilities used to replace the navy ring (A11Y-02 #1, A11Y-06
    //    #15): today's mini-calendar day (`ring-2 ring-accent`) and the pressed tools toggle (`shadow-sm`); the
    //    negative: an unfocused control has no outline.
    await page.keyboard.press("Tab"); // keyboard modality, so programmatic focus matches :focus-visible
    await page.evaluate(() =>
      document.querySelector("main ol button[aria-current='date']").focus(),
    );
    const p15TodayRing = await p15Ring();
    await page.goto(`${BASE}/app/tools/knowledge`);
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Tab");
    await page.evaluate(() =>
      document.querySelector("main [role=group] button[aria-pressed='true']").focus(),
    );
    const p15PressedRing = await p15Ring();
    await page.evaluate(() =>
      document.querySelector("main [role=group] button[aria-pressed='false']").focus(),
    );
    const p15UnpressedRing = await p15Ring();
    const p15Blurred = await page.evaluate(() => {
      const el = document.activeElement;
      el.blur();
      const s = getComputedStyle(el);
      return { outline: s.outlineStyle, shadow: s.boxShadow };
    });
    ok(
      "PKG P15 3 A11Y-02 #1, A11Y-06 #15 (gap closed): with keyboard modality, today's mini-calendar day and the pressed tools toggle «Diccionario ES / EN» on /app/tools/knowledge show the 3 px accent outline (2 px offset) AND the 2 px navy ring in their computed box-shadow (the `ring-accent` and `shadow-sm` utilities used to drop the navy); the unpressed toggle too; once blurred the toggle has no outline",
      p15DoubleRing(p15TodayRing) &&
        /^\d{4}-\d\d-\d\d: /.test(p15TodayRing.name) &&
        p15DoubleRing(p15PressedRing) &&
        p15PressedRing.name === "Diccionario ES / EN" &&
        p15DoubleRing(p15UnpressedRing) &&
        p15Blurred.outline === "none" &&
        !p15Blurred.shadow.includes(P15_NAVY),
      `today=${JSON.stringify(p15TodayRing)} pressed=${JSON.stringify(p15PressedRing)} unpressed=${JSON.stringify(p15UnpressedRing)} blurred=${JSON.stringify(p15Blurred)}`,
    );

    // 4) Contrast computed from the live colours (A11Y-06 #1/#2/#4/#13/#20): «Mi espacio» and the knowledge tool.
    const p15KnowledgeC = await p15Contrast();
    const p15Sources = await page.evaluate(() => {
      const d = [...document.querySelectorAll("main details")].find((x) =>
        /Fuentes/.test(x.querySelector("summary")?.textContent ?? ""),
      );
      if (!d) return null;
      d.open = true;
      const p = d.querySelector("div p");
      return {
        summary: d.querySelector("summary").textContent.trim(),
        text: p?.textContent.trim().slice(0, 40),
        color: getComputedStyle(p).color,
        size: getComputedStyle(p).fontSize,
      };
    });
    const p15KnowledgeOpen = await p15Contrast();
    const p15SourcesRow = p15KnowledgeOpen.rows.find((r) => r.text === p15Sources?.text);
    await page.goto(`${BASE}/app/professional`);
    await page.waitForLoadState("networkidle");
    const p15HomeC = await p15Contrast();
    const p15Pair = (c, text) => c.rows.find((r) => r.text.startsWith(text));
    const p15Sidebar = p15Pair(p15HomeC, "Mi espacio");
    const p15Section = p15Pair(p15HomeC, "Profesional");
    // The footer reads «CREWFLEX AVIATION» through `uppercase`; its DOM text is «CrewFlex AVIATION».
    const p15Footer = p15Pair(p15HomeC, "CrewFlex AVIATION");
    ok(
      "PKG P15 4 A11Y-06 #1/#2/#4/#13/#20 (gap closed): every visible, enabled text on «Mi espacio» (≥ 100 measured) and on /app/tools/knowledge (≥ 150, «Fuentes y revisión editorial» opened) computes ≥ 4.5:1 against its composited background (3:1 for large text); the opened 12 px sources text is `muted` #5b6f84 on canvas ≥ 4.5:1 (was #5f7788, 4.37:1); the sidebar entry «Mi espacio» ≥ 10:1 on navy-700, the section title «Profesional» ≥ 6:1 on navy, the footer ≥ 4.5:1 on canvas; disabled past days (opacity 60, WCAG 1.4.3 exemption) are counted apart",
      p15HomeC.n >= 100 &&
        p15HomeC.fails.length === 0 &&
        p15HomeC.min >= 4.5 &&
        p15KnowledgeC.n >= 150 &&
        p15KnowledgeC.fails.length === 0 &&
        p15KnowledgeOpen.fails.length === 0 &&
        p15Sources !== null &&
        p15Sources.size === "12px" &&
        p15Sources.color === "rgb(91, 111, 132)" &&
        p15SourcesRow !== undefined &&
        p15SourcesRow.bg === "#f5f7fa" &&
        p15SourcesRow.ratio >= 4.5 &&
        p15Sidebar?.ratio >= 10 &&
        p15Section?.ratio >= 6 &&
        p15Footer?.ratio >= 4.5,
      `home n=${p15HomeC.n} min=${p15HomeC.min} fails=${JSON.stringify(p15HomeC.fails)} gradients=${p15HomeC.gradients} disabledBelow=${p15HomeC.disabledBelow} | knowledge n=${p15KnowledgeC.n} min=${p15KnowledgeC.min} fails=${JSON.stringify(p15KnowledgeC.fails)} sources=${JSON.stringify(p15Sources)} row=${JSON.stringify(p15SourcesRow)} | sidebar=${JSON.stringify(p15Sidebar)} section=${JSON.stringify(p15Section)} footer=${JSON.stringify(p15Footer)}`,
    );

    // 5) Live region on save and `<html lang>` on the language change (A11Y-03 #2, I18N-01 #2/#3); the English UI
    //    carries no Spanish UI word (I18N-05, reverse leak).
    await page.goto(`${BASE}/app/settings`);
    await page.waitForLoadState("networkidle");
    await page.locator("[role=radio][lang=en]").first().click();
    await page.waitForSelector("[role=status]:has-text('Language updated')", { timeout: 15000 });
    const p15En = {
      lang: await page.evaluate(() => document.documentElement.lang),
      status: await page.locator("[role=status]").allInnerTexts(),
      title: await page.title(),
    };
    const p15EnLeaks = {};
    for (const path of ["/app/professional", "/app/professional/opportunities", "/app/settings"]) {
      await page.goto(`${BASE}${path}`);
      await page.waitForLoadState("networkidle");
      p15EnLeaks[path] = [
        ...new Set(
          (await page.locator("body").innerText()).match(
            new RegExp(P15_ES_SENTINELS.source, "g"),
          ) ?? [],
        ),
      ];
    }
    await page.goto(`${BASE}/app/settings`);
    await page.waitForLoadState("networkidle");
    await page.locator("[role=radio][lang=es]").first().click();
    await page.waitForSelector("[role=status]:has-text('Idioma actualizado')", { timeout: 15000 });
    const p15Es = {
      lang: await page.evaluate(() => document.documentElement.lang),
      status: await page.locator("[role=status]").allInnerTexts(),
    };
    ok(
      "PKG P15 5 A11Y-03 #2, I18N-01 #2/#3, I18N-05: choosing «English» answers in a `role=status` «Language updated.» with <html lang=en> and title «Settings · CrewFlex»; «Mi espacio», «Oportunidades» and «Configuración» in English carry no Spanish UI word; «Español» answers «Idioma actualizado.» with lang es",
      p15En.lang === "en" &&
        p15En.status.some((t) => t.trim() === "Language updated.") &&
        p15En.title === "Settings · CrewFlex" &&
        Object.values(p15EnLeaks).every((hits) => hits.length === 0) &&
        p15Es.lang === "es" &&
        p15Es.status.some((t) => t.trim() === "Idioma actualizado."),
      `${JSON.stringify(p15En)} leaks=${JSON.stringify(p15EnLeaks)} ${JSON.stringify(p15Es)}`,
    );

    // 6) ICU plural for one (I18N-04 #1/#3): the opportunities pager filtered to one title; Spanish sentinels on
    //    the list pages (I18N-05).
    await page.goto(`${BASE}/app/professional/opportunities`);
    await page.waitForLoadState("networkidle");
    await expectSpanish("PKG P15 6 «Oportunidades» in Spanish");
    const p15FirstTitle = await page.evaluate(
      () => document.querySelector("main article h2 a")?.textContent.trim() ?? null,
    );
    await page.goto(
      `${BASE}/app/professional/opportunities?q=${encodeURIComponent(p15FirstTitle ?? "")}`,
    );
    await page.waitForLoadState("networkidle");
    const p15PagerOne = (await page.locator("[role=status]").allInnerTexts()).map((t) => t.trim());
    await page.goto(`${BASE}/app/professional/applications`);
    await page.waitForLoadState("networkidle");
    await expectSpanish("PKG P15 6b «Mis candidaturas» in Spanish");
    ok(
      "PKG P15 6c I18N-04 #1/#3: filtering «Oportunidades» by the first card's title renders the ICU `one` arm «1 oportunidad · página 1 de 1» in a `role=status`",
      p15FirstTitle !== null && p15PagerOne.includes("1 oportunidad · página 1 de 1"),
      `title=${JSON.stringify(p15FirstTitle)} status=${JSON.stringify(p15PagerOne)}`,
    );

    // 7) Touch targets under touch emulation at 390 with Delta's session (A11Y-05 #1/#2/#8/#11/#12/#13).
    p15Touch = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    await p15Touch.addCookies(await ctx.cookies());
    const p15Tp = await p15Touch.newPage();
    const p15TouchAt = {};
    for (const path of [
      "/app/professional",
      "/app/professional/applications",
      "/app/tools/knowledge",
    ]) {
      await p15Tp.goto(`${BASE}${path}`);
      await p15Tp.waitForLoadState("networkidle");
      const targets = await p15Targets(p15Tp);
      p15TouchAt[path] = {
        n: targets.length,
        coarse: await p15Tp.evaluate(() => matchMedia("(pointer: coarse)").matches),
        small: p15Small(targets),
        excepted: targets.filter((t) => t.exception && (t.w < 44 || t.h < 44)).length,
        brand: targets.find((t) => t.tag === "a" && /CrewFlex/.test(t.name)),
      };
      if (path === "/app/professional") await p15Shot("touch-after-390", p15Tp);
    }
    // The open menu too.
    await p15Tp.goto(`${BASE}/app/professional`);
    await p15Tp.waitForLoadState("networkidle");
    await p15Tp.locator("aside button[aria-expanded]").tap();
    await p15Tp.waitForTimeout(200);
    const p15MenuTargets = await p15Targets(p15Tp);
    p15TouchAt.menu = {
      n: p15MenuTargets.length,
      expanded: await p15Tp.evaluate(() =>
        document.querySelector("aside button[aria-expanded]").getAttribute("aria-expanded"),
      ),
      small: p15Small(p15MenuTargets),
    };
    ok(
      "PKG P15 7 A11Y-05 #1/#2/#8/#11/#12/#13 (gap closed): under touch emulation (pointer: coarse) at 390 every visible interactive target on «Mi espacio», «Mis candidaturas», /app/tools/knowledge and in the open «Menú» (≥ 150 measured in all) is ≥ 44 × 44 px, the compact brand link included (36 px mark → 44 × 44); the only ones below are the documented exceptions: the sr-only skip link, links inside a sentence (WCAG 2.5.8) and the 41.7 px wide mini-calendar days (7 columns in 316 px, = v1.8)",
      Object.values(p15TouchAt).every((a) => a.small.length === 0) &&
        Object.values(p15TouchAt).reduce((s, a) => s + a.n, 0) >= 150 &&
        ["/app/professional", "/app/professional/applications", "/app/tools/knowledge"].every(
          (p) =>
            p15TouchAt[p].coarse && p15TouchAt[p].brand?.w >= 44 && p15TouchAt[p].brand?.h >= 44,
        ) &&
        p15TouchAt.menu.expanded === "true",
      JSON.stringify(
        Object.fromEntries(
          Object.entries(p15TouchAt).map(([k, a]) => [
            k,
            {
              n: a.n,
              coarse: a.coarse,
              small: a.small,
              excepted: a.excepted,
              brand: a.brand,
              expanded: a.expanded,
            },
          ]),
        ),
      ),
    );
    await p15Touch.close();
    p15Touch = null;
    await logout();

    // 8) admin.mro in Spanish: unique landmark names on the dashboard at 390 (dock «Accesos rápidos» + quick links
    //    «Accesos directos»), the ICU `other` arm on the requirements pager, no raw audit code in the activity trail
    //    (A11Y-01 #4, I18N-04 #3, I18N-05; gaps closed).
    await login(MRO);
    await page.goto(`${BASE}/app/settings`);
    await page.waitForLoadState("networkidle");
    await page.locator("[role=radio][lang=es]").first().click();
    await page.waitForSelector("[role=status]:has-text('Idioma actualizado')", { timeout: 15000 });
    await page.goto(`${BASE}/app/organization`);
    await page.waitForLoadState("networkidle");
    await expectSpanish("PKG P15 8 «Resumen» in Spanish");
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.waitForTimeout(250);
    const p15Org390 = await p15Landmarks();
    await p15Shot("org-after-390");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/app/organization/requirements`);
    await page.waitForLoadState("networkidle");
    const p15PagerMany = (await page.locator("[role=status]").allInnerTexts()).map((t) => t.trim());
    const p15Many = p15PagerMany
      .map((t) => /^(\d+) necesidades · página 1 de \d+$/.exec(t))
      .find(Boolean);
    await page.goto(`${BASE}/app/organization/settings`);
    await page.waitForLoadState("networkidle");
    const p15Activity = await page.evaluate(() => {
      const panel = [...document.querySelectorAll("main section")].find((s) =>
        /Actividad de esta organización/.test(s.querySelector("h2, h3")?.textContent ?? ""),
      );
      const labels = [...(panel?.querySelectorAll("li span.font-medium") ?? [])].map((s) =>
        s.textContent.trim(),
      );
      return {
        rows: labels.length,
        labels,
        raw: labels.filter((l) => /^[a-z]+\.[a-z_]+$/.test(l)),
      };
    });
    ok(
      "PKG P15 8b A11Y-01 #4, I18N-04 #3, I18N-05 (gaps closed): at 390 the organization dashboard shows two visible `nav`s with distinct names — the dock «Accesos rápidos» and the guide's «Accesos directos» (was «Accesos rápidos» twice) — and every visible nav name is unique; «Necesidades» renders the ICU `other` arm «N necesidades · página 1 de …» with N ≥ 2; the organization's activity trail (≥ 1 row) shows no raw audit code such as «requirement.archived»",
      p15Org390.visibleNavs.includes("Accesos rápidos") &&
        p15Org390.visibleNavs.includes("Accesos directos") &&
        new Set(p15Org390.visibleNavs).size === p15Org390.visibleNavs.length &&
        p15Many !== undefined &&
        Number(p15Many[1]) >= 2 &&
        p15Activity.rows >= 1 &&
        p15Activity.raw.length === 0,
      `navs=${JSON.stringify(p15Org390.visibleNavs)} pager=${JSON.stringify(p15PagerMany)} activity=${JSON.stringify(p15Activity)}`,
    );
    await logout();
  } finally {
    if (p15Touch) await p15Touch.close().catch(() => {});
    if (p15AnonCtx) await p15AnonCtx.close().catch(() => {});
    await page.setViewportSize({ width: 1440, height: 900 });
    if (/\/app/.test(page.url())) await logout().catch(() => {});
    const p15Restored = await Promise.all(
      [DELTA, MRO].map(
        async (email) =>
          (await asSeedUser(email, "user-preferences", { method: "PATCH", body: { locale: "en" } }))
            .ok === true,
      ),
    );
    await ctx.clearCookies({ name: "crewflex-locale" });
    ok(
      "PKG P15 9 restore: Delta and admin.mro in English, locale cookie cleared, touch and anonymous contexts closed, viewport reset",
      p15Restored.every(Boolean),
      String(p15Restored),
    );
  }
}

// PKG v2-16 (professional block, migration 20261024800000, T-160): a need of an organization Delta blocks in
// the passport leaves «Opportunities» (page, API list and detail) and cannot be applied to (409
// ORGANIZATION_BLOCKED, «This organization is blocked.»); unblocking restores it. The need is created through
// the local API (setup only); Delta's passport is restored and the need closed at the end whatever happens.
const pbTitle = `Local UI check · blocked employer ${Date.now()}`;
const pbCreated = await asSeedUser("admin.mro@crewflex.test", "work-requirements", {
  method: "POST",
  headers: { "Idempotency-Key": crypto.randomUUID() },
  body: {
    organizationId: mroOrg.id,
    title: pbTitle,
    location: "Madrid (MAD)",
    startsAt: "2026-12-14T06:00:00.000Z",
    endsAt: "2026-12-15T18:00:00.000Z",
    shift: "day",
    headcount: 1,
    urgency: "planned",
    qualifications: hiringTypes.map((q) => ({ qualificationTypeId: q.id, level: "hard" })),
  },
});
const pbId = pbCreated.data?.requirement?.id;
const pbSeedPassport = (await asSeedUser("delta@crewflex.test", "professional-profile")).data
  .profile;
const pbListed = async () => {
  const list = await asSeedUser("delta@crewflex.test", "opportunities", { query: { q: pbTitle } });
  const detail = await asSeedUser("delta@crewflex.test", "opportunities", { query: { id: pbId } });
  return {
    inList: (list.data?.opportunities ?? []).some((o) => o.requirement.id === pbId),
    detail: detail.ok ? "ok" : (detail.error?.code ?? "?"),
  };
};
const pbPage = async () => {
  await page.goto(`${BASE}/app/professional/opportunities?q=${encodeURIComponent(pbTitle)}`);
  await page.waitForLoadState("networkidle");
  return await page.locator("main").innerText();
};
const pbSetBlock = async (blocked) => {
  await page.goto(`${BASE}/app/professional/profile`);
  await page.waitForLoadState("networkidle");
  await passportBox("blockedOrganizationIds", "Demo MRO Madrid").setChecked(blocked);
  await page.click("main form button[type=submit]");
  await page.waitForSelector("[role=status]:has-text('Passport updated')", { timeout: 15000 });
};
try {
  await login("delta@crewflex.test");
  const pbBefore = await pbListed();
  ok(
    "PKG v2-16 1 before the block: Delta lists the Demo MRO Madrid need (page, API list and detail)",
    Boolean(pbId) &&
      new RegExp(pbTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(await pbPage()) &&
      pbBefore.inList &&
      pbBefore.detail === "ok",
    JSON.stringify({ pbId, ...pbBefore }),
  );
  await pbSetBlock(true);
  const pbBlocked = await pbListed();
  const pbApply = await asSeedUser("delta@crewflex.test", "applications", {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: { requirementId: pbId, shareConsent: true },
  });
  ok(
    "PKG v2-16 2 blocked: the need left «Opportunities» (page, API list, detail 404); applying is 409 ORGANIZATION_BLOCKED",
    !new RegExp(pbTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(await pbPage()) &&
      !pbBlocked.inList &&
      pbBlocked.detail === "NOT_FOUND" &&
      pbApply.ok === false &&
      pbApply.error?.code === "CONFLICT" &&
      pbApply.error?.reason === "ORGANIZATION_BLOCKED",
    JSON.stringify({ ...pbBlocked, apply: pbApply.error ?? "ok" }),
  );
  await pbSetBlock(false);
  const pbAfter = await pbListed();
  ok(
    "PKG v2-16 3 unblocked: the need is back in «Opportunities» (page, API list and detail)",
    new RegExp(pbTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(await pbPage()) &&
      pbAfter.inList &&
      pbAfter.detail === "ok",
    JSON.stringify(pbAfter),
  );
} finally {
  await logout();
  // Seed state back whatever happened: Delta's passport (no block) and the need closed and archived.
  const pbNow = (await asSeedUser("delta@crewflex.test", "professional-profile")).data?.profile;
  const pbRestore = { ...pbSeedPassport, expectedUpdatedAt: pbNow?.updatedAt };
  delete pbRestore.updatedAt;
  const pbRestored = await asSeedUser("delta@crewflex.test", "professional-profile", {
    method: "PATCH",
    body: pbRestore,
  });
  const pbClosed = pbId
    ? await asSeedUser("admin.mro@crewflex.test", "work-requirements", {
        method: "PATCH",
        body: { id: pbId, status: "closed" },
      })
    : { ok: false };
  const pbArchived = pbClosed.ok
    ? await asSeedUser("admin.mro@crewflex.test", "work-requirements", {
        method: "PATCH",
        body: { id: pbId, archive: true },
      })
    : { ok: false };
  ok(
    "PKG v2-16 4 seed state restored: Delta's passport without the block, the need closed and archived",
    pbRestored.ok === true &&
      (pbRestored.data?.profile?.blockedOrganizationIds ?? []).length === 0 &&
      pbArchived.ok === true,
    JSON.stringify({
      passport: pbRestored.error?.code ?? "ok",
      closed: pbClosed.error?.code ?? "ok",
      archived: pbArchived.error?.code ?? "ok",
    }),
  );
}

// PKG notices (v2-18, migration 20261023800000): in-app notices for both sides. Setup through the
// local API (need, Delta's window, the application, the shortlist); every read and mark is a click.
const noticeTitle = `Local UI check · notices ${Date.now()}`;
const noticeNeed = await asSeedUser("admin.mro@crewflex.test", "work-requirements", {
  method: "POST",
  headers: { "Idempotency-Key": crypto.randomUUID() },
  body: {
    organizationId: mroOrg.id,
    title: noticeTitle,
    location: "Madrid (MAD)",
    startsAt: "2026-12-21T06:00:00.000Z",
    endsAt: "2026-12-22T18:00:00.000Z",
    shift: "day",
    headcount: 1,
    urgency: "planned",
    qualifications: hiringTypes.map((q) => ({ qualificationTypeId: q.id, level: "hard" })),
  },
});
const noticeNeedId = noticeNeed.data.requirement.id;
const noticeWindow = await asSeedUser("delta@crewflex.test", "professional-availability", {
  method: "POST",
  headers: { "Idempotency-Key": crypto.randomUUID() },
  body: {
    startsAt: "2026-12-21T00:00:00.000Z",
    endsAt: "2026-12-23T00:00:00.000Z",
    status: "available",
  },
});
const noticeApplication = await asSeedUser("delta@crewflex.test", "applications", {
  method: "POST",
  headers: { "Idempotency-Key": crypto.randomUUID() },
  body: { requirementId: noticeNeedId, shareConsent: true },
});
const noticeApplicationId = noticeApplication.data.application.id;
await login("admin.mro@crewflex.test");
await page.goto(`${BASE}/app/notices`);
await page.waitForLoadState("networkidle");
const bellLabel = () =>
  page.locator("a[href='/app/notices'][aria-label]").first().getAttribute("aria-label");
const newApplicationCard = page.locator("main article", { hasText: noticeTitle });
ok(
  "PKG notices a: the organization is told of the new application (pseudonym, «New»), the bell counts it",
  /Notices: \d+ unread/.test((await bellLabel()) ?? "") &&
    /New application/.test(await newApplicationCard.innerText()) &&
    /Anonymous professional CF-[0-9A-F]{10}/.test(await newApplicationCard.innerText()) &&
    (await newApplicationCard.getByText("New", { exact: true }).count()) === 1,
  "",
);
await page.getByRole("button", { name: "Mark all as read" }).click();
const allRead = await page
  .getByRole("status")
  .filter({ hasText: "All your notices are read." })
  .waitFor({ timeout: 15000 })
  .then(() => true)
  .catch(() => false);
await page.reload();
await page.waitForLoadState("networkidle");
const readChips = await newApplicationCard.getByText("New", { exact: true }).count();
await newApplicationCard.getByRole("button", { name: "View applications" }).click();
const ledToApplications = await page
  .waitForURL((u) => u.pathname === `/app/organization/requirements/${noticeNeedId}/applications`, {
    timeout: 20000,
  })
  .then(() => true)
  .catch(() => false);
ok(
  "PKG notices b: «Mark all as read» empties the bell and the «New» chips; the notice leads to the applications",
  allRead && readChips === 0 && ledToApplications,
  "",
);
await logout();
const noticeOrgView = await asSeedUser("admin.mro@crewflex.test", "applications", {
  query: { requirementId: noticeNeedId },
});
await asSeedUser("admin.mro@crewflex.test", "applications", {
  method: "PATCH",
  headers: { "Idempotency-Key": crypto.randomUUID() },
  body: {
    applicationId: noticeApplicationId,
    to: "shortlisted",
    expectedUpdatedAt: noticeOrgView.data.applications[0].updatedAt,
  },
});
await login("delta@crewflex.test");
await page.goto(`${BASE}/app/notices`);
await page.waitForLoadState("networkidle");
const updateCard = page.locator("main article", { hasText: noticeTitle });
ok(
  "PKG notices c: the technician reads «Application update · {need} · Demo MRO Madrid · Shortlisted» (no raw code)",
  /Application update/.test(await updateCard.innerText()) &&
    /Demo MRO Madrid · Shortlisted/.test(await updateCard.innerText()) &&
    !/shortlisted/.test(await updateCard.innerText()),
  "",
);
await updateCard.getByRole("button", { name: "View application" }).click();
await page.waitForURL((u) => u.pathname === "/app/professional/applications", { timeout: 20000 });
const landedOnCard = page.url().endsWith(`#a-${noticeApplicationId}`);
await page.goto(`${BASE}/app/notices`);
await page.waitForLoadState("networkidle");
ok(
  "PKG notices d: «View application» marks the notice read and lands on the technician's card",
  landedOnCard && (await updateCard.getByText("New", { exact: true }).count()) === 0,
  "",
);
await logout();
// Restore: withdraw, free Delta's days, close the need (its notices go with the cleanup script).
const noticeMine = await asSeedUser("delta@crewflex.test", "applications");
await asSeedUser("delta@crewflex.test", "applications", {
  method: "PATCH",
  headers: { "Idempotency-Key": crypto.randomUUID() },
  body: {
    applicationId: noticeApplicationId,
    to: "withdrawn",
    expectedUpdatedAt: noticeMine.data.applications.find((a) => a.id === noticeApplicationId)
      .updatedAt,
  },
});
await asSeedUser("delta@crewflex.test", "professional-availability", {
  method: "DELETE",
  query: { id: noticeWindow.data.window.id },
});
await asSeedUser("admin.mro@crewflex.test", "work-requirements", {
  method: "PATCH",
  body: { id: noticeNeedId, status: "closed" },
});
for (const email of ["delta@crewflex.test", "manager.mro@crewflex.test"]) {
  await asSeedUser(email, "notifications", { method: "PATCH", body: { all: true } });
}

// PKG requirement-builder (v2-09/10/12/13/14, defaults T-60…T-66): shifts, country and zone, terms without real
// money, «Review before publishing» with the live count and the preview, autosave, a draft saved then published,
// the opportunity card, duplicate (nothing saved) and close + archive (one way). The need it creates ends closed
// and archived (requirements are never deleted), so nothing published is left behind.
const rbTitle = `Local UI check · builder ${Date.now()}`;
const rbDay = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
await login("admin.mro@crewflex.test");
await page.goto(`${BASE}/app/organization/requirements/new`);
await page.waitForLoadState("networkidle");
await page.evaluate(() => localStorage.clear());
await page.fill("#title", rbTitle);
await page.waitForTimeout(800); // v1.8 `useDraft`: autosaved after 350 ms
await page.reload();
await page.waitForLoadState("networkidle");
await page.getByRole("button", { name: "Restore" }).click();
ok(
  "prb1 autosave: a reload offers the unsaved draft and «Restore» brings it back",
  (await page.locator("#title").inputValue()) === rbTitle,
);
await page.fill("#location", "Madrid (MAD)");
for (const n of [40, 41, 42]) {
  await page.fill("#nextShiftStart", `${rbDay(n)}T08:00`);
  await page.fill("#nextShiftEnd", `${rbDay(n)}T16:00`);
  await page.fill("#nextShiftHours", "8");
  await page.getByRole("button", { name: "Add shift" }).click();
}
await page.locator("label:has-text('B1.1')").first().click();
await page.locator("label:has-text('TR-A320')").first().click();
const rbAside = page.getByRole("complementary", { name: "Review before publishing" });
await rbAside
  .getByText(/candidates? with viable requirements and blocks/)
  .waitFor({ timeout: 15_000 })
  .catch(() => {});
const rbAsideText = await rbAside.innerText();
ok(
  "prb2 builder: 3 shifts, «24 base hours in 3 shifts», Spain, €400 / shift of 8 h and the live count",
  /24 base hours/.test(await page.locator("main").innerText()) &&
    /Madrid \(MAD\) · Spain/.test(rbAsideText) &&
    /€400 \/ shift of 8 h/.test(rbAsideText) &&
    /3 shifts required/.test(rbAsideText) &&
    /\d+ candidates? with viable requirements and blocks/.test(rbAsideText),
  rbAsideText.replace(/\n/g, " | ").slice(0, 200),
);
await page.getByRole("button", { name: "Preview requirements" }).click();
const rbPreview = await page.locator("dialog[open]").innerText();
await page.keyboard.press("Escape");
ok(
  "prb3 preview: the sheet as published (rate, logistics, full block), Escape closes it",
  /€50 \/ h · €400 \/ day/.test(rbPreview) &&
    /Flights: included/.test(rbPreview) &&
    /Full block/.test(rbPreview) &&
    (await page.locator("dialog[open]").count()) === 0,
  rbPreview.replace(/\n/g, " | ").slice(0, 200),
);
await responsiveShots("pkg-requirement-builder-form");
await page.getByRole("button", { name: "Save draft" }).click();
await page.waitForURL((u) => /\/requirements\/[0-9a-f-]{36}$/.test(u.pathname), { timeout: 30000 });
await page.waitForLoadState("networkidle");
const rbId = page.url().split("/").pop();
const rbDraftText = await page.locator("main").innerText();
ok(
  "prb4 «Save draft»: a draft, not published nor evaluated, with «Complete and publish»",
  /This draft is neither published nor evaluated/.test(rbDraftText) &&
    (await page.getByRole("link", { name: "Complete and publish" }).count()) === 1 &&
    !/Internal workforce/.test(rbDraftText),
);
await page.getByRole("button", { name: "Publish", exact: true }).click();
await page.getByText("Requirement published").waitFor({ timeout: 15_000 });
await page.reload();
await page.waitForLoadState("networkidle");
await page.getByText("Coverage per shift").click();
const rbOpenText = await page.locator("main").innerText();
ok(
  "prb5 published: terms, logistics and «Coverage per shift · 0/1 seats confirmed» on the detail",
  /€50 \/ h · €400 \/ day/.test(rbOpenText) &&
    /Contractor · EUR/.test(rbOpenText) &&
    /0\/1 seats confirmed/.test(rbOpenText) &&
    /Europe\/Madrid/.test(rbOpenText),
  rbOpenText.slice(0, 160),
);
await shot("pkg-requirement-builder-detail");
await logout();
await login("delta@crewflex.test");
await page.goto(`${BASE}/app/professional/opportunities?q=${encodeURIComponent(rbTitle)}`);
await page.waitForLoadState("networkidle");
const rbCard = await page.locator("main article").first().innerText();
ok(
  "prb6 opportunity card: «{base} · {country}», «€400 / day · €50 / h», 3 shifts · 24 base hours, full block",
  /Madrid \(MAD\) · Spain/.test(rbCard) &&
    /€400 \/ day · €50 \/ h/.test(rbCard) &&
    /3 shifts · 24 base hours/.test(rbCard) &&
    /Full block/.test(rbCard),
  rbCard.replace(/\n/g, " | ").slice(0, 200),
);
await logout();
await login("admin.mro@crewflex.test");
await page.goto(`${BASE}/app/organization/requirements/${rbId}`);
await page.waitForLoadState("networkidle");
await page.getByRole("link", { name: "Duplicate" }).click();
await page.waitForURL(/\/requirements\/new\?from=/);
await page.waitForLoadState("networkidle");
ok(
  "prb7 duplicate: the builder prefilled with «Copy · {title}», nothing saved",
  (await page.locator("#title").inputValue()) === `Copy · ${rbTitle}`.slice(0, 120) &&
    (await page.locator("main").innerText()).includes("Duplicate requirement"),
);
await page.evaluate(() => localStorage.clear());
await page.goto(`${BASE}/app/organization/requirements/${rbId}`);
await page.waitForLoadState("networkidle");
await page.getByRole("button", { name: "Close requirement" }).click();
await page.getByRole("button", { name: "Yes, close it" }).click();
await page.getByText("can no longer be reopened").waitFor({ timeout: 15_000 });
await page.getByRole("button", { name: "Archive" }).click();
await page.getByRole("button", { name: "Yes, archive it" }).click();
await page.getByText("Requirement archived").waitFor({ timeout: 15_000 });
await page.reload();
await page.waitForLoadState("networkidle");
const rbArchivedNote = await page.locator("main").innerText();
const rbArchiveButtons = await page.getByRole("button", { name: "Archive" }).count();
await page.goto(`${BASE}/app/organization/requirements`);
await page.waitForLoadState("networkidle");
const rbActiveList = await page.locator("main").innerText();
await page.goto(`${BASE}/app/organization/requirements?archived=1`);
await page.waitForLoadState("networkidle");
ok(
  "prb8 archive (one way): closed then archived, gone from the list, under «View archived»",
  /This requirement is archived/.test(rbArchivedNote) &&
    rbArchiveButtons === 0 &&
    !rbActiveList.includes(rbTitle) &&
    (await page.locator("main").innerText()).includes(rbTitle),
);
await logout();
// PKG account (v2 diff 10 «Backlog derivado» #2–#4, #20; English UI). Needs the stack restarted with
// this branch's supabase/config.toml (local e-mail confirmation) and Mailpit at MAILPIT_URL. Leaves no
// data: the one account it creates is closed at the end (its audit rows stay, by design).
{
  const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:56324";
  const mainText = () => page.locator("main").innerText();

  // a) #20 platform role in Settings; with the flag off the «Invite» panel says sign-up is open.
  await login("platform.admin@crewflex.test");
  await page.goto(`${BASE}/app/settings`);
  await page.waitForLoadState("networkidle");
  const adminSettings = await mainText();
  await page.goto(`${BASE}/app/admin`);
  await page.waitForLoadState("networkidle");
  ok(
    "PKG account a: Settings shows «Platform role: Platform admin»; /app/admin «Invite» is off (open sign-up)",
    /Platform role/i.test(adminSettings) &&
      /Platform admin/.test(adminSettings) &&
      /Sign-up is open in this environment/.test(await mainText()),
    "",
  );
  await logout();

  // b) #4 export: own records only, as a JSON attachment.
  await login("delta@crewflex.test");
  await page.goto(`${BASE}/app/settings`);
  await page.waitForLoadState("networkidle");
  const dataPanel = await mainText();
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 20000 }).catch(() => null),
    page.getByRole("link", { name: "Export my data and files" }).click(),
  ]);
  await page.waitForSelector("[role=status]:has-text('Export ready.')", { timeout: 20000 });
  const exportedName = download?.suggestedFilename();
  const exported = await page.request.get(`${BASE}/app/settings/export`);
  const body = exported.ok() ? await exported.json() : null;
  ok(
    "PKG account b: «Your data» → «Export ready.», a JSON attachment with the caller's own data only",
    /Your data/.test(dataPanel) &&
      exportedName === "CrewFlex-my-data.json" &&
      /Export my data and files/.test(dataPanel) &&
      /attachment/.test(exported.headers()["content-disposition"] ?? "") &&
      body?.format === "crewflex-account-export/1" &&
      body?.account?.email === "delta@crewflex.test" &&
      Array.isArray(body?.professional?.qualifications) &&
      !/alpha@crewflex\.test|admin\.mro@crewflex\.test/.test(JSON.stringify(body)),
    `status=${exported.status()}`,
  );
  await logout();

  // c) #3 a forged or reused sign-up link lands on the login with its own notice (not the reset form).
  await page.goto(`${BASE}/auth/confirm?token_hash=x&type=signup&next=/app`);
  await page.waitForLoadState("networkidle");
  ok(
    "PKG account c: a bad sign-up link → /login?confirmError=1 with its notice",
    new URL(page.url()).pathname === "/login" &&
      /expired, was already used or is not valid/.test(await mainText()),
    page.url(),
  );

  // d) #2 off / #3: open sign-up unchanged (account type, no code); an existing address is not
  //    enumerated; a new one gets the confirmation e-mail, whose link lands on the login.
  await page.goto(`${BASE}/register`);
  await page.waitForLoadState("networkidle");
  const openForm =
    (await page.locator("input[name=accountType]").count()) === 2 &&
    (await page.locator("#invitationCode").count()) === 0;
  const register = async (email) => {
    await page.goto(`${BASE}/register`);
    await page.waitForLoadState("networkidle");
    await page.check("input[name=accountType][value=professional]");
    await page.fill("#displayName", "Smoke Close");
    await page.fill("#email", email);
    await page.fill("#password", `${PW}-close`);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForSelector("[role=status]:has-text('Check your inbox')", { timeout: 20000 });
  };
  await register("delta@crewflex.test"); // existing: the same answer as a new address
  const email = `smoke-close-${Date.now()}@crewflex.test`;
  await register(email);
  let link = null;
  for (let i = 0; i < 20 && !link; i++) {
    await page.waitForTimeout(500);
    const found = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
    ).then(
      (r) => (r.ok ? r.json() : null),
      () => null,
    );
    const id = found?.messages?.[0]?.ID;
    if (!id) continue;
    const message = await fetch(`${MAILPIT}/api/v1/message/${id}`).then((r) => r.json());
    link = /href="([^"]+)"/.exec(message.HTML ?? "")?.[1]?.replaceAll("&amp;", "&") ?? null;
  }
  if (link) {
    await page.goto(link);
    await page.waitForURL((u) => u.pathname === "/login", { timeout: 20000 });
  }
  ok(
    "PKG account d: open sign-up form unchanged; Mailpit link → login «E-mail confirmed»",
    openForm && Boolean(link) && /E-mail confirmed/.test(await mainText()),
    link ? page.url() : "no e-mail in Mailpit",
  );

  // e) #4 close: the word of the UI language, then the account is gone and cannot sign in.
  if (link) {
    await page.fill("#email", email);
    await page.fill("#password", `${PW}-close`);
    await page.click("button[type=submit]");
    await page.waitForURL((u) => u.pathname.startsWith("/app/"), { timeout: 30000 });
    await page.goto(`${BASE}/app/settings`);
    await page.waitForLoadState("networkidle");
    if ((await page.evaluate(() => document.documentElement.lang)) !== "en") {
      await page.locator("[role=radio][lang=en]").first().click();
      await page.waitForSelector("[role=status]:has-text('Language updated')", { timeout: 15000 });
    }
    await page.locator("summary", { hasText: "Close account" }).click();
    await page.fill("#confirm", "CERRAR");
    await page.getByRole("button", { name: "Close my account" }).click();
    await page.waitForSelector("text=Type CLOSE to confirm.", { timeout: 15000 });
    await page.fill("#confirm", "CLOSE");
    await page.getByRole("button", { name: "Close my account" }).click();
    await page.waitForURL((u) => u.pathname === "/login", { timeout: 30000 });
    const closedNotice = /Account closed\./.test(await mainText());
    await page.fill("#email", email);
    await page.fill("#password", `${PW}-close`);
    await page.click("button[type=submit]");
    // Not a bare [role=alert]: the route announcer is one too and resolves first («Sign in»).
    await page.waitForSelector("[role=alert]:has-text('incorrect')", { timeout: 15000 });
    ok(
      "PKG account e: «Type CLOSE» refuses another word; closed → «Account closed.»; sign-in refused",
      closedNotice && /Email or password is incorrect/.test(await mainText()),
      `closed notice ${closedNotice} · alert «${await page.locator("[role=alert]").first().innerText()}»`,
    );
  } else {
    ok("PKG account e: account closure (skipped: no confirmation e-mail)", false, "");
  }
}

// PKG hiring-polish (v2-05, v2-08, v2-20, v2-21, v2-25, v2-26, v2-27; migrations 20261024100000/100100,
// defaults T-90…T-95; English UI). Setup through the local API (a 2-seat need, Delta and Alpha windows,
// Delta confirmed); every check after that is a page. Restores: the assignment is cancelled, the need
// closed, both windows deleted.
{
  const hpTitle = `Local UI check · hiring polish ${Date.now()}`;
  const hpPeriod = { startsAt: "2027-01-11T06:00:00.000Z", endsAt: "2027-01-12T18:00:00.000Z" };
  const hpWindow = { startsAt: "2027-01-11T00:00:00.000Z", endsAt: "2027-01-13T00:00:00.000Z" };
  const hpNeed = await asSeedUser("admin.mro@crewflex.test", "work-requirements", {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: {
      organizationId: mroOrg.id,
      title: hpTitle,
      location: "Madrid (MAD)",
      ...hpPeriod,
      shift: "day",
      headcount: 2,
      urgency: "planned",
      qualifications: hiringTypes.map((q) => ({ qualificationTypeId: q.id, level: "hard" })),
    },
  });
  const hpId = hpNeed.data?.requirement.id;
  const hpWindows = [];
  for (const email of ["delta@crewflex.test", "alpha@crewflex.test"]) {
    const w = await asSeedUser(email, "professional-availability", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: { ...hpWindow, status: "available" },
    });
    hpWindows.push({ email, id: w.data?.window.id });
  }
  const hpApplied = await asSeedUser("delta@crewflex.test", "applications", {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: { requirementId: hpId, shareConsent: true },
  });
  const hpApp = {
    id: hpApplied.data?.application.id,
    updatedAt: hpApplied.data?.application.updatedAt,
  };
  const hpMove = async (email, to, extra = {}) => {
    const res = await asSeedUser(email, "applications", {
      method: "PATCH",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: { applicationId: hpApp.id, to, expectedUpdatedAt: hpApp.updatedAt, ...extra },
    });
    if (res.data) hpApp.updatedAt = res.data.transition.updatedAt;
    return res;
  };
  await hpMove("admin.mro@crewflex.test", "shortlisted");
  const hpProposed = await hpMove("admin.mro@crewflex.test", "proposed");
  await hpMove("delta@crewflex.test", "accepted", {
    proposalId: hpProposed.data?.transition.proposalId,
    acceptTerms: true,
  });
  const hpConfirmed = await hpMove("admin.mro@crewflex.test", "confirmed");
  ok(
    "PKG hiring-polish 0 setup (API): a 2-seat need with Delta confirmed",
    hpConfirmed.data?.transition.status === "confirmed",
    JSON.stringify(hpConfirmed.error ?? ""),
  );

  // v2-27 (T-90): a member never applies to its own organization's need (API), nor sees it listed.
  const hpOwn = await asSeedUser("alpha@crewflex.test", "applications", {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: { requirementId: hpId, shareConsent: true },
  });
  await login("alpha@crewflex.test");
  await page.goto(`${BASE}/app/professional/opportunities?q=${encodeURIComponent(hpTitle)}`);
  await page.waitForLoadState("networkidle");
  ok(
    "PKG hiring-polish 1 own organization: apply refused (409 OWN_ORGANIZATION), not in «Opportunities»",
    hpOwn.error?.reason === "OWN_ORGANIZATION" &&
      /No requirements for this filter/.test(await page.locator("main").innerText()),
    JSON.stringify(hpOwn.error ?? hpOwn.data ?? ""),
  );
  await logout();

  // v2-26: the search by a required qualification's code (API, 50 rows: the need is far in the future)
  // and the card buttons as v1.8.
  const hpByCode = await asSeedUser("delta@crewflex.test", "opportunities", {
    query: { q: "tr-a320", limit: "50" },
  });
  await login("delta@crewflex.test");
  await page.goto(`${BASE}/app/professional/opportunities?q=${encodeURIComponent(hpTitle)}`);
  await page.waitForLoadState("networkidle");
  const hpCard = page.locator("main article", { hasText: hpTitle }).first();
  ok(
    "PKG hiring-polish 2 «Opportunities»: found by «tr-a320»; «View details» + «Already applied» (disabled)",
    (hpByCode.data?.opportunities ?? []).some((o) => o.requirement.id === hpId) &&
      (await hpCard.count()) === 1 &&
      (await hpCard.getByRole("link", { name: "View details" }).count()) === 1 &&
      (await hpCard.getByRole("button", { name: "Already applied" }).isDisabled()),
    `${hpByCode.data?.total ?? JSON.stringify(hpByCode.error)} found by code`,
  );
  await logout();

  await login("admin.mro@crewflex.test");
  // v2-05: «Applications» and «Offers in the network» in the organization menu, after «Requirements».
  const hpNav = await page
    .locator("aside a[href^='/app/organization']")
    .evaluateAll((links) => [...new Set(links.map((a) => a.getAttribute("href")))]);
  const at = (href) => hpNav.indexOf(href);
  ok(
    "PKG hiring-polish 3 menu: Requirements → Find candidates → Applications → Offers in the network",
    at("/app/organization/requirements") >= 0 &&
      at("/app/organization/candidates") === at("/app/organization/requirements") + 1 &&
      at("/app/organization/applications") === at("/app/organization/candidates") + 1 &&
      at("/app/organization/network") === at("/app/organization/applications") + 1,
    hpNav.join(" "),
  );
  // v2-08: «{p}% confirmed coverage» + «Manage applications» on the list row.
  await page.goto(`${BASE}/app/organization/requirements`);
  await page.waitForLoadState("networkidle");
  const hpRow = page.locator("main tr", { hasText: hpTitle }).first();
  const hpRowText = await hpRow.innerText().catch(() => "");
  ok(
    "PKG hiring-polish 4 list: «50% confirmed coverage» and «Manage applications» on the row",
    /50% confirmed coverage/.test(hpRowText) &&
      (await hpRow.getByRole("link", { name: "Manage applications" }).getAttribute("href")) ===
        `/app/organization/applications?requirementId=${hpId}`,
    hpRowText.replace(/\s+/g, " ").slice(0, 200),
  );
  await page.goto(`${BASE}/app/organization/requirements/${hpId}`);
  await page.waitForLoadState("networkidle");
  const hpDetail = await page.locator("main").innerText();
  ok(
    "PKG hiring-polish 5 detail: «50% confirmed coverage» and «1 / 2 seats confirmed»",
    /50% confirmed coverage/.test(hpDetail) && /1 \/ 2 seats confirmed/.test(hpDetail),
    "",
  );
  // v2-05: the organization-wide list filtered by the offer, with the per-requirement actions.
  await page.goto(`${BASE}/app/organization/applications?requirementId=${hpId}`);
  await page.waitForLoadState("networkidle");
  const hpApps = await page.locator("main").innerText();
  const hpAppCard = page.locator(`main article#a-${hpApp.id}`);
  ok(
    "PKG hiring-polish 6 «Applications»: selected offer, View all, Back to offers, «All (1)», 9 tabs, the card",
    hpApps.includes(`Selected offer: ${hpTitle}`) &&
      (await page.getByRole("link", { name: "View all" }).count()) === 1 &&
      (await page.getByRole("link", { name: "Back to offers" }).count()) === 1 &&
      (await page.locator("main nav a").count()) === 10 &&
      /All \(1\)/.test(hpApps) &&
      /Confirmed/.test(await hpAppCard.innerText()) &&
      (await hpAppCard.getByRole("link", { name: hpTitle }).count()) === 1,
    hpApps.replace(/\s+/g, " ").slice(0, 200),
  );
  // v2-26: the cancel step explains what it does (opened, then backed out: nothing is sent).
  await hpAppCard.getByRole("button", { name: "Cancel assignment" }).click();
  // `<details>` (History) is a group too: name the confirmation step.
  const hpCancelStep = hpAppCard.getByRole("group", { name: "Cancel assignment" });
  const hpHint = await hpCancelStep.innerText();
  await hpCancelStep.getByRole("button", { name: "Back" }).click();
  ok(
    "PKG hiring-polish 7 cancel assignment hint «Seats will be released…» (backed out)",
    /Seats will be released and the technician's previous availability restored/.test(hpHint),
    hpHint.slice(0, 120),
  );
  await page.goto(`${BASE}/app/organization/applications?status=withdrawn&requirementId=${hpId}`);
  await page.waitForLoadState("networkidle");
  ok(
    "PKG hiring-polish 8 an empty tab: «No applications in this status»",
    /No applications in this status/.test(await page.locator("main").innerText()),
    "",
  );
  // v2-21 + v2-08: the dashboard guide, quick links, note and «Shifts covered».
  await page.goto(`${BASE}/app/organization`);
  await page.waitForLoadState("networkidle");
  const hpDash = await page.locator("main").innerText();
  ok(
    "PKG hiring-polish 9 dashboard: «Shifts covered», «How to staff a requirement» (4 steps), quick links, note",
    /Shifts covered/i.test(hpDash) && // Metric labels are CSS-uppercased
      /How to staff a requirement/.test(hpDash) &&
      (await page.locator("main ol li").count()) >= 4 &&
      (await page.getByRole("link", { name: /Builder/ }).count()) === 1 &&
      (await page.getByRole("link", { name: /Candidate Packs/ }).count()) === 1 &&
      /the contract between the parties is agreed outside the platform/.test(hpDash),
    "",
  );
  // v2-20: the own offer is not in «Offers in the network»; another organization sees it, no eligibility.
  await page.goto(`${BASE}/app/organization/network?q=${encodeURIComponent(hpTitle)}`);
  await page.waitForLoadState("networkidle");
  const hpOwnNetwork = await page.locator("main").innerText();
  await logout();
  await login("admin.other@crewflex.test");
  await page.goto(`${BASE}/app/organization/network?q=${encodeURIComponent(hpTitle)}`);
  await page.waitForLoadState("networkidle");
  const hpNetCard = page.locator("main article", { hasText: hpTitle }).first();
  const hpNetText = await hpNetCard.innerText().catch(() => "");
  await hpNetCard.getByRole("link", { name: "View details" }).click();
  await page.waitForURL(/\/app\/organization\/network\/[0-9a-f-]{36}$/);
  const hpNetDetail = await page.locator("main").innerText();
  ok(
    "PKG hiring-polish 10 «Offers in the network»: own hidden; others see the card and detail, no eligibility or fee",
    /No requirements for this filter/.test(hpOwnNetwork) &&
      /Demo MRO Madrid/.test(hpNetText) &&
      !/requirements and availability|mandatory requirement/i.test(hpNetText) &&
      hpNetDetail.includes(hpTitle) &&
      /Published by Demo MRO Madrid/.test(hpNetDetail) &&
      !/commission|eligib/i.test(hpNetDetail),
    hpNetText.replace(/\s+/g, " ").slice(0, 160),
  );
  await logout();
  // v2-25: «Eligible only» is on by default (v1.8 «Solo elegibles con cobertura»).
  await login("manager.mro@crewflex.test");
  await page.goto(`${madUrl}/matches`);
  await page.waitForLoadState("networkidle");
  await page.locator("main article").first().waitFor({ timeout: 15_000 });
  ok(
    "PKG hiring-polish 11 matches: «Eligible only» ticked by default, 3 cards",
    (await page.locator('input[type=checkbox][name="eligible"]').isChecked()) &&
      (await page.locator("main article").count()) === 3,
    `${await page.locator("main article").count()} cards`,
  );
  await logout();

  // Restore: cancel the assignment (T-12 refuses closing it otherwise), close the need, drop windows.
  await hpMove("admin.mro@crewflex.test", "cancelled", { reason: "Local UI check: restore" });
  await asSeedUser("admin.mro@crewflex.test", "work-requirements", {
    method: "PATCH",
    body: { id: hpId, status: "closed" },
  });
  for (const w of hpWindows)
    if (w.id)
      await asSeedUser(w.email, "professional-availability", {
        method: "DELETE",
        query: { id: w.id },
      });
}
// PKG wallet-extras (N-19 trash, N-20 type filter, N-21 in-app viewer, N-26 server floor; migrations
// 20261024200000/200100, T-100…T-104): Delta uploads a PNG course and a PDF licence, filters by type,
// views both in the app (an expired link is an error, Escape returns the focus), archives, restores and
// deletes permanently from the trash; the availability API refuses a start on a past day. Nothing is kept.
await login("delta@crewflex.test");
const WX = `${BASE}/app/professional/documents`;
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const wxUpload = async (title, kind, file) => {
  await page.goto(WX);
  await page.waitForLoadState("networkidle");
  await page.setInputFiles("#file", file);
  await page.fill("#title", title);
  await page.selectOption("#kind", kind);
  await page.getByRole("button", { name: "Upload document" }).click();
  await page.locator("main li", { hasText: title }).waitFor({ timeout: 15_000 });
};
await wxUpload("Smoke viewer image", "course", {
  name: "smoke.png",
  mimeType: "image/png",
  buffer: PNG_1PX,
});
await wxUpload("Smoke viewer pdf", "license", {
  name: "smoke.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\n%smoke viewer\n%%EOF\n"),
});
const wxChips = page.getByRole("group", { name: "Filter by type" });
const wxLabels = await wxChips.getByRole("button").allInnerTexts();
await wxChips.getByRole("button", { name: "Courses" }).click();
const wxCourses = {
  pressed: await wxChips.getByRole("button", { name: "Courses" }).getAttribute("aria-pressed"),
  heading: await page.locator("main h2", { hasText: "Your documents" }).innerText(),
  rows: await page.locator("main li").allInnerTexts(),
};
ok(
  "PKG wallet-extras 1 type filter: «All · Licences · Courses · Other» (aria-pressed), the counter follows it",
  wxLabels.join("|") === "All|Licences|Courses|Other" &&
    wxCourses.pressed === "true" &&
    wxCourses.heading === "Your documents (1)" &&
    wxCourses.rows.length === 1 &&
    /Smoke viewer image/.test(wxCourses.rows[0] ?? ""),
  `${wxLabels.join("|")} · ${wxCourses.heading}`,
);
await wxChips.getByRole("button", { name: "All" }).click();

const wxImageRow = page.locator("main li", { hasText: "Smoke viewer image" });
const wxCsp = cspViolations.length;
await wxImageRow.getByRole("button", { name: "Open" }).click();
const wxDialog = page.getByRole("dialog", { name: "Smoke viewer image" });
await wxDialog.locator("img").waitFor({ timeout: 15_000 });
const wxDecoded = await wxDialog
  .locator("img")
  .evaluate((img) => img.complete && img.naturalWidth === 1 && img.src.startsWith("blob:"));
await page.keyboard.press("Escape");
await wxDialog.waitFor({ state: "detached", timeout: 5_000 });
const wxFocusBack = await wxImageRow
  .getByRole("button", { name: "Open" })
  .evaluate((el) => el === document.activeElement);
ok(
  "PKG wallet-extras 2 viewer: the PNG shows in a dialog from a blob; Escape closes it and the focus is back on «Open»",
  wxDecoded && wxFocusBack,
  `decoded=${wxDecoded} focus=${wxFocusBack}`,
);

// N-21: an expired signed link (Storage answers 400) is an error with «Try again», not an empty frame.
const wxExpired = (route) =>
  route.fulfill({
    status: 400,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: '{"statusCode":"400","error":"InvalidJWT","message":"jwt expired"}',
  });
expectBadLink = true;
await page.route("**/storage/v1/object/sign/**", wxExpired);
const wxPdfRow = page.locator("main li", { hasText: "Smoke viewer pdf" });
await wxPdfRow.getByRole("button", { name: "Open" }).click();
const wxPdfDialog = page.getByRole("dialog", { name: "Smoke viewer pdf" });
const wxAlert = wxPdfDialog.getByRole("alert");
await wxAlert.waitFor({ timeout: 15_000 });
const wxAlertText = await wxAlert.innerText();
const wxNoFrame = (await wxPdfDialog.locator("iframe").count()) === 0;
await page.unroute("**/storage/v1/object/sign/**", wxExpired);
expectBadLink = false;
await wxPdfDialog.getByRole("button", { name: "Try again" }).click();
await wxPdfDialog.locator("iframe").waitFor({ timeout: 15_000 });
const wxFrame = await wxPdfDialog.locator("iframe").getAttribute("src");
await wxPdfDialog.getByRole("button", { name: "Close" }).click();
await wxPdfDialog.waitFor({ state: "detached", timeout: 5_000 });
ok(
  "PKG wallet-extras 3 viewer: an expired link → «The link has expired» + «Try again» (no frame); the retry shows the PDF in a blob frame; no CSP report",
  /The link has expired/.test(wxAlertText) &&
    wxNoFrame &&
    (wxFrame ?? "").startsWith("blob:") &&
    cspViolations.slice(wxCsp).every((v) => /Evaluating a string as JavaScript/.test(v)),
  `${wxAlertText.slice(0, 60)} · frame=${(wxFrame ?? "").slice(0, 5)} · csp=${cspViolations.slice(wxCsp).length}`,
);

// N-19: archive → «Trash (1)» → restore; then archive both and delete them permanently (data restored).
await wxImageRow.getByRole("button", { name: "Archive Smoke viewer image" }).click();
await wxImageRow.waitFor({ state: "detached", timeout: 15_000 });
const wxArchivedNotice = await page
  .locator("main [role=status]")
  .filter({ hasText: "Document archived. You can restore it from the trash." })
  .count();
await page.getByRole("link", { name: /^Trash \(\d+\)$/ }).click();
await page.waitForURL((u) => u.search === "?view=trash");
const wxTrashRow = page.locator("main li", { hasText: "Smoke viewer image" });
await wxTrashRow.waitFor({ timeout: 15_000 });
const wxTrashText = (await page.locator("main").innerText()).replace(/\s+/g, " ");
await wxTrashRow.getByRole("button", { name: "Restore Smoke viewer image" }).click();
await wxTrashRow.waitFor({ state: "detached", timeout: 15_000 });
await page.getByRole("link", { name: "View wallet" }).click();
await page.waitForURL((u) => u.search === "");
const wxBack = await page.locator("main li", { hasText: "Smoke viewer image" }).count();
ok(
  "PKG wallet-extras 4 trash: «Archive» → «Trash» row with its dates and the 30-day note → «Restore» → back in the wallet",
  wxArchivedNotice === 1 &&
    /You can restore an archived document for 30 days/.test(wxTrashText) &&
    /archived \d{2} \w{3} \d{4} · deleted permanently from \d{2} \w{3} \d{4}/.test(wxTrashText) &&
    wxBack === 1,
  wxTrashText.slice(0, 120),
);
for (const title of ["Smoke viewer image", "Smoke viewer pdf"]) {
  const row = page.locator("main li", { hasText: title });
  await row.getByRole("button", { name: `Archive ${title}` }).click();
  await row.waitFor({ state: "detached", timeout: 15_000 });
}
await page.goto(`${WX}?view=trash`);
await page.waitForLoadState("networkidle");
for (const title of ["Smoke viewer image", "Smoke viewer pdf"]) {
  const row = page.locator("main li", { hasText: title });
  await row.getByRole("button", { name: "Delete permanently" }).click();
  await row.getByRole("button", { name: "Confirm delete" }).click();
  await row.waitFor({ state: "detached", timeout: 15_000 });
}
let wxLeft = 0;
for (const query of [{}, { view: "trash" }]) {
  const listed = await asSeedUser("delta@crewflex.test", "professional-documents", { query });
  wxLeft += listed.data.documents.filter((d) => /^Smoke viewer/.test(d.title)).length;
}
ok(
  "PKG wallet-extras 5 trash emptied permanently: «No documents. Archived documents can be restored.»; nothing of the smoke left",
  wxLeft === 0 &&
    (await page.getByText("No documents. Archived documents can be restored.").count()) === 1,
  `${wxLeft} left`,
);

// N-26: the API refuses a single window that starts, or is moved, before today (UTC): 400 on startsAt.
const wxDay = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const wxPast = await asSeedUser("delta@crewflex.test", "professional-availability", {
  method: "POST",
  headers: { "Idempotency-Key": crypto.randomUUID() },
  body: {
    startsAt: `${wxDay(-1)}T08:00:00.000Z`,
    endsAt: `${wxDay(1)}T08:00:00.000Z`,
    status: "available",
  },
});
const wxFuture = await asSeedUser("delta@crewflex.test", "professional-availability", {
  method: "POST",
  headers: { "Idempotency-Key": crypto.randomUUID() },
  body: {
    startsAt: "2032-03-01T00:00:00.000Z",
    endsAt: "2032-03-02T00:00:00.000Z",
    status: "available",
  },
});
const wxWindowId = wxFuture.data?.window?.id;
const wxMoved = await asSeedUser("delta@crewflex.test", "professional-availability", {
  method: "PATCH",
  query: { id: wxWindowId },
  // Short window: a span to 2032 would fail «maxDays» first, hiding the floor.
  body: {
    startsAt: `${wxDay(-2)}T00:00:00.000Z`,
    endsAt: `${wxDay(-1)}T00:00:00.000Z`,
    status: "available",
  },
});
const wxRemoved = await asSeedUser("delta@crewflex.test", "professional-availability", {
  method: "DELETE",
  query: { id: wxWindowId },
});
const wxIssue = (r) =>
  `${r.error?.code}:${r.error?.issues?.[0]?.path}:${r.error?.issues?.[0]?.message}`;
ok(
  "PKG wallet-extras 6 N-26: POST and PATCH with a start before today → 400 startsAt «v.start.future»; the future window is created and removed",
  wxIssue(wxPast) === "VALIDATION_ERROR:startsAt:v.start.future" &&
    wxIssue(wxMoved) === "VALIDATION_ERROR:startsAt:v.start.future" &&
    wxFuture.ok === true &&
    wxRemoved.ok === true,
  `${wxIssue(wxPast)} · ${wxIssue(wxMoved)}`,
);
await logout();

// PKG recruiter (v2-24 «Espacio recruiter con clientes», area 10 task 17; migrations 20261024500000/500100, function
// `represented-clients`; BR-27, T-130…T-135). Demo Aero Services Lisbon becomes a staffing agency for the block (its
// admin may change the type: column grant) and goes back to `mro` at the end. One client is added, activated by the
// platform admin, used by a requirement (created through the API, setup only) and revoked; the requirement ends
// closed and archived. Revoked clients and the archived requirement stay (no delete path), as in the other blocks.
const RC_ADMIN = "admin.other@crewflex.test";
const rcHeaders = await seedHeaders(RC_ADMIN);
const [rcAgency] = await seedRest(
  RC_ADMIN,
  "organizations?select=id,type&name=eq.Demo%20Aero%20Services%20Lisbon",
);
const rcSetType = (type) =>
  fetch(new URL(`/rest/v1/organizations?id=eq.${rcAgency.id}`, supabaseUrl), {
    method: "PATCH",
    headers: { ...rcHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({ type }),
  }).then((r) => r.ok);
const rcCall = (fn, init = {}) => {
  const url = new URL(`/functions/v1/${fn}`, supabaseUrl);
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);
  return fetch(url, {
    method: init.method ?? "GET",
    headers: { ...rcHeaders, ...(init.headers ?? {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  }).then((r) => r.json());
};
const rcClient = `Smoke client ${Date.now()}`;
const rcTitle = `Local UI check · recruiter ${Date.now()}`;
// An organization becomes an agency only without published requirements lacking a client (MEDIUM-1 guard): the
// seed's open requirement is paused for the block and resumed at the end.
const rcPaused = (
  await rcCall("work-requirements", { query: { organizationId: rcAgency.id, status: "open" } })
).data.requirements.map((r) => r.id);
for (const id of rcPaused)
  await rcCall("work-requirements", { method: "PATCH", body: { id, status: "paused" } });
ok(
  "PKG recruiter 0 Lisbon is a staffing agency for this block (its open requirements paused)",
  await rcSetType("staffing_agency"),
  `${rcPaused.length} paused`,
);

await login(RC_ADMIN);
ok(
  "PKG recruiter 1 an agency lands on «Recruiter workspace» with the organization's KPIs and the client portfolio",
  new URL(page.url()).pathname === "/app/recruiter" &&
    /Recruiter workspace/i.test(await page.locator("main header").first().innerText()) &&
    /Client portfolio/.test(await page.locator("main").innerText()) &&
    (await page.locator("aside a[href='/app/recruiter']").count()) > 0,
  page.url(),
);
await responsiveShots("pkg-recruiter-workspace");
await page.fill("#clientName", rcClient);
await page.fill("#clientEmail", "ops@smoke-client.test");
await page.getByRole("button", { name: "Add client" }).click();
await page.waitForSelector("[role=status]:has-text('Client saved.')", { timeout: 15000 });
await page.reload();
await page.waitForLoadState("networkidle");
const rcRow = page.locator("#clients li", { hasText: rcClient });
ok(
  "PKG recruiter 2 «Add client» saves it pending verification, with its e-mail (v1.8 «{name} · {email}»)",
  /Pending verification/.test(await rcRow.innerText()) &&
    /ops@smoke-client\.test/.test(await rcRow.innerText()),
  "",
);

await page.goto(`${BASE}/app/organization/requirements/new`);
await page.waitForLoadState("networkidle");
await page.evaluate(() => localStorage.clear());
const rcNoActive = /No active clients/.test(await page.locator("main").innerText());
await page.getByRole("button", { name: "Publish requirement" }).click();
const rcBuilder = await page.locator("main").innerText();
ok(
  "PKG recruiter 3 the builder is «Requirement for a client»; without an active client publishing says «Select a client.»; the recruiter's note is the agency's",
  /Requirement for a client/i.test(await page.locator("main header").first().innerText()) &&
    rcNoActive &&
    /Select a client\./.test(rcBuilder) &&
    /The recruiter manages the requirement/.test(rcBuilder),
  "",
);
await logout();

await login("platform.admin@crewflex.test");
await page.goto(`${BASE}/app/admin/representations`);
await page.waitForLoadState("networkidle");
const rcCard = page.locator("main li", { hasText: rcClient });
await rcCard.locator("textarea").fill("Smoke mandate reference · checked by phone");
await rcCard.getByRole("button", { name: "Record evidence and activate" }).click();
await page.waitForSelector(`[role=status]:has-text('Representation of ${rcClient} activated.')`, {
  timeout: 15000,
});
ok(
  "PKG recruiter 4 the platform admin records the evidence and activates the representation",
  /Demo Aero Services Lisbon/.test(await page.locator("main").innerText()),
  "",
);
await logout();

// Setup through the API (the builder's own steps are the requirement-builder block): a requirement for the client.
const rcClients = await rcCall("represented-clients", { query: { organizationId: rcAgency.id } });
const rcClientId = rcClients.data.clients.find((c) => c.name === rcClient)?.id;
const rcTypes = await seedRest(RC_ADMIN, "qualification_types?select=id&code=in.(B1.1)");
const rcStart = new Date(Date.now() + 40 * 86_400_000);
rcStart.setUTCHours(6, 0, 0, 0);
const rcCreated = await rcCall("work-requirements", {
  method: "POST",
  headers: { "Idempotency-Key": crypto.randomUUID() },
  body: {
    organizationId: rcAgency.id,
    title: rcTitle,
    location: "Lisbon (LIS)",
    startsAt: rcStart.toISOString(),
    endsAt: new Date(rcStart.getTime() + 36 * 3_600_000).toISOString(),
    shift: "day",
    headcount: 1,
    urgency: "planned",
    qualifications: rcTypes.map((q) => ({ qualificationTypeId: q.id, level: "hard" })),
    onBehalfOfClientId: rcClientId,
  },
});
const rcId = rcCreated.data?.requirement?.id;
ok(
  "PKG recruiter 5 a requirement for the active client is published",
  Boolean(rcId) && rcCreated.data.requirement.client?.name === rcClient,
  JSON.stringify(rcCreated.error ?? {}),
);

await login(RC_ADMIN);
await page.goto(`${BASE}/app/organization/requirements/${rcId}`);
await page.waitForLoadState("networkidle");
const rcDetail = await page.locator("main").innerText();
await page.goto(`${BASE}/app/organization/requirements/new`);
await page.waitForLoadState("networkidle");
ok(
  "PKG recruiter 6 the detail names the client; the builder now offers it",
  /client/i.test(rcDetail) &&
    rcDetail.includes(rcClient) &&
    (await page.locator("#onBehalfOfClientId option", { hasText: rcClient }).count()) === 1,
  "",
);
await logout();

// Delta available over the period (setup; removed at the end), so the detail offers the application step.
const rcWindow = await asSeedUser("delta@crewflex.test", "professional-availability", {
  method: "POST",
  headers: { "Idempotency-Key": crypto.randomUUID() },
  body: {
    startsAt: new Date(rcStart.getTime() - 86_400_000).toISOString(),
    endsAt: new Date(rcStart.getTime() + 3 * 86_400_000).toISOString(),
    status: "available",
  },
});
await login("delta@crewflex.test");
await page.goto(`${BASE}/app/professional/opportunities?q=${encodeURIComponent(rcTitle)}`);
await page.waitForLoadState("networkidle");
const rcCardText = await page.locator("main article", { hasText: rcTitle }).first().innerText();
await page.goto(`${BASE}/app/professional/opportunities/${rcId}`);
await page.waitForLoadState("networkidle");
const rcOpportunity = await page.locator("main").innerText();
const rcPublished = `Published by Demo Aero Services Lisbon for the client ${rcClient}`;
ok(
  "PKG recruiter 7 the professional reads «Published by {org} for the client {client}» on the card and the detail; the consent names both; never the client's e-mail",
  rcCardText.includes(rcPublished) &&
    rcOpportunity.includes(rcPublished) &&
    rcOpportunity.includes(`with Demo Aero Services Lisbon, for its client ${rcClient}`) &&
    !rcOpportunity.includes("smoke-client.test") &&
    !rcCardText.includes("smoke-client.test"),
  rcCardText.split("\n").slice(0, 4).join(" | "),
);
await logout();

await login(RC_ADMIN);
await page.getByRole("button", { name: `Revoke the representation of ${rcClient}` }).click();
await page.getByRole("button", { name: "Revoke for good" }).click();
await page.waitForSelector(`[role=status]:has-text('Representation of ${rcClient} revoked.')`, {
  timeout: 15000,
});
// The confirmation survives the list refresh and the revoked row offers no second «Revoke».
const rcRevokeLeft = await page
  .getByRole("button", { name: `Revoke the representation of ${rcClient}` })
  .count();
await page.goto(`${BASE}/app/organization/requirements/${rcId}`);
await page.waitForLoadState("networkidle");
const rcRevokedNote = /is no longer active/.test(await page.locator("main").innerText());
const rcHidden = await asSeedUser("delta@crewflex.test", "opportunities", { query: { id: rcId } });
ok(
  "PKG recruiter 8 revoked: the agency is told why, the requirement leaves the professionals' opportunities",
  rcRevokedNote && rcHidden.error?.code === "NOT_FOUND" && rcRevokeLeft === 0,
  JSON.stringify(rcHidden.error ?? {}),
);
await logout();

// Restore: close and archive the requirement (winding down still works), Lisbon back to an MRO.
const rcClosed = await rcCall("work-requirements", {
  method: "PATCH",
  body: { id: rcId, status: "closed" },
});
const rcArchived = await rcCall("work-requirements", {
  method: "PATCH",
  body: { id: rcId, archive: true },
});
const rcWindowRemoved = await asSeedUser("delta@crewflex.test", "professional-availability", {
  method: "DELETE",
  query: { id: rcWindow.data?.window?.id ?? "" },
});
const rcTypeBack = await rcSetType("mro");
const rcResumed = [];
for (const id of rcPaused)
  rcResumed.push(
    (await rcCall("work-requirements", { method: "PATCH", body: { id, status: "open" } })).ok,
  );
ok(
  "PKG recruiter 9 restored: requirement closed and archived after the revocation; Delta's window removed; Lisbon is an MRO again with its requirements resumed",
  rcClosed.ok === true &&
    rcArchived.ok === true &&
    rcWindowRemoved.ok === true &&
    rcTypeBack &&
    rcResumed.every(Boolean),
  JSON.stringify(rcClosed.error ?? rcArchived.error ?? rcWindowRemoved.error ?? {}),
);
// PKG pack-view (v2-15 + v2-04, migration 20261024300000, BR-25): the apply panel previews the Candidate Pack
// copy (with «Experience you share») before the consent; the organization opens «View dossier» and reads the copy
// of the moment of applying, not the later edit; never the name. Setup through the local API (need, Delta's window
// and logbook entry); restores: withdraw (the copy goes), window, entry, need closed, notices read.
{
  const packTitle = `Local UI check · pack ${Date.now()}`;
  const PACK_AIRCRAFT = "A320 EC-PCK (smoke)";
  const packNeed = await asSeedUser("admin.mro@crewflex.test", "work-requirements", {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: {
      organizationId: mroOrg.id,
      title: packTitle,
      location: "Madrid (MAD)",
      startsAt: "2026-12-27T06:00:00.000Z",
      endsAt: "2026-12-28T18:00:00.000Z",
      shift: "day",
      headcount: 1,
      urgency: "planned",
      qualifications: hiringTypes.map((q) => ({ qualificationTypeId: q.id, level: "hard" })),
    },
  });
  const packNeedId = packNeed.data.requirement.id;
  const packWindow = await asSeedUser("delta@crewflex.test", "professional-availability", {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: {
      startsAt: "2026-12-27T00:00:00.000Z",
      endsAt: "2026-12-29T00:00:00.000Z",
      status: "available",
    },
  });
  const madridToday = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(
    new Date(),
  );
  const packEntry = await asSeedUser("delta@crewflex.test", "professional-logbook", {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: {
      entryDate: madridToday,
      aircraft: PACK_AIRCRAFT,
      ata: "32",
      hours: 2,
      category: "inspection",
      environment: "line_maintenance",
      description: "Pack smoke · original description.",
      cvRelevant: true,
    },
  });
  const packEntryId = packEntry.data?.entry?.id;

  await login("delta@crewflex.test");
  await page.goto(`${BASE}/app/professional/opportunities/${packNeedId}`);
  await page.waitForLoadState("networkidle");
  const share = page.locator("section", { hasText: "What you share with Demo MRO Madrid" }).last();
  const shareText = (await share.innerText().catch(() => "")).replace(/\s+/g, " ");
  ok(
    "PKG pack-view a: «What you share» lists the copy before the consent (experience, rate, protection; no name)",
    /Experience you share/.test(shareText) &&
      shareText.includes(PACK_AIRCRAFT) &&
      /Declared minimum: €45\.00 \/ hour/.test(shareText) &&
      /Originals, file names and identifying metadata stay protected\./.test(shareText) &&
      !/Technician Delta/.test(shareText),
    shareText.slice(0, 200),
  );
  await page.getByLabel(/I authorise sharing this data with Demo MRO Madrid/).check();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.waitForSelector("[role=status]:has-text('Application sent')", { timeout: 20000 });
  await logout();
  // The professional edits the entry afterwards: the copy already sent must not follow.
  if (packEntryId)
    await asSeedUser("delta@crewflex.test", "professional-logbook", {
      method: "PATCH",
      query: { id: packEntryId },
      body: { description: "Pack smoke · edited later." },
    });

  const packOrgView = await asSeedUser("admin.mro@crewflex.test", "applications", {
    query: { requirementId: packNeedId },
  });
  const packApplicationId = packOrgView.data?.applications?.[0]?.id;
  await login("admin.mro@crewflex.test");
  await page.goto(`${BASE}/app/organization/requirements/${packNeedId}/applications`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: "View dossier" }).first().click();
  await page.waitForURL((u) => u.searchParams.get("pack") === packApplicationId, {
    timeout: 20000,
  });
  await page.waitForLoadState("networkidle");
  const dossier = page.locator(`#pack-${packApplicationId}`);
  const dossierText = (await dossier.innerText().catch(() => "")).replace(/\s+/g, " ");
  ok(
    "PKG pack-view b: «View dossier» shows the dated copy of the moment of applying, protected, pseudonymous",
    /Shared dossier/.test(dossierText) &&
      /Profile copy: .*Changes to the passport and the logbook do not alter this version\./.test(
        dossierText,
      ) &&
      dossierText.includes("Pack smoke · original description.") &&
      !dossierText.includes("edited later") &&
      /Originals, file names and identifying metadata stay protected\./.test(dossierText) &&
      !/Technician Delta|delta@crewflex\.test/.test(dossierText),
    dossierText.slice(0, 200),
  );
  await responsiveShots("pkg-pack-view");
  await page.getByRole("link", { name: "Close dossier" }).click();
  await page.waitForURL((u) => !u.searchParams.has("pack"), { timeout: 20000 });
  ok(
    "PKG pack-view c: «Close dossier» folds it back",
    (await page.locator(`#pack-${packApplicationId}`).count()) === 0,
    "",
  );
  await logout();
  const strangerPack = await asSeedUser("admin.airline@crewflex.test", "applications", {
    query: { view: "pack", applicationId: packApplicationId ?? crypto.randomUUID() },
  });
  ok(
    "PKG pack-view d: another organization's admin gets 404 for the copy",
    strangerPack.error?.code === "NOT_FOUND",
    JSON.stringify(strangerPack).slice(0, 100),
  );

  // Restore: withdrawing deletes the copy; then the window, the entry, the need and the notices.
  const packMine = await asSeedUser("delta@crewflex.test", "applications");
  const packOwn = packMine.data?.applications?.find((a) => a.id === packApplicationId);
  if (packOwn)
    await asSeedUser("delta@crewflex.test", "applications", {
      method: "PATCH",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: { applicationId: packOwn.id, to: "withdrawn", expectedUpdatedAt: packOwn.updatedAt },
    });
  const packAfter = await asSeedUser("admin.mro@crewflex.test", "applications", {
    query: { view: "pack", applicationId: packApplicationId ?? crypto.randomUUID() },
  });
  ok(
    "PKG pack-view e: after withdrawing, the copy is gone (pack: null)",
    packAfter.data?.pack === null,
    JSON.stringify(packAfter).slice(0, 100),
  );
  await asSeedUser("delta@crewflex.test", "professional-availability", {
    method: "DELETE",
    query: { id: packWindow.data.window.id },
  });
  if (packEntryId)
    await asSeedUser("delta@crewflex.test", "professional-logbook", {
      method: "DELETE",
      query: { id: packEntryId },
    });
  await asSeedUser("admin.mro@crewflex.test", "work-requirements", {
    method: "PATCH",
    body: { id: packNeedId, status: "closed" },
  });
  for (const email of ["delta@crewflex.test", "manager.mro@crewflex.test"]) {
    await asSeedUser(email, "notifications", { method: "PATCH", body: { all: true } });
  }
}
// PKG matching-v18 (v2-11, BR-3.7–3.13, BR-5.6, T-80…T-87): the v1.8 profile requirements explained on both
// sides. Organization: the seeded «B1.1 · A320 / B737 NG line check (v1.8 profile rules)» of Demo Airline Ops
// Barcelona (read only). Professional: a need with country Spain created through the local API (the builder's
// default country), seen by Delta (permit ES) and Kilo (no permit), then closed — nothing published is left.
await login("admin.airline@crewflex.test");
await page.goto(`${BASE}/app/organization/requirements`);
await page.waitForLoadState("networkidle");
const v18Href = await page
  .locator("a:has-text('A320 / B737 NG line check')")
  .first()
  .getAttribute("href");
await page.goto(`${BASE}${v18Href}/matches?eligible=0`); // v2-25: «Solo elegibles» is on by default
await page.waitForLoadState("networkidle");
await page.locator("main article").first().waitFor({ timeout: 15000 });
const v18Eligible = page.locator("main article").filter({ hasNotText: "Not eligible" });
const v18EligibleText = (await v18Eligible.count()) === 1 ? await v18Eligible.innerText() : "";
ok(
  "PKG matching-v18 1 one eligible candidate (Delta), every v1.8 profile requirement listed and met",
  // Section titles are CSS-uppercased: innerText reflects it.
  /Profile requirements/i.test(v18EligibleText) &&
    /Work permit: Spain/.test(v18EligibleText) &&
    /Category B1\.1/.test(v18EligibleText) &&
    /Aircraft: A320 Family \/ B737 NG/.test(v18EligibleText) &&
    /Type rating B1\.1 · A320 Family \/ B737 NG\s+Met:\s+Declared, valid and unrestricted/.test(
      v18EligibleText,
    ) &&
    /Minimum experience: 5 years/.test(v18EligibleText) &&
    /Capability: Line Maintenance/.test(v18EligibleText) &&
    /Affinity \(soft score\)/i.test(v18EligibleText),
  v18EligibleText.replace(/\s+/g, " ").slice(0, 240),
);
const v18Echo = await page
  .locator("main article", { hasText: "Technician Echo" })
  .first()
  .innerText();
ok(
  "PKG matching-v18 2 Echo (open): the restricted rating and the missing capability are the blockers, never the restriction text",
  /The B1\.1 · A320 Family \/ B737 NG type rating declares restrictions/.test(v18Echo) &&
    /Required capability: Line Maintenance/.test(v18Echo) &&
    !/No engine run-ups/.test(await page.locator("main").innerText()),
  v18Echo.replace(/\s+/g, " ").slice(0, 240),
);
ok(
  "PKG matching-v18 3 «Experiencia mínima 5» leaves out who declares 4 (Golf), explained",
  /Below the minimum experience \(5 years\)/.test(await page.locator("main").innerText()),
  "",
);
await logout();
const v18Title = `Local UI check · v1.8 rules ${Date.now()}`;
const [v18Org] = await seedRest(
  "admin.mro@crewflex.test",
  "organizations?select=id&name=eq.Demo%20MRO%20Madrid",
);
const v18Types = await seedRest(
  "admin.mro@crewflex.test",
  "qualification_types?select=id&code=in.(B1.1,TR-A320)",
);
const v18Created = await asSeedUser("admin.mro@crewflex.test", "work-requirements", {
  method: "POST",
  headers: { "Idempotency-Key": crypto.randomUUID() },
  body: {
    organizationId: v18Org.id,
    title: v18Title,
    location: "Madrid (MAD)",
    startsAt: new Date(Date.now() + 60 * 86_400_000).toISOString(),
    endsAt: new Date(Date.now() + 62 * 86_400_000).toISOString(),
    shift: "day",
    headcount: 1,
    urgency: "planned",
    country: "ES",
    qualifications: v18Types.map((q) => ({ qualificationTypeId: q.id, level: "hard" })),
  },
});
const v18Id = v18Created.data?.requirement.id;
const v18Opportunity = async (email) => {
  await login(email);
  await page.goto(`${BASE}/app/professional/opportunities/${v18Id}`);
  await page.waitForLoadState("networkidle");
  const text = await page.locator("main").innerText();
  await logout();
  return text;
};
const v18Delta = await v18Opportunity("delta@crewflex.test");
const v18Kilo = await v18Opportunity("kilo@crewflex.test");
ok(
  "PKG matching-v18 4 own eligibility: the job's country is checked against the declared work permits (Delta yes, Kilo no)",
  Boolean(v18Id) &&
    /Work permit: Spain\s+Met:\s+Declared in the profile/.test(v18Delta) &&
    /No work permit declared for Spain/.test(v18Kilo) &&
    /Work permit: Spain\s+Not met:\s+Not declared in the profile/.test(v18Kilo),
  JSON.stringify({ created: Boolean(v18Id), kilo: v18Kilo.replace(/\s+/g, " ").slice(0, 160) }),
);
await asSeedUser("admin.mro@crewflex.test", "work-requirements", {
  method: "PATCH",
  body: { id: v18Id, status: "closed" },
});

// PKG outreach (N-10, v2-17; migrations 20261024400000…400200): Delta's «Opportunity notices» in Settings
// (v1.8 errors, then a valid save), «Distribute Urgent / AOG notice» on an AOG need (ICU plural result, the
// button gone, the count kept), and Delta's «AOG: {title}» notice leading to the opportunity. Setup and
// restore through the local API: the need is closed, the window deleted and Delta's preferences put back
// (never saved before = the defaults, which reach nobody).
const outreachTitle = `Local UI check · outreach ${Date.now()}`;
const outreachBefore = (await asSeedUser("delta@crewflex.test", "notice-preferences")).data
  .preferences;
await login("delta@crewflex.test");
await page.goto(`${BASE}/app/settings`);
await page.waitForLoadState("networkidle");
const prefsPanel = page.locator("#notice-preferences");
const prefsSave = prefsPanel.getByRole("button", { name: "Save notice preferences" });
await prefsPanel.getByLabel("IANA time zone for notices").fill("Mars/Olympus");
await prefsPanel.getByLabel("Quiet from (optional)").fill("22:00");
await prefsPanel.getByLabel("Quiet until (optional)").fill("");
await prefsSave.click();
const prefsErrors = await prefsPanel.innerText();
ok(
  "PKG outreach a: the v1.8 errors «Invalid time zone.» and «Invalid quiet hours.» show next to their fields",
  /Invalid time zone\./.test(prefsErrors) && /Invalid quiet hours\./.test(prefsErrors),
  "",
);
await prefsPanel.getByLabel("I want in-app AOG notices").check();
await prefsPanel.getByLabel("Minimum hours you need to mobilise").fill("12");
await prefsPanel.getByLabel("IANA time zone for notices").fill("Europe/Madrid");
await prefsPanel.getByLabel("Quiet from (optional)").fill("");
await prefsSave.click();
ok(
  "PKG outreach b: a valid form saves («Notice preferences saved.»), with v1.8's note on mobilisation and quiet hours",
  await prefsPanel
    .getByRole("status")
    .filter({ hasText: "Notice preferences saved." })
    .waitFor({ timeout: 15000 })
    .then(() => true)
    .catch(() => false),
  "",
);
await logout();
const outreachNeed = await asSeedUser("admin.mro@crewflex.test", "work-requirements", {
  method: "POST",
  headers: { "Idempotency-Key": crypto.randomUUID() },
  body: {
    organizationId: mroOrg.id,
    title: outreachTitle,
    location: "Madrid (MAD)",
    startsAt: "2027-01-11T06:00:00.000Z",
    endsAt: "2027-01-12T18:00:00.000Z",
    shift: "day",
    headcount: 1,
    urgency: "aog",
    qualifications: hiringTypes.map((q) => ({ qualificationTypeId: q.id, level: "hard" })),
  },
});
const outreachNeedId = outreachNeed.data.requirement.id;
const outreachWindow = await asSeedUser("delta@crewflex.test", "professional-availability", {
  method: "POST",
  headers: { "Idempotency-Key": crypto.randomUUID() },
  body: {
    startsAt: "2027-01-11T00:00:00.000Z",
    endsAt: "2027-01-13T00:00:00.000Z",
    status: "available",
  },
});
await login("admin.mro@crewflex.test");
await page.goto(`${BASE}/app/organization/requirements/${outreachNeedId}`);
await page.waitForLoadState("networkidle");
const distribution = page
  .locator("section")
  .filter({ has: page.getByRole("heading", { name: "AOG distribution" }) })
  .last();
await distribution.getByRole("button", { name: "Distribute Urgent / AOG notice" }).click();
const distributed = await distribution
  .getByRole("status")
  .filter({
    hasText:
      // Below 5 eligible professionals (here: Delta alone) the number is withheld (T-128).
      /^(?:[1-9]\d* in-app notices? created|In-app notices created\. With fewer than 5 possible candidates the number is not shown, to protect their preferences)\. Consent, availability and quiet hours are respected\. No e-mails were sent\./,
  })
  .waitFor({ timeout: 20000 })
  .then(() => true)
  .catch(() => false);
await page.reload();
await page.waitForLoadState("networkidle");
ok(
  "PKG outreach c: «Distribute Urgent / AOG notice» reports the count (ICU plural; withheld below 5 eligible), then the button is gone and the outcome stays",
  distributed &&
    (await distribution.getByRole("button", { name: "Distribute Urgent / AOG notice" }).count()) ===
      0 &&
    /Distributed on .*(?:: [1-9]\d* in-app notices?\.|\. With fewer than 5 possible candidates the number of notices is not shown\.)/.test(
      await distribution.innerText(),
    ),
  "",
);
await logout();
await login("delta@crewflex.test");
await page.goto(`${BASE}/app/notices`);
await page.waitForLoadState("networkidle");
const outreachCard = page.locator("main article", { hasText: `AOG: ${outreachTitle}` });
const outreachCardText = (await outreachCard.count()) ? await outreachCard.innerText() : "";
await outreachCard.getByRole("button", { name: "View opportunity" }).click();
ok(
  "PKG outreach d: Delta reads «AOG: {title} · Demo MRO Madrid · Check the conditions…» and opens the opportunity",
  /Demo MRO Madrid · Check the conditions and decide whether you want to apply\./.test(
    outreachCardText,
  ) &&
    (await page
      .waitForURL((u) => u.pathname === `/app/professional/opportunities/${outreachNeedId}`, {
        timeout: 20000,
      })
      .then(() => true)
      .catch(() => false)),
  "",
);
await logout();
// Restore: Delta's preferences as they were, the window, the need (closed) and the notices read.
await asSeedUser("delta@crewflex.test", "notice-preferences", {
  method: "PUT",
  body: {
    urgentOptIn: outreachBefore.urgentOptIn,
    aogOptIn: outreachBefore.aogOptIn,
    mobilizationHours: outreachBefore.mobilizationHours,
    timeZone: outreachBefore.timeZone,
    quietStart: outreachBefore.quietStart,
    quietEnd: outreachBefore.quietEnd,
  },
});
await asSeedUser("delta@crewflex.test", "professional-availability", {
  method: "DELETE",
  query: { id: outreachWindow.data.window.id },
});
await asSeedUser("admin.mro@crewflex.test", "work-requirements", {
  method: "PATCH",
  body: { id: outreachNeedId, status: "closed" },
});
await asSeedUser("delta@crewflex.test", "notifications", { method: "PATCH", body: { all: true } });
// PKG shell-visual (v2 diff 10 #8/#10/#16/#18, 50 #1/#2/#3/#5/#12/#13/#14/#15, 20 N-15/N-18/N-23;
// migration 20261024600000, T-140…T-148): brand, desktop header, mobile dock, footer, the «Mi espacio»
// hero with medals and the «My profile status» dialog, the browser-only avatar photo, the public tools,
// «Visible network» and real 404s on missing or foreign detail pages. No data is written (the photo
// lives in this browser and is removed at the end).
{
  const SV_MISSING = "6f1c2c1e-2b0a-4a51-9a8e-0d3c5b7e9f10";
  await login("delta@crewflex.test");
  await page.goto(`${BASE}/app/professional`);
  await page.waitForLoadState("networkidle");
  const svShell = await page.evaluate(() => {
    const visible = (el) => !!el && el.getClientRects().length > 0;
    const bells = [...document.querySelectorAll("a[href='/app/notices'][aria-label]")];
    const footer = document.querySelector("footer");
    return {
      crumbs: [...document.querySelectorAll("header nav ol")]
        .filter(visible)
        .map((o) => o.innerText.replace(/\s+/g, " ")),
      headerBell: bells.filter(visible).map((b) => !!b.closest("header")),
      footer: footer
        ? [...footer.querySelectorAll("span")].filter(visible).map((s) => s.innerText)
        : [],
      brandPlane: !!document.querySelector("aside a[href='/app'] svg path"),
      brandName: document.querySelector("aside a[href='/app']")?.textContent ?? "",
      favicon: document.querySelector("link[rel=icon]")?.getAttribute("href") ?? "",
    };
  });
  ok(
    "PKG shell-visual 1 desktop: «CrewFlex / Overview» header with the bell (one visible), v1.8 footer without a version, plane brand",
    svShell.crumbs.join() === "CrewFlex / Overview" &&
      svShell.headerBell.join() === "true" &&
      svShell.footer.join(" · ") === "CREWFLEX AVIATION · Qualification · Availability · Trust" &&
      svShell.brandPlane &&
      /^CrewFlexAVIATION$/.test(svShell.brandName) &&
      /^\/icon\.svg/.test(svShell.favicon) &&
      (await page.title()) === "Overview · CrewFlex",
    JSON.stringify(svShell),
  );
  // Hero (N-15): experience first, then the main category; a medal opens its detail with the v1.8 footnote.
  const svHero = page.getByRole("region", { name: "Your professional identity" });
  const svMedals = await svHero
    .getByRole("group", { name: "Profile badges" })
    .getByRole("button")
    .evaluateAll((bs) => bs.map((b) => b.getAttribute("aria-label")));
  await svHero.getByRole("button", { name: svMedals[0] }).click();
  const svDetail = await page
    .getByRole("status")
    .filter({ hasText: "grants no signing authority" })
    .innerText();
  ok(
    "PKG shell-visual 2 hero medals: «12 years», «B1.1: Verified», a rating, «+N»; the detail has the footnote",
    svMedals[0] === "12 years: Declared experience" &&
      svMedals[1] === "B1.1: Verified" &&
      /^A320 Family · B1\.1: /.test(svMedals[2] ?? "") &&
      /^Show \d+ more badges?$/.test(svMedals.at(-1) ?? "") &&
      /Experience stated by the professional/.test(svDetail),
    svMedals.join(" | "),
  );
  // N-18: «My profile status ↗» opens the dialog; Escape closes it and focus returns to the trigger.
  const svTrigger = svHero.getByRole("button", { name: /My profile status/ });
  await svTrigger.click();
  const svDialog = page.getByRole("dialog", { name: /^Profile status · \d+%$/ });
  const svItems = await svDialog.locator("li").count();
  await page.keyboard.press("Escape");
  ok(
    "PKG shell-visual 3 «My profile status» dialog: the 10 items (9 without the wallet); Escape closes, focus back",
    [9, 10].includes(svItems) &&
      !(await svDialog.isVisible()) &&
      (await svTrigger.evaluate((el) => document.activeElement === el)),
    `${svItems} items`,
  );
  // N-23: a photo kept only in this browser, under the user's id; invalid files are refused.
  await page.goto(`${BASE}/app/professional/profile`);
  await page.waitForLoadState("networkidle");
  const svVisual = page.getByRole("region", { name: "Professional badges" });
  const svFile = svVisual.locator("input[type=file]");
  await svFile.setInputFiles({
    name: "note.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("x"),
  });
  const svInvalid = await svVisual.getByRole("alert").innerText();
  const svPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
    "base64",
  );
  await svFile.setInputFiles({ name: "me.png", mimeType: "image/png", buffer: svPng });
  await svVisual.getByRole("button", { name: "Change photo" }).waitFor({ timeout: 10000 });
  const svKeys = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith("crewflex-avatar-v1-")),
  );
  await page.goto(`${BASE}/app/professional`);
  await page.waitForLoadState("networkidle");
  const svHeroPhoto = await svHero.locator("img").count();
  await page.goto(`${BASE}/app/professional/profile`);
  await page.waitForLoadState("networkidle");
  await svVisual.getByRole("button", { name: "Remove photo" }).click();
  ok(
    "PKG shell-visual 4 avatar photo: invalid file refused; PNG stored in this browser only (one per-user key), shown in the hero, removed",
    /JPG, PNG or WebP photo of up to 2 MB/.test(svInvalid) &&
      svKeys.length === 1 &&
      /^crewflex-avatar-v1-[0-9a-f-]{36}$/.test(svKeys[0]) &&
      svHeroPhoto === 1 &&
      (await svVisual.getByRole("button", { name: "Add photo" }).isVisible()) &&
      (await page.evaluate(() =>
        Object.keys(localStorage).some((k) => k.startsWith("crewflex-avatar-v1-")),
      )) === false,
    `${svInvalid} · ${svKeys.join(",")} · hero img ${svHeroPhoto}`,
  );
  // Area 50 #14: on a filtered page the filter is aria-current="true"; only the menu entry is "page".
  await page.goto(`${BASE}/app/professional/applications`);
  await page.waitForLoadState("networkidle");
  ok(
    "PKG shell-visual 5 filters use aria-current=true; aria-current=page only in the menu",
    (await page.locator("main [aria-current=page]").count()) === 0 &&
      (await page.locator("main nav [aria-current=true]").count()) <= 1 &&
      (await page.locator("aside [aria-current=page]").count()) === 1,
    "",
  );
  // T-147: a missing opportunity is a real 404 with the neutral title.
  const svOpp = `${BASE}/app/professional/opportunities/${SV_MISSING}`;
  expectedErrorUrls.add(svOpp);
  const svOppResponse = await page.goto(svOpp);
  ok(
    "PKG shell-visual 6 missing opportunity: HTTP 404, «Not found» with its h1, title «CrewFlex»",
    svOppResponse?.status() === 404 &&
      (await page.getByRole("heading", { level: 1, name: "Not found" }).isVisible()) &&
      (await page.title()) === "CrewFlex",
    String(svOppResponse?.status()),
  );
  expectedErrorUrls.delete(svOpp);
  await logout();

  // Mobile dock (T-141) on a touch screen: 5 shortcuts, 44 px, current marked, no overflow at 390/360.
  const svTouch = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const svTp = await svTouch.newPage();
  await svTp.goto(`${BASE}/login`);
  await svTp.fill("#email", "delta@crewflex.test");
  await svTp.fill("#password", PW);
  await Promise.all([svTp.waitForURL(/\/app/), svTp.click("form button[type=submit]")]);
  for (const width of [390, 360]) {
    await svTp.setViewportSize({ width, height: 800 });
    await svTp.goto(`${BASE}/app/professional/availability`);
    await svTp.waitForLoadState("networkidle");
    const dock = await svTp.evaluate(() => {
      const nav = document.querySelector("nav[aria-label='Quick access']");
      const links = [...(nav?.querySelectorAll("a") ?? [])].map((a) => {
        const r = a.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(a.querySelector("span"));
        const t = range.getBoundingClientRect();
        return {
          text: a.textContent,
          h: r.height,
          w: r.width,
          fits: t.left >= r.left - 0.5 && t.right <= r.right + 0.5,
          current: a.getAttribute("aria-current"),
        };
      });
      window.scrollTo(0, document.body.scrollHeight);
      const footer = document.querySelector("footer").getBoundingClientRect();
      return {
        links,
        footerClear: footer.bottom <= nav.getBoundingClientRect().top + 0.5,
        motto: [...document.querySelectorAll("footer span")].filter(
          (s) => s.getClientRects().length,
        ).length,
        scroll: document.documentElement.scrollWidth,
      };
    });
    ok(
      `PKG shell-visual 7 dock @${width}: Home · Offers · Calendar · Applications · Tools, ≥ 44 px, current marked, labels fit, footer clear, no overflow`,
      dock.links.map((l) => l.text).join() === "Home,Offers,Calendar,Applications,Tools" &&
        dock.links.every((l) => l.h >= 44 && l.w >= 44 && l.fits) &&
        dock.links.find((l) => l.current === "page")?.text === "Calendar" &&
        dock.footerClear &&
        dock.motto === 1 &&
        dock.scroll === width,
      JSON.stringify(dock).slice(0, 300),
    );
  }
  await svTp.setViewportSize({ width: 1024, height: 768 });
  await svTp.goto(`${BASE}/app/professional`);
  await svTp.waitForLoadState("networkidle");
  ok(
    "PKG shell-visual 8 dock hidden from lg (1024): the sidebar and the header take over",
    !(await svTp.getByRole("navigation", { name: "Quick access" }).isVisible()) &&
      (await svTp.getByRole("navigation", { name: "Breadcrumb" }).isVisible()),
  );
  await svTouch.close();

  // Organization side: «Visible network» (T-146, admin/manager) and real 404s (T-147).
  await login("admin.mro@crewflex.test");
  await page.goto(`${BASE}/app/organization`);
  await page.waitForLoadState("networkidle");
  const svNetwork = await page
    .locator("main dl > div", { hasText: "Visible network" })
    .innerText()
    .catch(() => "");
  ok(
    "PKG shell-visual 9 «Visible network» counts the professionals the organization can find",
    /Visible network\s*\d+\s*Subject to permissions and privacy/i.test(svNetwork),
    svNetwork.replace(/\s+/g, " "),
  );
  const svStatus = async (path) => {
    expectedErrorUrls.add(`${BASE}${path}`);
    const response = await page.goto(`${BASE}${path}`);
    const result = `${response?.status()} ${await page.title()}`;
    expectedErrorUrls.delete(`${BASE}${path}`);
    return result;
  };
  const svOrg = {
    own: await svStatus(new URL(madUrl).pathname),
    ownMatches: await svStatus(`${new URL(madUrl).pathname}/matches`),
    missing: await svStatus(`/app/organization/requirements/${SV_MISSING}`),
    missingEdit: await svStatus(`/app/organization/requirements/${SV_MISSING}/edit`),
    malformed: await svStatus("/app/organization/requirements/not-an-id"),
    builder: await svStatus("/app/organization/requirements/new"),
    networkMissing: await svStatus(`/app/organization/network/${SV_MISSING}`),
    ownAsNetwork: await svStatus(new URL(madUrl).pathname.replace("/requirements/", "/network/")),
  };
  ok(
    "PKG shell-visual 10 detail pages: own 200; missing, malformed, own-as-network 404 with «CrewFlex»",
    /^200 /.test(svOrg.own) &&
      /^200 /.test(svOrg.ownMatches) &&
      /^200 /.test(svOrg.builder) &&
      [
        svOrg.missing,
        svOrg.missingEdit,
        svOrg.malformed,
        svOrg.networkMissing,
        svOrg.ownAsNetwork,
      ].every((s) => s === "404 CrewFlex"),
    JSON.stringify(svOrg),
  );
  await logout();
  await login("charlie@crewflex.test");
  await page.goto(`${BASE}/app/organization`);
  await page.waitForLoadState("networkidle");
  ok(
    "PKG shell-visual 11 a plain member sees no «Visible network»",
    (await page.locator("main dl > div", { hasText: "Visible network" }).count()) === 0,
  );
  await logout();

  // Tools without an account (T-145): public, browser-only, same CSP, nothing asked of Supabase.
  const svAnon = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const svAp = await svAnon.newPage();
  const svHosts = new Set();
  const svCsp = [];
  svAp.on("request", (r) => svHosts.add(new URL(r.url()).host));
  svAp.on("console", (m) => /Content Security Policy/.test(m.text()) && svCsp.push(m.text()));
  const svTools = await svAp.goto(`${BASE}/tools`);
  await svAp.waitForLoadState("networkidle");
  const svTiles = await svAp
    .locator("main a[href^='/tools/']")
    .evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
  await svAp.goto(`${BASE}/tools/torque`);
  await svAp.waitForLoadState("networkidle");
  await svAp.fill("#tool-value", "100");
  const svTorque = await svAp.locator("main [aria-live=polite]").allInnerTexts();
  const svAppTools = await svAp.request.get(`${BASE}/app/tools`, { maxRedirects: 0 });
  await svAp.goto(`${BASE}/login`);
  ok(
    "PKG shell-visual 12 public /tools: 5 browser-only tools (no daily), torque works, CSP header and no violation, no Supabase request; /app/tools still needs a session; the login says so",
    svTools?.status() === 200 &&
      !!svTools.headers()["content-security-policy-report-only"] &&
      svTiles.join() ===
        "/tools/torque,/tools/translator,/tools/convert,/tools/knowledge,/tools/duration" &&
      svTorque.some((t) => /73[.,]75/.test(t)) &&
      svCsp.length === 0 &&
      ![...svHosts].some((h) => /:5432\d|:5632\d/.test(h)) &&
      svAppTools.status() === 307 &&
      /The tools can be used without opening an account/.test(
        await svAp.locator("main").innerText(),
      ),
    `${svTiles.join()} · ${[...svHosts].join(",")} · ${svTorque.join(" / ").slice(0, 80)}`,
  );
  await svAnon.close();
}

// PKG directory (v2-22 / v2-23 «Buscar candidatos»; migration 20261024700000, BR-28, T-150…T-158): the menu
// entry in the v1.8 order, the free directory and its count, a v1.8 filter error, a narrowing filter,
// Compact/Expanded (aria-pressed, remembered across a reload), the «Professional profile» dialog (Escape returns
// the focus) and a plain member's managers-only notice. Read-only: the page runs no mutation (the organization-side
// block is not ported), so there is nothing to set up or restore.
const dirPage = `${BASE}/app/organization/candidates`;
const dirRows = await asSeedUser("admin.mro@crewflex.test", "candidate-directory", {
  query: { organizationId: mroOrg.id, base: "Madrid" },
});
const echoRef = dirRows.data.candidates.find((c) => c.displayName === "Technician Echo")?.ref;
ok(
  "PKG directory 0: the local API lists Echo (open, Madrid) with a CF- ref",
  /^CF-[0-9A-F]{10}$/.test(echoRef ?? ""),
  echoRef ?? "",
);
await login("admin.mro@crewflex.test");
await page.goto(dirPage);
await page.waitForLoadState("networkidle");
const dirNavItems = await page
  .locator("nav a")
  .evaluateAll((as) => as.map((a) => a.textContent.trim()));
ok(
  "PKG directory a: «Find candidates» follows «Requirements» in the organization menu (v1.8 order)",
  dirNavItems.indexOf("Find candidates") === dirNavItems.indexOf("Requirements") + 1,
  dirNavItems.slice(0, 6).join(" | "),
);
const dirSummaryText = async () =>
  page
    .getByRole("status")
    .filter({ hasText: /profiles? · page/ })
    .first()
    .innerText();
const dirTotal = Number(/^(\d+) profiles?/.exec(await dirSummaryText())?.[1]);
ok(
  "PKG directory b: «{n} profiles · page 1 of P» counts the visible network",
  Number.isInteger(dirTotal) && dirTotal > 3 && /page 1 of \d+$/.test(await dirSummaryText()),
  await dirSummaryText(),
);
const dirMain = await page.locator("main").innerText();
ok(
  "PKG directory c: anonymous profiles show «Anonymous professional CF-…», open ones their name, never Hotel (private) nor a member",
  /Anonymous professional CF-[0-9A-F]{10}/.test(dirMain) &&
    /Technician Echo/.test(dirMain) &&
    !/Technician Hotel/.test(dirMain) &&
    !/Technician Alpha/.test(dirMain),
  "",
);
await page.locator("summary", { hasText: "More filters" }).click();
await page.getByLabel("Available from").fill("2027-01-10");
await page.getByRole("button", { name: "Apply filters" }).click();
await page.waitForLoadState("networkidle");
ok(
  "PKG directory d: half a window shows v1.8's «Fill in both dates…» and no list",
  (await page
    .getByRole("status")
    .filter({ hasText: "Fill in both dates with a valid range of up to one year." })
    .count()) === 1 && (await page.locator("article").count()) === 0,
  "",
);
await page.getByLabel("Available from").fill("");
await page.getByLabel("Minimum English").selectOption("C1");
await page.getByRole("button", { name: "Apply filters" }).click();
await page.waitForLoadState("networkidle");
const dirC1 = Number(/^(\d+) profiles?/.exec(await dirSummaryText())?.[1]);
const dirC1Text = await page.locator("main").innerText();
ok(
  "PKG directory e: «Minimum English C1» narrows the list (Delta C1 stays, Echo B1 leaves)",
  dirC1 < dirTotal && /Barcelona \(BCN\)/.test(dirC1Text) && !/Technician Echo/.test(dirC1Text),
  `${dirC1} < ${dirTotal}`,
);
await page.goto(dirPage);
await page.waitForLoadState("networkidle");
const compactBtn = page.getByRole("button", { name: "Compact" });
const expandedBtn = page.getByRole("button", { name: "Expanded" });
const firstCard = page.locator("article").first();
ok(
  "PKG directory f: «Compact» is pressed by default and the expanded block is hidden",
  (await compactBtn.getAttribute("aria-pressed")) === "true" &&
    (await expandedBtn.getAttribute("aria-pressed")) === "false" &&
    !(await firstCard
      .getByText(/^Experience:/)
      .first()
      .isVisible()),
  "",
);
await expandedBtn.click();
await page.reload();
await page.waitForLoadState("networkidle");
const expandedText = await page.locator("article").first().innerText();
ok(
  "PKG directory g: «Expanded» shows experience, English, aircraft and work countries, and is remembered after a reload",
  (await expandedBtn.getAttribute("aria-pressed")) === "true" &&
    /Experience:/.test(expandedText) &&
    /English/.test(expandedText) &&
    /Aircraft:/.test(expandedText) &&
    /Work countries:/.test(expandedText),
  "",
);
await compactBtn.click();
const dirEchoCard = page.locator("article", { hasText: "Technician Echo" });
await dirEchoCard.getByRole("button", { name: "Open profile" }).click();
const profileDialog = page.getByRole("dialog", { name: "Professional profile" });
const dirProfileText = await profileDialog.innerText();
ok(
  "PKG directory h: «Professional profile» opens with the badges note and the privacy note, no e-mail or phone",
  (await profileDialog.isVisible()) &&
    /Profile summary; it grants no sign-off authorisation/.test(dirProfileText) &&
    /Identity follows visibility/.test(dirProfileText) &&
    /Learning medals are private/.test(dirProfileText) &&
    !/@|\+34/.test(dirProfileText),
  "",
);
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
ok(
  "PKG directory i: Escape closes the dialog and the focus returns to «Open profile»",
  !(await profileDialog.isVisible()) &&
    (await page.evaluate(() => document.activeElement?.textContent?.trim())) === "Open profile",
  "",
);
ok(
  "PKG directory j: a card offers no mutation (no «Block» button: the organization-side block is not ported)",
  (await page.getByRole("button", { name: /^(Block|Unblock)$/ }).count()) === 0 &&
    (await page.getByRole("link", { name: "View blocked profiles" }).count()) === 0,
  "",
);
await responsiveShots("directory");
await logout();
await login("charlie@crewflex.test");
await page.goto(dirPage);
await page.waitForLoadState("networkidle");
ok(
  "PKG directory k: a plain member sees the managers-only notice and no directory",
  /managers and admins/i.test(await page.locator("main").innerText()) &&
    (await page.locator("article").count()) === 0,
  "",
);
await logout();

// 18 (batch 10, V1.8 v12.css min-height 44): on a touch screen every control of the main flows
// is at least 44 px tall (desktop keeps its density).
const touch = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
const tp = await touch.newPage();
// Controls under 44 px (height, or width for the ES/EN radios). X-09 adds checkbox labels and links
// that stand alone (a link inside a sentence is the WCAG 2.5.8 exception), the brand and ES/EN.
const measureTouch = () =>
  tp.evaluate(() =>
    [
      ...document.querySelectorAll(
        "button, select, input:not([type=checkbox]):not([type=radio]):not([type=hidden]), nav a, a[aria-label], summary, label:has(input[type=checkbox]), label[for], main a, aside a",
      ),
    ]
      .filter((el) => el.offsetParent !== null)
      // a label is the target only for a checkbox (a text field's caption is not)
      .filter(
        (el) =>
          el.tagName !== "LABEL" ||
          el.querySelector("input[type=checkbox]") ||
          document.getElementById(el.htmlFor)?.type === "checkbox",
      )
      .filter(
        (el) => el.tagName !== "A" || el.parentElement.textContent.trim() === el.textContent.trim(),
      )
      .filter((el) => {
        const box = el.getBoundingClientRect();
        return box.height < 43.5 || (el.getAttribute("role") === "radio" && box.width < 43.5);
      })
      .map(
        (el) =>
          `${location.pathname} ${el.tagName} «${(el.textContent || el.getAttribute("name") || "").trim().slice(0, 20)}» ${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`,
      ),
  );
const small = [];
for (const path of ["/", "/login", "/forgot-password"]) {
  await tp.goto(`${BASE}${path}`);
  await tp.waitForLoadState("networkidle");
  small.push(...(await measureTouch()));
}
await tp.goto(`${BASE}/login`);
await tp.fill("#email", "delta@crewflex.test");
await tp.fill("#password", "crewflex-local-only");
await Promise.all([tp.waitForURL(/\/app/), tp.click("form button[type=submit]")]);
for (const path of [
  "/app/professional",
  "/app/professional/availability",
  "/app/professional/profile",
  "/app/tools/convert",
  "/app/tools",
]) {
  await tp.goto(`${BASE}${path}`);
  await tp.waitForLoadState("networkidle");
  if (path === "/app/tools/convert") {
    await tp.locator("label:has(input[type=checkbox])").first().click(); // range toggle
    await tp.locator("summary").first().click(); // NIST link inside «Formula, sources and scope»
  }
  await tp.getByRole("button", { name: "Menu" }).click(); // measure the nav links too
  small.push(...(await measureTouch()));
}
// A landscape tablet shows the desktop sidebar with its footer sign-out (X-09).
await tp.setViewportSize({ width: 1024, height: 768 });
await tp.goto(`${BASE}/app/professional`);
await tp.waitForLoadState("networkidle");
small.push(...(await measureTouch()));
await touch.clearCookies();
await tp.setViewportSize({ width: 390, height: 844 });
await tp.goto(`${BASE}/login`);
await tp.fill("#email", "admin.mro@crewflex.test");
await tp.fill("#password", "crewflex-local-only");
await Promise.all([tp.waitForURL(/\/app/), tp.click("form button[type=submit]")]);
for (const path of ["/app/organization/requirements", "/app/organization/requirements/new"]) {
  await tp.goto(`${BASE}${path}`);
  await tp.waitForLoadState("networkidle");
  small.push(...(await measureTouch()));
}
ok(
  "25 touch targets ≥ 44 px on a touch screen (landing, auth, professional, tools, requirements, nav, 1024 sidebar)",
  small.length === 0,
  small.slice(0, 20).join(" | "),
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
