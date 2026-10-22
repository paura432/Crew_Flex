import { assertEquals } from "@std/assert";
import { handler, toBase64 } from "./index.ts";
import { closeAccountInput } from "../../../src/lib/validation/account.ts";

const silence = () => {
  const { log, error, warn } = console;
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
  return () => Object.assign(console, { log, error, warn });
};

for (const method of ["GET", "DELETE"] as const) {
  Deno.test(`account ${method} rejects unauthenticated requests`, async () => {
    const restore = silence();
    const res = await handler(
      new Request("http://fn/account", {
        method,
        body: method === "GET" ? undefined : JSON.stringify({ confirm: "CERRAR", userId: "x" }),
      }),
    );
    restore();
    assertEquals(res.status, 401);
    assertEquals((await res.json()).error.code, "UNAUTHORIZED");
  });
}

Deno.test("account has no POST/PATCH/PUT", async () => {
  const restore = silence();
  for (const method of ["POST", "PATCH", "PUT"]) {
    const res = await handler(new Request("http://fn/account", { method }));
    assertEquals(res.status, 405);
  }
  restore();
});

Deno.test(
  "closing needs exactly the confirmation word and nothing else (never an account id)",
  () => {
    assertEquals(closeAccountInput.safeParse({ confirm: "CERRAR" }).success, true);
    assertEquals(closeAccountInput.safeParse({ confirm: "CLOSE" }).success, true);
    for (const bad of [
      {},
      { confirm: "cerrar" },
      { confirm: "CERRAR " },
      { confirm: "CERRAR", userId: "00000000-0000-4000-8000-000000000011" },
    ]) {
      assertEquals(closeAccountInput.safeParse(bad).success, false, JSON.stringify(bad));
    }
  },
);

Deno.test("toBase64 round-trips small and multi-chunk files", () => {
  for (const size of [0, 1, 3, 0x8000 + 7, 100_000]) {
    const bytes = Uint8Array.from({ length: size }, (_, i) => (i * 31) % 256);
    const decoded = Uint8Array.from(atob(toBase64(bytes)), (c) => c.charCodeAt(0));
    assertEquals(decoded, bytes);
  }
  assertEquals(toBase64(new TextEncoder().encode("%PDF-1.4")), btoa("%PDF-1.4"));
});
