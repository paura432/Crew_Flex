import { assertEquals, assertThrows } from "@std/assert";
import { handler, toNotice, toNoticePage } from "./index.ts";

const silence = () => {
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  return () => Object.assign(console, { log, error });
};

const APP = "00000000-0000-4000-8000-0000000000a1";
const REQ = "00000000-0000-4000-8000-0000000000b1";

const row = (over: Record<string, unknown> = {}) => ({
  id: "00000000-0000-4000-8000-0000000000c1",
  kind: "application",
  audience: "organization",
  created_at: "2026-10-23T08:00:00+00:00",
  read_at: null,
  application_id: APP,
  application_status: "received",
  requirement_status: null,
  requirement_id: REQ,
  requirement_title: "B1.1 · A320 line maintenance reinforcement",
  organization_name: null,
  candidate_name: null,
  candidate_ref: "CF-0123456789",
  total: 3,
  ...over,
});

for (const method of ["GET", "PATCH"] as const) {
  Deno.test(`notifications ${method} rejects unauthenticated requests`, async () => {
    const restore = silence();
    const res = await handler(
      new Request("http://fn/notifications", {
        method,
        body: method === "GET" ? undefined : JSON.stringify({ all: true }),
      }),
    );
    restore();
    assertEquals(res.status, 401);
    assertEquals((await res.json()).error.code, "UNAUTHORIZED");
  });
}

Deno.test("notifications has no POST/PUT/DELETE (the database writes notices)", async () => {
  const restore = silence();
  for (const method of ["POST", "PUT", "DELETE"]) {
    const res = await handler(new Request("http://fn/notifications", { method }));
    assertEquals(res.status, 405);
  }
  restore();
});

Deno.test("an organization row keeps the applicant label and drops technician-only fields", () => {
  assertEquals(toNotice(row({ organization_name: "Leak" })), {
    id: "00000000-0000-4000-8000-0000000000c1",
    kind: "application",
    audience: "organization",
    createdAt: "2026-10-23T08:00:00.000Z",
    readAt: null,
    applicationId: APP,
    requirementId: REQ,
    requirementTitle: "B1.1 · A320 line maintenance reinforcement",
    organizationName: null,
    applicationStatus: "received",
    requirementStatus: null,
    candidate: { name: null, ref: "CF-0123456789" },
    outreachUrgency: null,
    training: null,
  });
});

Deno.test(
  "an outreach row (v2-17) is the reader's own: urgency, no application, no candidate",
  () => {
    const outreach = row({
      kind: "outreach",
      audience: "technician",
      application_id: null,
      application_status: null,
      organization_name: "Demo MRO Madrid",
      candidate_ref: null,
      outreach_urgency: "aog",
    });
    const notice = toNotice(outreach);
    assertEquals(
      [notice.kind, notice.applicationId, notice.outreachUrgency, notice.organizationName],
      ["outreach", null, "aog", "Demo MRO Madrid"],
    );
    assertEquals(notice.candidate, null);
    // An application kind keeps no urgency even if a row carried one.
    assertEquals(toNotice(row({ outreach_urgency: "urgent" })).outreachUrgency, null);
    // Inconsistent rows are refused, never shown half-rendered.
    assertThrows(() => toNotice({ ...outreach, outreach_urgency: null }));
    assertThrows(() => toNotice({ ...outreach, audience: "organization" }));
    assertThrows(() => toNotice({ ...outreach, application_id: APP }));
    assertThrows(() => toNotice({ ...outreach, outreach_urgency: "planned" }));
    assertThrows(() => toNotice(row({ application_id: null })));
  },
);

Deno.test("a technician row has the organization name and no candidate", () => {
  const notice = toNotice(
    row({
      kind: "requirement",
      audience: "technician",
      application_status: null,
      requirement_status: "paused",
      organization_name: "Demo MRO Madrid",
      candidate_ref: null,
      read_at: "2026-10-23T09:00:00Z",
    }),
  );
  assertEquals(
    [notice.organizationName, notice.candidate, notice.requirementStatus, notice.readAt],
    ["Demo MRO Madrid", null, "paused", "2026-10-23T09:00:00.000Z"],
  );
});

Deno.test("unknown kinds, audiences or statuses are refused, never passed through raw", () => {
  assertThrows(() => toNotice(row({ kind: "broadcast" })));
  assertThrows(() => toNotice(row({ audience: "admin" })));
  assertThrows(() => toNotice(row({ requirement_status: "covered" })));
  // The redirect is built from these ids: anything but a UUID is refused.
  assertThrows(() => toNotice(row({ requirement_id: "../../admin" })));
  assertThrows(() => toNotice(row({ application_id: "x#y" })));
});

Deno.test("a page carries the window total; an empty page counts 0", () => {
  assertEquals(toNoticePage([row(), row({ id: "00000000-0000-4000-8000-0000000000c2" })]).total, 3);
  assertEquals(toNoticePage([]), { notices: [], total: 0 });
});
