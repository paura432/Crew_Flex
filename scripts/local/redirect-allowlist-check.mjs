/* eslint-disable no-console -- CLI check script: console output is its report */
// Lote 8 (second audit, S-4): the recovery `redirectTo` is built from the request Origin; this proves the
// LOCAL Supabase allowlist (supabase/config.toml additional_redirect_urls) is what bounds it: external,
// malformed or look-alike targets fall back to site_url; `next=//…` reaches /auth/confirm, where
// safeConfirmNext (unit-tested) sends it to /app. Usage:
//   SR=<local SERVICE_ROLE_KEY> ANON=<local ANON_KEY> node scripts/local/redirect-allowlist-check.mjs
const A = "http://127.0.0.1:56321/auth/v1",
  M = "http://127.0.0.1:56324";
const SITE = "http://localhost:3000"; // local site_url
let failed = 0;
for (const u of [A, M]) if (!/^http:\/\/127\.0\.0\.1:/.test(u)) throw new Error("local only");
const H = { apikey: process.env.ANON, "Content-Type": "application/json" };
const SRH = { ...H, Authorization: `Bearer ${process.env.SR}` };
const email = `redir-${Date.now()}@crewflex.test`;
const u = await (
  await fetch(`${A}/admin/users`, {
    method: "POST",
    headers: SRH,
    body: JSON.stringify({ email, password: "redir-pass-000", email_confirm: true }),
  })
).json();
const cases = [
  ["https://evil.example/auth/confirm?next=/reset-password", SITE],
  ["null/auth/confirm?next=/reset-password", SITE],
  ["http://localhost:3001.evil.example/auth/confirm", SITE],
  ["http://localhost:3001@evil.example/auth/confirm", SITE],
  ["http://localhost:3001/auth/confirm?next=//evil.example", "http://localhost:3001"],
  ["http://localhost:3001/auth/confirm?next=/reset-password", "http://localhost:3001"],
];
for (const [redirect, expected] of cases) {
  await fetch(`${M}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`, {
    method: "DELETE",
  });
  await new Promise((r) => setTimeout(r, 1100)); // max_frequency 1s
  const r = await fetch(`${A}/recover?redirect_to=${encodeURIComponent(redirect)}`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ email }),
  });
  let link = null;
  for (let i = 0; i < 20 && !link; i++) {
    const m = (
      await (await fetch(`${M}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json()
    ).messages?.[0];
    if (m)
      link = /href="([^"]+)"/
        .exec((await (await fetch(`${M}/api/v1/message/${m.ID}`)).json()).HTML)?.[1]
        ?.replaceAll("&amp;", "&");
    else await new Promise((r) => setTimeout(r, 300));
  }
  const v = link ? await fetch(link, { redirect: "manual" }) : null;
  const loc = v?.headers.get("location") ?? "-";
  const origin = new URL(loc, "http://x").origin;
  const pass = r.status === 200 && origin === expected;
  if (!pass) failed++;
  console.log(
    `${pass ? "PASS" : "FAIL"} ${redirect.padEnd(58)} → ${origin}${new URL(loc, "http://x").pathname}`,
  );
}
await fetch(`${A}/admin/users/${u.id}`, { method: "DELETE", headers: SRH });
process.exit(failed ? 1 : 0);
