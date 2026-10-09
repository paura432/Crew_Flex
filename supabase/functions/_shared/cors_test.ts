import { assertEquals } from "@std/assert";
import { allowedOrigins } from "./cors.ts";

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
  "CORS: without ALLOWED_ORIGINS, localhost is allowed only outside the hosted runtime",
  () => {
    withEnv({ ALLOWED_ORIGINS: undefined, SB_REGION: undefined }, () => {
      assertEquals(allowedOrigins(), ["http://localhost:3000", "http://127.0.0.1:3000"]);
    });
    withEnv({ ALLOWED_ORIGINS: undefined, SB_REGION: "eu-central-1" }, () => {
      assertEquals(allowedOrigins(), []);
    });
  },
);

Deno.test("CORS: ALLOWED_ORIGINS is parsed, trimmed and never contains *", () => {
  withEnv(
    {
      ALLOWED_ORIGINS: " https://crew-flex.vercel.app , * ,, http://localhost:3000",
      SB_REGION: "x",
    },
    () => {
      assertEquals(allowedOrigins(), ["https://crew-flex.vercel.app", "http://localhost:3000"]);
    },
  );
});
