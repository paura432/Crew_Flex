import { assert, assertEquals, assertThrows } from "@std/assert";
import { ApiError, fromDatabaseError } from "../_shared/errors.ts";
import { parseValue } from "../_shared/validation.ts";
import { TRAINING_CONFLICTS } from "../../../src/domain/training.ts";
import { APPLICATION_CONFLICTS } from "../../../src/domain/applications.ts";
import {
  editionInput,
  requestInput,
  reviewInput,
  trainingQuery,
  trainingWrite,
  transitionInput,
} from "../../../src/lib/validation/training.ts";
import {
  courseArgs,
  editionArgs,
  handler,
  KEYED_OPS,
  requestArgs,
  toSaved,
  toTransition,
  transitionArgs,
} from "./index.ts";

const silence = () => {
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  return () => Object.assign(console, { log, error });
};

const ID = "00000000-0000-4000-8000-0000000000aa";
const AT = "2031-01-01T10:00:00.000Z";
const future = (days: number, hours = 0) =>
  new Date(Date.now() + days * 86_400_000 + hours * 3_600_000).toISOString();

for (const method of ["GET", "POST"] as const) {
  Deno.test(
    `training ${method} rejects unauthenticated requests before any database access`,
    async () => {
      const restore = silence();
      const res = await handler(
        new Request("http://fn/training?view=requests", {
          method,
          headers: { "Idempotency-Key": crypto.randomUUID() },
          body:
            method === "GET"
              ? undefined
              : JSON.stringify({ op: "favorite", input: { courseId: ID } }),
        }),
      );
      restore();
      assertEquals([res.status, (await res.json()).error.code], [401, "UNAUTHORIZED"]);
    },
  );
}

Deno.test("training has no PATCH/PUT/DELETE; CORS preflight lists GET and POST", async () => {
  const restore = silence();
  for (const method of ["PATCH", "PUT", "DELETE"]) {
    const res = await handler(new Request("http://fn/training", { method }));
    assertEquals(res.status, 405);
  }
  const previous = Deno.env.get("ALLOWED_ORIGINS");
  Deno.env.set("ALLOWED_ORIGINS", "http://localhost:3000");
  const res = await handler(
    new Request("http://fn/training", {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:3000" },
    }),
  );
  if (previous === undefined) Deno.env.delete("ALLOWED_ORIGINS");
  else Deno.env.set("ALLOWED_ORIGINS", previous);
  restore();
  assertEquals(res.headers.get("Access-Control-Allow-Methods"), "GET, POST, OPTIONS");
});

Deno.test("strict inputs: identity, side and role never come from the body", () => {
  for (const extra of [
    { userId: ID },
    { professionalId: ID },
    { role: "admin" },
    {
      side: "provider",
    },
  ]) {
    assertThrows(
      () =>
        parseValue(
          {
            courseId: ID,
            editionId: ID,
            kind: "seat",
            applicantName: "A",
            ...extra,
          },
          requestInput,
        ),
      ApiError,
    );
    assertThrows(
      () =>
        parseValue(
          {
            requestId: ID,
            to: "withdrawn",
            expectedUpdatedAt: AT,
            ...extra,
          },
          transitionInput,
        ),
      ApiError,
    );
  }
  assertThrows(() => parseValue({ view: "inbox" }, trainingQuery), ApiError); // organizationId required
  assertThrows(() => parseValue({ view: "catalog", limit: 100 }, trainingQuery), ApiError);
  assertEquals(parseValue({ view: "catalog" }, trainingQuery), {
    view: "catalog",
    offset: 0,
    limit: 12,
  });
});

Deno.test(
  "a seat names an edition; a reason exactly for reject/cancel; accept = current offer + explicit terms",
  () => {
    assertThrows(
      () => parseValue({ courseId: ID, kind: "seat", applicantName: "A" }, requestInput),
      ApiError,
    );
    assertEquals(
      parseValue({ courseId: ID, kind: "inquiry", applicantName: "A" }, requestInput).units,
      1,
    );
    assertThrows(
      () => parseValue({ requestId: ID, to: "rejected", expectedUpdatedAt: AT }, transitionInput),
      ApiError,
    );
    assertThrows(
      () =>
        parseValue(
          {
            requestId: ID,
            to: "waitlisted",
            expectedUpdatedAt: AT,
            reason: "x",
          },
          transitionInput,
        ),
      ApiError,
    );
    assertThrows(
      () =>
        parseValue(
          {
            requestId: ID,
            to: "accepted",
            expectedUpdatedAt: AT,
            offerId: ID,
          },
          transitionInput,
        ),
      ApiError,
    );
    assertThrows(
      () =>
        parseValue(
          {
            requestId: ID,
            to: "accepted",
            expectedUpdatedAt: AT,
            offerId: ID,
            acceptTerms: false,
          },
          transitionInput,
        ),
      ApiError,
    );
    const accept = parseValue(
      {
        requestId: ID,
        to: "accepted",
        expectedUpdatedAt: AT,
        offerId: ID,
        acceptTerms: true,
      },
      transitionInput,
    );
    assertEquals(transitionArgs(accept, ID, ID).p_accept_terms, true);
    assertThrows(
      () => parseValue({ requestId: ID, to: "finished", expectedUpdatedAt: AT }, transitionInput),
      ApiError,
    );
    assertEquals(
      parseValue(
        {
          requestId: ID,
          to: "finished",
          expectedUpdatedAt: AT,
          outcome: "attended",
        },
        transitionInput,
      ).outcome,
      "attended",
    );
    assertThrows(
      () =>
        parseValue(
          {
            requestId: ID,
            to: "confirmed",
            expectedUpdatedAt: AT,
            quoteTotalCents: 5,
          },
          transitionInput,
        ),
      ApiError,
    );
  },
);

