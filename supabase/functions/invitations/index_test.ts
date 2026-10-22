import { assertEquals } from "@std/assert";
import { handler, invitationLink } from "./index.ts";
import { createInvitationInput } from "../../../src/lib/validation/account.ts";

const silence = () => {
  const { log, error, warn } = console;
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
  return () => Object.assign(console, { log, error, warn });
};

Deno.test("invitations POST rejects unauthenticated requests before reading the body", async () => {
  const restore = silence();
  const res = await handler(
    new Request("http://fn/invitations", {
      method: "POST",
      body: JSON.stringify({ email: "x@crewflex.test", accountType: "professional" }),
    }),
  );
  restore();
  assertEquals(res.status, 401);
  assertEquals((await res.json()).error.code, "UNAUTHORIZED");
});

Deno.test("invitations has no GET/PATCH/PUT/DELETE", async () => {
  const restore = silence();
  for (const method of ["GET", "PATCH", "PUT", "DELETE"]) {
    const res = await handler(new Request("http://fn/invitations", { method }));
    assertEquals(res.status, 405);
  }
  restore();
});

Deno.test(
  "the link points at the app's own origin and carries the code, or nothing without one",
  () => {
    const code = "a".repeat(64);
    assertEquals(
      invitationLink(code, ["https://crew-flex.vercel.app", "http://localhost:3000"]),
      `https://crew-flex.vercel.app/register?invite=${code}`,
    );
    assertEquals(invitationLink(code, []), null);
  },
);

Deno.test(
  "the payload is e-mail + account type only: no role, no platform admin, no extras",
  () => {
    assertEquals(
      createInvitationInput.safeParse({ email: "x@crewflex.test", accountType: "organization" })
        .success,
      true,
    );
    for (const bad of [
      { email: "x@crewflex.test", accountType: "platform_admin" },
      { email: "x@crewflex.test", accountType: "professional", role: "admin" },
      { email: "x@crewflex.test", accountType: "professional", platformRole: "platform_admin" },
      { email: "not-an-email", accountType: "professional" },
      { email: "x@crewflex.test" },
    ]) {
      assertEquals(createInvitationInput.safeParse(bad).success, false, JSON.stringify(bad));
    }
  },
);
