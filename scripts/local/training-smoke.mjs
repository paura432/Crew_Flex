/* eslint-disable no-console -- CLI smoke script: console output is its report */
// Local browser flow of the v1.9 training UI (V19-039; ADR-003): provider profile → admin review → course and edition
// → catalog search → favourite → seat request → terms → explicit acceptance → confirmation → conversation → notices →
// isolation (plain member, second organization, another professional) → cancellation with a reason → 390 px.
// Synthetic seed accounts, English UI. Writes LOCAL rows («Academia QA …», «Curso Ñandú QA …»): run
// scripts/local/cleanup-test-rows.sh afterwards. Needs the `training` flag on (tmp gate / db-owner-sql.sh).
// Usage: BASE=http://localhost:3001 PLAYWRIGHT_CORE=<dir with playwright-core/package.json> CHROME=<chromium binary> node scripts/local/training-smoke.mjs
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(
  `${process.env.PLAYWRIGHT_CORE ?? process.cwd() + "/node_modules"}/playwright-core/package.json`,
);
const { chromium } = require("playwright-core");
// The same preflight as ui-smoke.mjs: never a production-mode run that could reach the remote project.
for (const f of [".env.production.local", ".env.production", ".env"]) {
  if (existsSync(f)) {
    console.error(`refusing: ${f} exists and could override .env.local for production-mode runs`);
    process.exit(2);
  }
}
if (
  !/NEXT_PUBLIC_SUPABASE_URL=http:\/\/(127\.0\.0\.1|localhost):\d+/.test(
    existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "",
  )
) {
  console.error("refusing: .env.local does not point at a local Supabase stack");
  process.exit(2);
}
const BASE = process.env.BASE ?? "http://localhost:3001";
const OUT = process.env.EVIDENCE_DIR ?? "/tmp";
const TS = Date.now().toString(36);
const PROVIDER = `Academia QA ${TS}`;
const COURSE = `Curso Ñandú QA ${TS}`;
let failed = 0;
const ok = (name, cond, detail = "") => {
  console.log(
    `${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : ` :: ${String(detail).slice(0, 400)}`}`,
  );
  if (!cond) failed++;
};
const browser = await chromium.launch({ executablePath: process.env.CHROME });
const errors = [];