Deno.test(
  "editions: price exactly unless quote, sessions validated like the SQL, self-paced needs a deadline",
  () => {
    const base = {
      courseId: ID,
      mode: "onsite",
      capacity: 10,
      priceUnit: "person",
      priceCents: 20000,
      priceIncludes: "IVA incluido",
      policy: "Cancelación 7 días",
      timeZone: "Europe/Madrid",
      sessions: [{ startsAt: future(30), endsAt: future(30, 8) }],
    };
    const ok = parseValue(base, editionInput);
    assertEquals(editionArgs(ok).p_sessions.length, 1);
    assertEquals(ok.sessions[0]!.element, "theory");
    assertThrows(() => parseValue({ ...base, priceCents: null }, editionInput), ApiError);
    assertThrows(() => parseValue({ ...base, priceUnit: "quote" }, editionInput), ApiError);
    assertEquals(
      parseValue({ ...base, priceUnit: "quote", priceCents: null }, editionInput).priceCents,
      null,
    );
    assertThrows(() => parseValue({ ...base, priceCents: 19.99 }, editionInput), ApiError); // cents are integers
    assertThrows(() => parseValue({ ...base, sessions: [] }, editionInput), ApiError);
    assertEquals(
      parseValue({ ...base, sessions: [], provisional: true }, editionInput).provisional,
      true,
    );
    assertThrows(
      () =>
        parseValue(
          {
            ...base,
            sessions: [{ startsAt: future(30), endsAt: future(31, 1) }],
          },
          editionInput,
        ),
      ApiError,
    );
    assertThrows(
      () => parseValue({ ...base, mode: "selfpaced", sessions: [] }, editionInput),
      ApiError,
    );
    assertEquals(
      parseValue(
        {
          ...base,
          mode: "selfpaced",
          sessions: [],
          deadline: future(60),
        },
        editionInput,
      ).mode,
      "selfpaced",
    );
    assertThrows(() => parseValue({ ...base, id: ID }, editionInput), ApiError); // version required with id
    assertThrows(() => parseValue({ ...base, capacity: 0 }, editionInput), ApiError);
  },
);

Deno.test("course scope reference and review note rules", () => {
  const course = {
    organizationId: ID,
    title: "HF",
    family: "safety",
    description: "d",
    language: "Español",
    certificateInfo: "c",
    issuer: "i",
  };
  const args = courseArgs(parseValue(course, trainingWrite.options[1].shape.input));
  assertEquals([args.p_scope, args.p_approval_ref, args.p_id], ["general", null, null]);
  assertThrows(
    () => parseValue({ ...course, scope: "part147" }, trainingWrite.options[1].shape.input),
    ApiError,
  );
  assertThrows(
    () =>
      parseValue(
        {
          kind: "course",
          id: ID,
          decision: "changes",
          expectedUpdatedAt: AT,
        },
        reviewInput,
      ),
    ApiError,
  );
  assertThrows(
    () =>
      parseValue(
        {
          kind: "provider",
          id: ID,
          decision: "published",
          expectedUpdatedAt: AT,
        },
        reviewInput,
      ),
    ApiError,
  );
  assertEquals(
    parseValue(
      {
        kind: "provider",
        id: ID,
        decision: "reviewed",
        expectedUpdatedAt: AT,
      },
      reviewInput,
    ).decision,
    "reviewed",
  );
});

Deno.test("creates and transitions need the Idempotency-Key; the request args carry it", () => {
  assertEquals([...KEYED_OPS], ["request", "transition", "message"]);
  const key = crypto.randomUUID();
  const args = requestArgs(
    parseValue({ courseId: ID, kind: "inquiry", applicantName: "A" }, requestInput),
    key,
    ID,
  );
  assertEquals([args.p_idempotency_key, args.p_edition_id, args.p_units], [key, null, 1]);
});

Deno.test(
  "row mappers: saves, transitions; CFT codes map to TRAINING_CONFLICTS and CFA17 to the training overlap",
  () => {
    assertEquals(toSaved([{ id: ID, status: "draft", updated_at: AT, session_count: 2 }]), {
      id: ID,
      status: "draft",
      updatedAt: AT,
      sessionCount: 2,
    });
    const t = toTransition([
      {
        request_id: ID,
        status: "confirmed",
        event_id: ID,
        offer_id: null,
        updated_at: AT,
        replayed: false,
      },
    ]);
    assertEquals(t.transition.status, "confirmed");
    TRAINING_CONFLICTS.forEach((reason, i) => {
      const e = fromDatabaseError({
        code: `CFT${String(i + 1).padStart(2, "0")}`,
      });
      assertEquals([e.status, e.reason], [409, reason]);
    });
    assertEquals(fromDatabaseError({ code: "CFA17" }).reason, "OVERLAPPING_TRAINING");
    assertEquals(APPLICATION_CONFLICTS[16], "OVERLAPPING_TRAINING");
    assertEquals(fromDatabaseError({ code: "0A000" }).status, 404); // flag off
    assert(fromDatabaseError({ code: "CFT99" }).reason === undefined);
  },
);
