import { assertEquals } from "@std/assert";
import { handler } from "./index.ts";

const silence = () => {
  const { log, error, warn } = console;
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
  return () => Object.assign(console, { log, error, warn });
};

const withEnv = async (value: string | undefined, fn: () => Promise<void>) => {
  const previous = Deno.env.get("DOCUMENTS_MAINTENANCE_ENABLED");
  if (value === undefined) Deno.env.delete("DOCUMENTS_MAINTENANCE_ENABLED");
  else Deno.env.set("DOCUMENTS_MAINTENANCE_ENABLED", value);
  try {
    await fn();
  } finally {
    if (previous === undefined) Deno.env.delete("DOCUMENTS_MAINTENANCE_ENABLED");
    else Deno.env.set("DOCUMENTS_MAINTENANCE_ENABLED", previous);
  }
};

for (const value of [undefined, "", "false", "1", "TRUE"]) {
  Deno.test(
    `documents-maintenance is a 404 unless enabled (${JSON.stringify(value)})`,
    async () => {
      await withEnv(value, async () => {
        const restore = silence();
        const res = await handler(
          new Request("http://fn/documents-maintenance?apply=1", {
            method: "POST",
            headers: { Authorization: "Bearer x" },
          }),
        );
        restore();
        assertEquals(res.status, 404);
      });
    },
  );
}

Deno.test("documents-maintenance requires a signed-in caller when enabled", async () => {
  await withEnv("true", async () => {
    const restore = silence();
    const res = await handler(
      new Request("http://fn/documents-maintenance?apply=1", { method: "POST" }),
    );
    restore();
    assertEquals(res.status, 401);
    assertEquals((await res.json()).error.code, "UNAUTHORIZED");
  });
});

Deno.test("documents-maintenance accepts POST only", async () => {
  await withEnv("true", async () => {
    const restore = silence();
    for (const method of ["GET", "DELETE", "PATCH", "PUT"]) {
      const res = await handler(new Request("http://fn/documents-maintenance", { method }));
      assertEquals(res.status, 405, method);
    }
    restore();
  });
});
