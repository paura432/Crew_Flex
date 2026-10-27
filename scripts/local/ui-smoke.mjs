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

// PKG logbook — N-12 personal logbook (M14, BR-16): nav order, future date refused, create (the form
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
    const p6Renamed = await p6Row(`${p6Pdf} editado`).count();
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
