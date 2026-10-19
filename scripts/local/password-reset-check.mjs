/* eslint-disable no-console -- CLI check script: console output is its report */
// Password recovery end to end on the LOCAL stack (docs/qa/LOCAL_ENVIRONMENT.md): forgot form →
// e-mail caught by Mailpit → /auth/confirm → /reset-password → new password works, old fails, other
// sessions revoked, link single-use; then restores the seed password with the same flow.
// Usage: PLAYWRIGHT_CORE=<dir with playwright-core> CHROME=<chromium> node scripts/local/password-reset-check.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const BASE = process.env.BASE ?? "http://localhost:3001";
const MAILPIT = process.env.MAILPIT ?? "http://127.0.0.1:56324";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
if (
  !/^http:\/\/(127\.0\.0\.1|localhost):/.test(URL_) ||
  !/^http:\/\/(localhost|127\.0\.0\.1):/.test(BASE)
) {
  console.error("refusing: local stack only");
  process.exit(2);
}
const EMAIL = "hotel@crewflex.test"; // seed account (supabase/seed.sql)
const SEED_PW = "crewflex-local-only";
const NEW_PW = "crewflex-reset-check-1";
const require = createRequire(
  `${process.env.PLAYWRIGHT_CORE ?? process.cwd() + "/node_modules"}/playwright-core/package.json`,
);
const { chromium } = require("playwright-core");

const results = [];
const ok = (name, cond, detail = "") => {
  results.push(!!cond);
  console.log(`${cond ? "PASS" : "FAIL"} ${name} ${detail}`);
};
const signIn = (password) =>
  createClient(URL_, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth.signInWithPassword({ email: EMAIL, password });
const mails = async (to) =>
  (await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json())
    .messages ?? [];
const clearMail = (to) =>
  fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`, { method: "DELETE" });
async function resetLink() {
  for (let i = 0; i < 30; i++) {
    const [m] = await mails(EMAIL);
    if (m) {
      const body = await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json();
      const link = /href="([^"]+)"/.exec(body.HTML ?? "")?.[1]?.replaceAll("&amp;", "&");
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true });
const ctx = await browser.newContext({ locale: "en-US" });
const page = await ctx.newPage();
const errors = [];
// Next 16 dev-only overlay bug (performance.measure with a negative time stamp) is not an app error.
page.on("pageerror", (e) => /on 'Performance'/.test(String(e)) || errors.push(String(e)));

async function requestReset(email) {
  await page.goto(`${BASE}/forgot-password`);
  await page.fill("#email", email);
  await page.click("form button[type=submit]");
  await page.locator('[role="status"]').waitFor();
  return page.locator('[role="status"]').innerText();
}
async function recover(from, to, label) {
  await clearMail(EMAIL);
  await requestReset(EMAIL);
  const link = await resetLink();
  ok(`${label}: recovery e-mail delivered with a link`, Boolean(link));
  await page.goto(link);
  await page.waitForURL(/\/reset-password/, { timeout: 15_000 });
  ok(
    `${label}: link opens the reset page with a session`,
    await page.locator("#password").isVisible(),
  );
  return link;
}

try {
  await page.goto(`${BASE}/login`);
  await page.getByRole("link", { name: /Forgot your password/ }).click();
  await page.waitForURL(/\/forgot-password/);
  ok("1 login links to the recovery form", true);

  await clearMail("nobody-e2e@crewflex.test");
  const unknown = await requestReset("nobody-e2e@crewflex.test");
  const known = await requestReset(EMAIL);
  ok(
    "2 same answer for unknown and existing accounts (no enumeration)",
    unknown.replace("nobody-e2e@crewflex.test", "X") === known.replace(EMAIL, "X"),
  );
  await new Promise((r) => setTimeout(r, 1500));
  ok(
    "2 no e-mail is sent to an unknown address",
    (await mails("nobody-e2e@crewflex.test")).length === 0,
  );

  const other = await signIn(SEED_PW); // a second session that must be revoked
  ok("3 a second session exists before the reset", Boolean(other.data.session));
  const link = await recover(SEED_PW, NEW_PW, "3");
  await page.fill("#password", NEW_PW);
  await page.fill("#confirm", NEW_PW + "x");
  await page.click("form button[type=submit]");
  // React resets the form when the action settles: wait for the error before typing again.
  await page.locator("#confirm-error").waitFor({ timeout: 10_000 });
  ok("3 mismatched confirmation is rejected", true);
  await page.fill("#password", NEW_PW);
  await page.fill("#confirm", NEW_PW);
  await Promise.all([page.waitForURL(/\/app/), page.click("form button[type=submit]")]);
  ok("3 new password saved, user lands in /app", page.url().includes("/app"));
  ok("3 new password signs in", Boolean((await signIn(NEW_PW)).data.session));
  ok("3 old password no longer signs in", Boolean((await signIn(SEED_PW)).error));
  const refreshed = await createClient(URL_, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth.refreshSession({ refresh_token: other.data.session.refresh_token });
  ok("3 the other session was signed out (refresh refused)", Boolean(refreshed.error));

  const fresh = await browser.newContext({ locale: "en-US" });
  const p2 = await fresh.newPage();
  await p2.goto(link);
  await p2.waitForURL(/forgot-password\?expired=1/, { timeout: 15_000 });
  ok("4 a used link is refused and explained", await p2.locator('main [role="alert"]').isVisible());
  await p2.goto(`${BASE}/reset-password`);
  ok(
    "4 /reset-password without a session asks for a new link",
    await p2.locator('a[href="/forgot-password"]').isVisible(),
  );
  await fresh.close();

  // Restore the seed password through the same flow (also checks SAME_PASSWORD).
  await recover(NEW_PW, SEED_PW, "5");
  await page.fill("#password", NEW_PW);
  await page.fill("#confirm", NEW_PW);
  await page.click("form button[type=submit]");
  const alert = page.locator('form [role="alert"]');
  await alert.waitFor({ timeout: 10_000 });
  const alertText = await alert.innerText();
  ok("5 reusing the current password is refused", /different/.test(alertText), alertText);
  await page.fill("#password", SEED_PW);
  await page.fill("#confirm", SEED_PW);
  await Promise.all([page.waitForURL(/\/app/), page.click("form button[type=submit]")]);
  ok("5 seed password restored", Boolean((await signIn(SEED_PW)).data.session));
} catch (e) {
  ok("unexpected error", false, String(e));
  console.log(
    `hotel's password may now be ${NEW_PW}: reset it locally before re-running (docs/qa/LOCAL_ENVIRONMENT.md).`,
  );
}
ok("6 no client errors", errors.length === 0, errors.join(" | "));
await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