async function as(email) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${email}: ${e}`));
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", "crewflex-local-only");
  await page.click("button[type=submit]");
  await page.waitForURL(
    (u) => /^\/app\/(professional|organization|admin|recruiter)/.test(u.pathname),
    { timeout: 30000 },
  );
  await page.waitForLoadState("networkidle");
  if ((await page.evaluate(() => document.documentElement.lang)) !== "en") {
    await page.goto(`${BASE}/app/settings`);
    await page.locator("[role=radio][lang=en]").first().click();
    await page.waitForSelector("[role=status]:has-text('Language updated')", { timeout: 15000 });
  }
  return page;
}
const go = async (page, path) => {
  const res = await page.goto(`${BASE}${path}`);
  await page.waitForLoadState("networkidle");
  return res;
};
const status = (page, text) =>
  page
    .waitForSelector(`[role=status]:has-text("${text}"), [role=alert]:has-text("${text}")`, {
      timeout: 20000,
    })
    .then(
      () => true,
      () => false,
    );
const panel = (page, title) =>
  page.getByRole("heading", { name: title, exact: true }).locator("xpath=ancestor::section[1]");
const queueItem = (page, title) =>
  page.locator("li").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
async function decide(admin, title, decision, note) {
  await go(admin, "/app/admin/training");
  const item = queueItem(admin, title);
  if ((await item.count()) !== 1) return false;
  await item.locator("select[name=decision]").selectOption(decision);
  if (note) await item.locator("textarea[name=note]").fill(note);
  await item.getByRole("button", { name: "Record the decision" }).click();
  // The decided item leaves the queue (its notice goes with it): wait for it to disappear.
  return queueItem(admin, title)
    .waitFor({ state: "detached", timeout: 20000 })
    .then(
      () => true,
      () => false,
    );
}
const day = (n, hh) => {
  const d = new Date(Date.now() + n * 86_400_000);
  return `${d.toISOString().slice(0, 10)}T${hh}`;
};

try {
  const mro = await as("admin.mro@crewflex.test");
  const admin = await as("platform.admin@crewflex.test");
  const echo = await as("echo@crewflex.test");

  // V19-008 provider profile → pending review
  await go(mro, "/app/organization/training");
  await mro.fill("#pv-name", PROVIDER);
  await mro.fill("#pv-desc", "Proveedor ficticio de pruebas locales.");
  await mro.fill("#pv-web", "https://example.test");
  await mro
    .getByRole("button", {
      name: /Create the profile and send it for review|Save and send for review/,
    })
    .click();
  ok(
    "V19-008 provider profile saved and pending review",
    await status(mro, "Saved. It is pending review."),
  );

  // V19-009 admin review of the provider; a note is required to request changes
  await go(admin, "/app/admin/training");
  ok(
    "V19-009 the provider waits in the review queue",
    (await queueItem(admin, PROVIDER).count()) === 1,
  );
  const item = queueItem(admin, PROVIDER);
  await item.locator("select[name=decision]").selectOption("rejected");
  await item.getByRole("button", { name: "Record the decision" }).click();
  const refused = await admin
    .locator("[role=alert]")
    .first()
    .isVisible()
    .catch(() => false);
  ok(
    "V19-009 rejecting without a note is refused",
    refused && (await queueItem(admin, PROVIDER).count()) === 1,
  );
  ok("V19-009 the admin marks the provider reviewed", await decide(admin, PROVIDER, "reviewed"));

  // V19-010/011 course: create, submit, admin publishes
  await go(mro, "/app/organization/training/courses/new");
  await mro.fill("#c-title", COURSE);
  await mro.fill("#c-language", "es");
  await mro.fill("#c-aircraft", "A320");
  await mro.fill("#c-description", "Curso ficticio con acentos para la búsqueda.");
  await mro.fill("#c-issuer", "Academia QA");
  await mro.fill("#c-certificateInfo", "Certificado de asistencia del proveedor");
  await mro.getByRole("button", { name: "Save course" }).click();
  await mro
    .waitForURL((u) => u.pathname === "/app/organization/training", { timeout: 20000 })
    .catch(() => {});
  await mro.waitForLoadState("networkidle");
  ok(
    "V19-010 the course is saved as a draft in the workspace",
    (await panel(mro, COURSE).count()) === 1,
  );
  await panel(mro, COURSE).getByRole("button", { name: "Send for review" }).click();
  // The submit form leaves with the draft state (its notice too): the chip says «In review».
  ok(
    "V19-011 the course is sent for review",
    await panel(mro, COURSE)
      .getByText("In review")
      .first()
      .waitFor({ timeout: 20000 })
      .then(
        () => true,
        () => false,
      ),
  );
  ok("V19-011 the admin publishes the course", await decide(admin, COURSE, "published"));

  // V19-012…017 edition: sessions in UTC with an IANA zone, seats, price unit, informative texts; admin publishes
  await go(mro, "/app/organization/training");
  await panel(mro, COURSE).getByRole("link", { name: "New edition" }).click();
  await mro.waitForLoadState("networkidle");
  await mro.selectOption("#ed-mode", "onsite");
  await mro.fill("#ed-tz", "Europe/Madrid");
  await mro.fill("#ed-capacity", "1");
  await mro.fill("#ed-city", "Madrid");
  await mro.fill("#ed-country", "ES");
  await mro.selectOption("#ed-unit", "person");
  await mro.fill("#ed-price", "450");
  await mro.selectOption("#ed-currency", "EUR");
  await mro.fill("#ed-includes", "IVA incluido, material y café");
  await mro.fill("#ed-policy", "Cancelación gratuita hasta 7 días antes");
  // overlap first: two sessions that overlap are refused before sending
  if ((await mro.locator("#s-0-start").count()) === 0)
    await mro.getByRole("button", { name: "Add a session" }).click();
  await mro.fill("#s-0-start", day(45, "08:00"));
  await mro.fill("#s-0-end", day(45, "16:00"));
  await mro.fill("#s-0-loc", "Hangar 6");
  await mro.getByRole("button", { name: "Add a session" }).click();
  await mro.fill("#s-1-start", day(45, "12:00"));
  await mro.fill("#s-1-end", day(45, "18:00"));
  await mro.getByRole("button", { name: "Save edition" }).click();
  ok(
    "V19-012 overlapping sessions are refused",
    await mro
      .locator("[role=alert]")
      .first()
      .isVisible()
      .catch(() => false),
  );
  await mro.fill("#s-1-start", day(46, "08:00"));
  await mro.fill("#s-1-end", day(46, "14:00"));
  await mro.getByRole("button", { name: "Save edition" }).click();
  await mro
    .waitForURL((u) => u.pathname === "/app/organization/training", { timeout: 20000 })
    .catch(() => {});
  await mro.waitForLoadState("networkidle");
  const ed = panel(mro, COURSE);
  ok(
    "V19-012 the edition is saved with its two sessions",
    /Hangar 6/.test(await ed.innerText()),
    await ed.innerText(),
  );
  await ed.getByRole("button", { name: "Send for review" }).click();
  ok(
    "V19-015 the edition is sent for review",
    await ed
      .getByText("In review")
      .first()
      .waitFor({ timeout: 20000 })
      .then(
        () => true,
        () => false,
      ),
  );
  ok("V19-015 the admin publishes the edition", await decide(admin, COURSE, "published"));

  // V19-003…007 catalog: accent-insensitive search, filters, course page
  await go(echo, `/app/training?q=nandu+${TS}`);
  ok(
    "V19-004 «nandu» finds «Ñandú» (accents and case ignored)",
    (await echo.getByRole("link", { name: COURSE }).count()) >= 1,
    await echo.locator("main").innerText(),
  );
  await go(echo, `/app/training?q=${TS}&mode=selfpaced`);
  ok(
    "V19-005 a non-matching mode filter hides it",
    (await echo.getByRole("link", { name: COURSE }).count()) === 0,
  );
  await go(echo, `/app/training?q=${TS}&mode=onsite`);
  await echo.getByRole("link", { name: COURSE }).first().click();
  await echo.waitForURL((u) => /^\/app\/training\/[0-9a-f-]{36}$/.test(u.pathname), {
    timeout: 20000,
  });
  await echo.waitForLoadState("networkidle");
  for (const summary of await echo.locator("main summary").all()) await summary.click(); // «Provider's terms» is folded
  const coursePage = await echo.locator("main").innerText();
  const wanted = [
    "Academia QA",
    "Certificado de asistencia",
    "A320",
    "Hangar 6",
    "IVA incluido",
    "Cancelación gratuita",
    "Europe/Madrid",
  ];
  ok(
    "V19-007 the course page shows issuer, document, aircraft and the edition terms",
    wanted.every((s) => coursePage.includes(s)),
    `missing: ${wanted.filter((s) => !coursePage.includes(s))}`,
  );
  ok(
    "V19-016 the price per person is shown",
    /€450|450,00\s?€|€450\.00/.test(coursePage),
    coursePage,
  );
  await echo.screenshot({ path: `${OUT}/v19-course-1440.png`, fullPage: true });

  // V19-018 favourite
  await echo.getByRole("button", { name: "Save course" }).click();
  ok("V19-018 the course is saved as favourite", await status(echo, "Saved"));

  // V19-020 seat request (the provider never sees the e-mail)
  const seatForm = echo
    .locator("form")
    .filter({ has: echo.getByRole("button", { name: "Request a seat" }) })
    .first();
  await seatForm.getByLabel("Name the provider will see").fill("Echo QA");
  await seatForm.getByLabel("Note for the provider (optional)").fill("Disponible esas fechas.");
  await seatForm.getByRole("button", { name: "Request a seat" }).click();
  // The form gives way to «Open my request» (its notice goes with it).
  ok(
    "V19-020 the seat request is sent",
    await echo
      .getByRole("link", { name: "Open my request" })
      .first()
      .waitFor({ timeout: 20000 })
      .then(
        () => true,
        () => false,
      ),
  );
  await go(echo, "/app/training/requests");
  ok(
    "V19-021 the request appears in «My requests»",
    (await echo.locator("main").innerText()).includes(COURSE),
  );
  ok(
    "V19-018 «Saved courses» lists the favourite",
    (await panel(echo, "Saved courses").getByRole("link", { name: COURSE }).count()) === 1,
  );

  // V19-022/023 provider inbox → terms
  await go(mro, "/app/organization/training/inbox");
  const inbox = await mro.locator("main").innerText();
  ok(
    "V19-022 the inbox lists the request with the chosen name and note",
    inbox.includes("Echo QA") && inbox.includes("Disponible esas fechas."),
    inbox,
  );
  ok("V19-033 the provider never sees the student's e-mail", !inbox.includes("echo@crewflex.test"));
  await mro.getByRole("button", { name: "Send terms" }).first().click();
  // The inbox filter pills carry the status labels: check the card's own text.
  ok(
    "V19-023 the provider sends the terms",
    await mro
      .getByText("Terms sent · version 1")
      .first()
      .waitFor({ timeout: 20000 })
      .then(
        () => true,
        () => false,
      ),
  );

  // V19-023 explicit acceptance (the checkbox is required)
  await go(echo, "/app/training/requests");
  await echo.getByRole("button", { name: "Accept the terms" }).first().click();
  ok(
    "V19-023 accepting without ticking the box is refused",
    await echo
      .locator("[role=alert]")
      .first()
      .isVisible()
      .catch(() => false),
  );
  await echo
    .getByLabel(/I accept exactly these terms/)
    .first()
    .check();
  await echo.getByRole("button", { name: "Accept the terms" }).first().click();
  ok(
    "V19-023 the student accepts the exact version",
    await echo
      .getByText("Accepted by the student")
      .first()
      .waitFor({ timeout: 20000 })
      .then(
        () => true,
        () => false,
      ),
  );

  // V19-024 confirmation (transactional; capacity 1 → 0 free)
  await go(mro, "/app/organization/training/inbox");
  await mro.getByRole("button", { name: "Confirm the seat" }).first().click();
  ok(
    "V19-024 the provider confirms the seat",
    await mro
      .getByRole("button", { name: "Confirm the seat" })
      .waitFor({ state: "detached", timeout: 20000 })
      .then(
        () => true,
        () => false,
      ),
  );
  await go(echo, "/app/training/requests");
  const mine = await echo.locator("main").innerText();
  ok(
    "V19-024 the student sees «Seat confirmed» and 0 of 1 seats free",
    mine.includes("Seat confirmed") && mine.includes("0 of 1 seats free"),
    mine,
  );
  await echo.screenshot({ path: `${OUT}/v19-requests-confirmed-1440.png`, fullPage: true });

  // V19-027 private conversation
  await echo.getByRole("link", { name: "Conversation" }).first().click();
  await echo.waitForURL((u) => /^\/app\/training\/requests\/[0-9a-f-]{36}$/.test(u.pathname), {
    timeout: 20000,
  });
  await echo.waitForLoadState("networkidle");
  const threadUrl = new URL(echo.url()).pathname;
  await echo.getByLabel("Message").fill("¿Hay aparcamiento en el hangar?");
  await echo.getByRole("button", { name: "Send message" }).click();
  ok("V19-027 the student sends a message", await status(echo, "Message sent."));
  await go(mro, threadUrl);
  ok(
    "V19-027 the provider reads it",
    (await mro.locator("main").innerText()).includes("¿Hay aparcamiento en el hangar?"),
  );

  // V19-031 notices
  await go(echo, "/app/notices");
  ok(
    "V19-031 the student is notified with the course and «Seat confirmed»",
    /Seat confirmed/.test(await echo.locator("main").innerText()) &&
      (await echo.locator("main").innerText()).includes(COURSE),
  );
  const trainingNotice = echo.locator("li").filter({ hasText: COURSE }).first();
  ok(
    "V19-031 the training notice has its own button («View my requests»)",
    (await trainingNotice.getByRole("button", { name: "View my requests" }).count()) === 1,
  );
  await trainingNotice.getByRole("button", { name: "View my requests" }).click();
  ok(
    "V19-031 opening it lands on «My requests» (no 404)",
    await echo
      .waitForURL((u) => u.pathname === "/app/training/requests", { timeout: 20000 })
      .then(
        () => true,
        () => false,
      ),
  );
  await go(mro, "/app/notices");
  ok(
    "V19-031 the provider is notified of the request",
    (await mro.locator("main").innerText()).includes(COURSE),
  );

  // V19-032 isolation: plain member, second organization, another professional, the student on provider pages
  const charlie = await as("charlie@crewflex.test");
  ok(
    "V19-002 a plain member has the catalog but no «Training provider» entry",
    (await charlie.getByRole("link", { name: "Training provider" }).count()) === 0 &&
      (await charlie.getByRole("link", { name: "Training", exact: true }).count()) >= 1,
  );
  ok(
    "V19-032 a plain member cannot open the provider workspace",
    (await go(charlie, "/app/organization/training/inbox"))?.status() === 404 ||
      !(await charlie.locator("main").innerText()).includes("Echo QA"),
  );
  const other = await as("admin.other@crewflex.test");
  const otherRes = await go(other, threadUrl);
  const otherText = await other.locator("main").innerText();
  ok(
    "V19-032 another organization's admin cannot read the conversation",
    !otherText.includes("¿Hay aparcamiento"),
    `${otherRes?.status()} ${otherText.slice(0, 300)}`,
  );
  await go(other, "/app/organization/training/inbox");
  ok(
    "V19-032 another organization's inbox does not list the request",
    !(await other.locator("main").innerText()).includes("Echo QA"),
  );
  const kilo = await as("kilo@crewflex.test");
  const kiloRes = await go(kilo, threadUrl);
  const kiloText = await kilo.locator("main").innerText();
  ok(
    "V19-032 another professional cannot read the conversation",
    !kiloText.includes("¿Hay aparcamiento"),
    `${kiloRes?.status()} ${kiloText.slice(0, 300)}`,
  );
  ok(
    "V19-032 the student cannot open a provider inbox",
    (await go(echo, "/app/organization/training/inbox"))?.status() === 404 ||
      !(await echo.locator("main").innerText()).includes("Echo QA"),
  );

  // V19-025 cancellation needs a reason
  await go(echo, "/app/training/requests");
  const cancelForm = echo
    .locator("form")
    .filter({ has: echo.getByRole("button", { name: "Cancel the seat" }) })
    .first();
  await cancelForm.getByRole("button", { name: "Cancel the seat" }).click();
  ok(
    "V19-025 cancelling without a reason is refused",
    await echo
      .locator("[role=alert]")
      .first()
      .isVisible()
      .catch(() => false),
  );
  await cancelForm.getByLabel("Reason (required)").fill("Cambio de turno");
  await cancelForm.getByRole("button", { name: "Cancel the seat" }).click();
  // The cancel form leaves with the confirmed state (its notice too).
  ok(
    "V19-025 the student cancels with a reason",
    await echo
      .getByRole("button", { name: "Cancel the seat" })
      .waitFor({ state: "detached", timeout: 20000 })
      .then(
        () => true,
        () => false,
      ),
  );
  await go(echo, "/app/training/requests");
  ok(
    "V19-025 the reason is shown",
    (await echo.locator("main").innerText()).includes("Cambio de turno"),
  );

  // V19-019 a general inquiry (no edition) reaches the provider
  await go(echo, "/app/training/requests");
  await echo.getByRole("link", { name: COURSE }).first().click();
  await echo.waitForURL((u) => /^\/app\/training\/[0-9a-f-]{36}$/.test(u.pathname), {
    timeout: 20000,
  });
  await echo.waitForLoadState("networkidle");
  const inquiry = echo
    .locator("form")
    .filter({ has: echo.getByRole("button", { name: "Send an inquiry" }) })
    .first();
  await inquiry.getByLabel("Name the provider will see").fill("Echo QA");
  await inquiry
    .getByLabel("Note for the provider (optional)")
    .fill("¿Habrá otra convocatoria en primavera?");
  // No navigation follows: wait for the server action's answer before reading the inbox.
  await Promise.all([
    echo.waitForResponse((r) => r.request().method() === "POST" && r.ok()),
    inquiry.getByRole("button", { name: "Send an inquiry" }).click(),
  ]);
  await go(mro, "/app/organization/training/inbox");
  ok(
    "V19-019 the provider reads the general inquiry",
    (await mro.locator("main").innerText()).includes("¿Habrá otra convocatoria en primavera?"),
  );

  // V19-015 the provider cancels the edition with a reason
  await go(mro, "/app/organization/training");
  const cancelEdition = panel(mro, COURSE);
  await cancelEdition
    .getByLabel("Reason for the cancellation (students are notified)")
    .fill("Instructor no disponible");
  await cancelEdition.getByRole("button", { name: "Cancel the edition" }).click();
  ok(
    "V19-015 the edition is cancelled with a reason",
    await cancelEdition
      .getByText("Cancelled")
      .first()
      .waitFor({ timeout: 20000 })
      .then(
        () => true,
        () => false,
      ),
  );

  // V19-001 at 390 the menu reaches «Training»
  await echo.setViewportSize({ width: 390, height: 844 });
  await go(echo, "/app/professional");
  await echo.getByRole("button", { name: "Menu" }).click();
  ok(
    "V19-001 at 390 the menu has «Training»",
    await echo.getByRole("link", { name: "Training", exact: true }).first().isVisible(),
  );
  await echo.setViewportSize({ width: 1440, height: 900 });

  // responsive pass of the five training pages at 390
  for (const [page, path] of [
    [echo, "/app/training"],
    [echo, "/app/training/requests"],
    [mro, "/app/organization/training"],
    [mro, "/app/organization/training/inbox"],
    [admin, "/app/admin/training"],
  ]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await go(page, path);
    ok(
      `390 ${path}: no horizontal overflow`,
      !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
    );
    await page.screenshot({
      path: `${OUT}/v19${path.replace(/\//g, "-")}-390.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 900 });
  }
} catch (e) {
  ok("flow ran to the end", false, e.stack);
}
ok("no page errors", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(`MARK ${PROVIDER} | ${COURSE}`);
console.log(`SUMMARY ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`}`);
process.exit(failed ? 1 : 0);
