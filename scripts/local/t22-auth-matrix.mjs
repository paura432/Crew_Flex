/* eslint-disable no-console -- CLI check script: console output is its report */
// T22 password-change matrix against LOCAL GoTrue only (docs/product/SECURITY_PRIVACY.md T22).
// Targets: the local stack (default settings, via Kong) and two throw-away clones of the local auth
// container, each with ONE flag the CLI's config.toml cannot set locally:
//   E=$(mktemp); docker inspect supabase_auth_crew-flex --format '{{range .Config.Env}}{{println .}}{{end}}' > $E
//   I=$(docker inspect supabase_auth_crew-flex --format '{{.Config.Image}}')
//   docker run -d --rm --name cf-t22-current --network supabase_network_crew-flex -p 127.0.0.1:56398:9999 \
//     --env-file $E -e GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD=true $I auth
//   docker run -d --rm --name cf-t22-reauth --network supabase_network_crew-flex -p 127.0.0.1:56397:9999 \
//     --env-file $E -e GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_REAUTHENTICATION=true $I auth
//   SR=<local SERVICE_ROLE_KEY> ANON=<local ANON_KEY> node scripts/local/t22-auth-matrix.mjs
//   docker stop cf-t22-current cf-t22-reauth; rm $E
// Creates and deletes one synthetic t22-* user per target; ages one session in the local DB.
const SR = process.env.SR,
  ANON = process.env.ANON;
const T = {
  default: "http://127.0.0.1:56321/auth/v1",
  require_current_password: "http://127.0.0.1:56398",
  secure_password_change: "http://127.0.0.1:56397",
};
for (const u of Object.values(T))
  if (!/^http:\/\/127\.0\.0\.1:/.test(u)) throw new Error("local only");
const h = (tok) => ({
  apikey: ANON,
  "Content-Type": "application/json",
  ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
});
const j = async (r) => ({ s: r.status, b: await r.json().catch(() => ({})) });
const req = (base, path, method, tok, body) =>
  fetch(base + path, { method, headers: h(tok), body: body && JSON.stringify(body) }).then(j);
const psql = async (sql) => {
  const { execFileSync } = await import("node:child_process");
  return execFileSync("docker", [
    "exec",
    "-i",
    "supabase_db_crew-flex",
    "psql",
    "-U",
    "postgres",
    "-At",
    "-c",
    sql,
  ])
    .toString()
    .trim();
};
const out = [];
const rec = (t, name, r) =>
  out.push(`${t.padEnd(25)} ${name.padEnd(52)} ${r.s} ${r.b.error_code ?? r.b.code ?? ""}`);
for (const [t, base] of Object.entries(T)) {
  const email = `t22-${t.replaceAll("_", "-")}-${Date.now()}@crewflex.test`;
  const P0 = "t22-pass-000-x",
    P1 = "t22-pass-111-x",
    P2 = "t22-pass-222-x",
    P3 = "t22-pass-333-x";
  const created = await req(base, "/admin/users", "POST", SR, {
    email,
    password: P0,
    email_confirm: true,
  });
  const id = created.b.id;
  const login = async (p) =>
    (await req(base, "/token?grant_type=password", "POST", null, { email, password: p })).b;
  const s1 = await login(P0),
    s2 = await login(P0);
  rec(
    t,
    "1 ordinary fresh session, new password only",
    await req(base, "/user", "PUT", s1.access_token, { password: P1 }),
  );
  let cur = (await login(P1)).access_token ? P1 : P0;
  rec(
    t,
    "1b other session refresh after that change",
    await req(base, "/token?grant_type=refresh_token", "POST", null, {
      refresh_token: s2.refresh_token,
    }),
  );
  if (t === "require_current_password") {
    const s = await login(cur);
    rec(
      t,
      "2 ordinary session, wrong current_password",
      await req(base, "/user", "PUT", s.access_token, {
        password: P2,
        current_password: "nope-nope-nope",
      }),
    );
    rec(
      t,
      "3 ordinary session, correct current_password",
      await req(base, "/user", "PUT", s.access_token, { password: P2, current_password: cur }),
    );
    cur = (await login(P2)).access_token ? P2 : cur;
  }
  // Old session (> 24 h): age it in the local DB.
  const old = await login(cur);
  const sid = JSON.parse(Buffer.from(old.access_token.split(".")[1], "base64url")).session_id;
  await psql(
    `update auth.sessions set created_at = now() - interval '25 hours' where id = '${sid}'`,
  );
  rec(
    t,
    "4 old session (>24h), new password only",
    await req(base, "/user", "PUT", old.access_token, { password: P3 }),
  );
  cur = (await login(P3)).access_token ? P3 : cur;
  // Legitimate recovery: link generated, verified → recovery session, no current password.
  const link = await req(base, "/admin/generate_link", "POST", SR, { type: "recovery", email });
  const v = await req(base, "/verify", "POST", null, {
    type: "recovery",
    token_hash: link.b.hashed_token ?? link.b.properties?.hashed_token,
  });
  const amr = v.b.access_token
    ? JSON.parse(Buffer.from(v.b.access_token.split(".")[1], "base64url"))
        .amr?.map((a) => a.method)
        .join("+")
    : "-";
  rec(
    t,
    `5 recovery session (amr ${amr}), new password only`,
    await req(base, "/user", "PUT", v.b.access_token, { password: cur === P0 ? P1 : P0 }),
  );
  await req(base, `/admin/users/${id}`, "DELETE", SR);
}
console.log(out.join("\n"));
