import { assertEquals } from "@std/assert";
import { allowedOrigins, corsHeaders } from "./cors.ts";

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const previous = Object.fromEntries(Object.keys(vars).map((k) => [k, Deno.env.get(k)]));
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  }
}

Deno.test(
  "CORS fails closed: no ALLOWED_ORIGINS → no origin, regardless of runtime markers",
  () => {
    for (const region of [undefined, "eu-central-1"]) {
      withEnv({ ALLOWED_ORIGINS: undefined, SB_REGION: region }, () => {
        assertEquals(allowedOrigins(), []);
        const res = corsHeaders(
          new Request("http://fn", { headers: { Origin: "http://localhost:3000" } }),
          ["GET"],
        );
        assertEquals(res["Access-Control-Allow-Origin"], undefined);
        assertEquals(res["Vary"], "Origin");
      });
      withEnv({ ALLOWED_ORIGINS: "", SB_REGION: region }, () => assertEquals(allowedOrigins(), []));
    }
  },
);

Deno.test("CORS: ALLOWED_ORIGINS is parsed, trimmed; wildcards and non-origins are dropped", () => {
  withEnv(
    {
      ALLOWED_ORIGINS:
        " https://crew-flex.vercel.app , * , https://*.vercel.app ,, http://localhost:3000, evil",
    },
    () => {
      assertEquals(allowedOrigins(), ["https://crew-flex.vercel.app", "http://localhost:3000"]);
    },
  );
});

Deno.test("CORS: only an exact allowlisted origin is echoed", () => {
  withEnv({ ALLOWED_ORIGINS: "https://crew-flex.vercel.app" }, () => {
    const ok = corsHeaders(
      new Request("http://fn", { headers: { Origin: "https://crew-flex.vercel.app" } }),
      ["GET", "POST"],
    );
    assertEquals(ok["Access-Control-Allow-Origin"], "https://crew-flex.vercel.app");
    assertEquals(ok["Access-Control-Allow-Methods"], "GET, POST, OPTIONS");
    const sub = corsHeaders(
      new Request("http://fn", {
        headers: { Origin: "https://crew-flex.vercel.app.evil.example" },
      }),
      ["GET"],
    );
    assertEquals(sub["Access-Control-Allow-Origin"], undefined);
  });
});
