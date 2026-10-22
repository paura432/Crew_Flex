import { assertEquals } from "@std/assert";
import { parseValue } from "../_shared/validation.ts";
import { matchingEvaluateInput } from "../../../src/lib/validation/work-requirement.ts";
import { handler } from "./index.ts";

const silence = () => {
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  return () => Object.assign(console, { log, error });
};

Deno.test(
  "matching-evaluate rejects unauthenticated requests, the live count included",
  async () => {
    const restore = silence();
    for (const body of [
      { requirementId: "33333333-3333-4333-8333-000000000001" },
      {
        organizationId: "22222222-2222-4222-8222-000000000001",
        startsAt: "2031-11-10T08:00:00.000Z",
        endsAt: "2031-11-12T16:00:00.000Z",
        urgency: "planned",
        hardQualificationTypeIds: ["11111111-1111-4111-8111-000000000001"],
      },
    ]) {
      const res = await handler(
        new Request("http://fn/matching-evaluate", { method: "POST", body: JSON.stringify(body) }),
      );
      assertEquals([res.status, (await res.json()).error.code], [401, "UNAUTHORIZED"]);
    }
    restore();
  },
);

Deno.test(
  "the body is a requirement id or the builder's period — never both, never identities",
  () => {
    const ok = (body: unknown) => {
      try {
        parseValue(body, matchingEvaluateInput);
        return true;
      } catch {
        return false;
      }
    };
    const preview = {
      organizationId: "22222222-2222-4222-8222-000000000001",
      startsAt: "2031-11-10T08:00:00.000Z",
      endsAt: "2031-11-12T16:00:00.000Z",
      urgency: "aog",
      hardQualificationTypeIds: ["11111111-1111-4111-8111-000000000001"],
    };
    assertEquals(ok(preview), true);
    assertEquals(ok({ requirementId: "33333333-3333-4333-8333-000000000001" }), true);
    assertEquals(ok({ ...preview, requirementId: "33333333-3333-4333-8333-000000000001" }), false);
    assertEquals(ok({ ...preview, userId: "00000000-0000-4000-8000-000000000001" }), false);
    assertEquals(ok({ ...preview, hardQualificationTypeIds: [] }), false);
  },
);
