/**
 * LOCAL-ONLY end-to-end journey of M07 opportunities (D-12) and M08 applications (D-06 Q2–Q7, R-08),
 * through the real local stack (Auth → Edge Functions → PostgREST/PostgreSQL with RLS), synthetic
 * seed accounts only. Skipped unless E2E_SUPABASE_URL is local (guard.ts). The requirement is an
 * `E2E …` row (scripts/local/cleanup-test-rows.sh removes it and, by cascade, its applications);
 * the availability windows it adds are deleted at the end.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isLocalUrl } from "./guard";
import { call, client, key, signIn, url } from "./local-api";

type Json = Record<string, unknown>;
const START = "2026-12-01T06:00:00.000Z";
const END = "2026-12-03T18:00:00.000Z";

describe.skipIf(!isLocalUrl(url) || !key)("local E2E: opportunities and hiring (M07/M08)", () => {
  const tokens: Record<string, string> = {};
  let requirementId = "";
  const windows: { token: string; id: string }[] = [];

  const as = (who: string) => tokens[who]!;
  const apply = (who: string, idempotencyKey = randomUUID()) =>
    call("applications", {
      method: "POST",
      token: as(who),
      headers: { "Idempotency-Key": idempotencyKey },
      body: { requirementId, shareConsent: true },
    });
  const orgList = async () => {
    const res = await call("applications", { token: as("manager"), query: { requirementId } });
    expect(res.status).toBe(200);
    return res.body.data!.applications as Json[];
  };
  const mine = async (who: string) => {
    const res = await call("applications", { token: as(who) });
    expect(res.status).toBe(200);
    return (res.body.data!.applications as Json[]).filter((a) => a.requirementId === requirementId);
  };
  const move = (who: string, application: Json, to: string, extra: Json = {}, k = randomUUID()) =>
    call("applications", {
      method: "PATCH",
      token: as(who),
      headers: { "Idempotency-Key": k },
      body: {
        applicationId: application.id,
        to,
        expectedUpdatedAt: application.updatedAt,
        ...extra,
      },
    });
  const requirementStatus = async () =>
    (await call("work-requirements", { token: as("manager"), query: { id: requirementId } })).body
      .data!.requirement as { status: string };

  beforeAll(async () => {
    for (const [who, email] of [
      ["manager", "manager.mro@crewflex.test"],
      ["adminMro", "admin.mro@crewflex.test"], // an organization account (manager.mro is a professional too)
      ["charlie", "charlie@crewflex.test"],
      ["adminOther", "admin.other@crewflex.test"],
      ["delta", "delta@crewflex.test"],
      ["echo", "echo@crewflex.test"],
      ["foxtrot", "foxtrot@crewflex.test"],
      ["hotel", "hotel@crewflex.test"],
    ] as const)
      tokens[who] = await signIn(email);
    const { data: org } = await client(as("manager"))
      .from("organizations")
      .select("id")
      .eq("name", "Demo MRO Madrid")
      .single();
    const { data: types } = await client(as("manager"))
      .from("qualification_types")
      .select("id, code")
      .in("code", ["B1.1", "TR-A320"]);
    const created = await call("work-requirements", {
      method: "POST",
      token: as("manager"),
      headers: { "Idempotency-Key": randomUUID() },
      body: {
        organizationId: org!.id,
        title: `E2E hiring ${randomUUID().slice(0, 8)}`,
        location: "Madrid (MAD)",
        startsAt: START,
        endsAt: END,
        shift: "day",
        headcount: 1,
        urgency: "planned",
        qualifications: types!.map((t) => ({ qualificationTypeId: t.id, level: "hard" })),
      },
    });
    expect(created.status).toBe(201);
    requirementId = (created.body.data!.requirement as { id: string }).id;
    // Availability over the whole period for the three applicants (eligibility needs 100 %).
    for (const who of ["delta", "echo", "foxtrot"]) {
      const res = await call("professional-availability", {
        method: "POST",
        token: as(who),
        headers: { "Idempotency-Key": randomUUID() },
        body: {
          startsAt: "2026-12-01T00:00:00.000Z",
          endsAt: "2026-12-04T00:00:00.000Z",
          status: "available",
        },
      });
      expect([who, res.status]).toEqual([who, 201]);
      windows.push({ token: as(who), id: (res.body.data!.window as { id: string }).id });
    }
  });

  afterAll(async () => {
    for (const w of windows)
      await call("professional-availability", {
        method: "DELETE",
        token: w.token,
        query: { id: w.id },
      });
  });

  it("D-12: a professional sees the published need with their own eligibility; organizations and anon do not", async () => {
    const res = await call("opportunities", { token: as("delta"), query: { id: requirementId } });
    expect(res.status).toBe(200);
    const opportunity = res.body.data!.opportunity as Json;
    expect((opportunity.match as Json).eligible).toBe(true);
    expect(opportunity.applyBlocker).toBeNull();
    const requirement = opportunity.requirement as Json;
    expect(requirement.organizationName).toBe("Demo MRO Madrid");
    for (const hidden of ["organizationId", "createdBy", "created_by", "organization_id"])
      expect(requirement).not.toHaveProperty(hidden);
    // A private professional sees it too, with eligibility computed independently of visibility.
    const hotel = await call("opportunities", { token: as("hotel"), query: { id: requirementId } });
    expect(hotel.status).toBe(200);
    expect(((hotel.body.data!.opportunity as Json).match as Json).eligible).toBe(false);
    expect((await call("opportunities", { token: as("adminMro") })).status).toBe(403);
    expect((await call("opportunities", {})).status).toBe(401);
    const list = await call("opportunities", {
      token: as("delta"),
      query: { eligible: "1", q: "E2E hiring" },
    });
    expect(
      (list.body.data!.opportunities as { requirement: Json }[]).map((o) => o.requirement.id),
    ).toContain(requirementId);
  });

  it("apply: consent required, idempotent, one active application per technician (Q5)", async () => {
    const noConsent = await call("applications", {
      method: "POST",
      token: as("delta"),
      headers: { "Idempotency-Key": randomUUID() },
      body: { requirementId, shareConsent: false },
    });
    expect(noConsent.status).toBe(400);
    const k = randomUUID();
    const first = await apply("delta", k);
    const replay = await apply("delta", k);
    expect([first.status, replay.status]).toEqual([201, 200]);
    expect((replay.body.data!.application as Json).id).toBe(
      (first.body.data!.application as Json).id,
    );
    const again = await apply("delta");
    expect([again.status, again.body.error?.reason]).toEqual([409, "ALREADY_APPLIED"]);
  });

  it("only the requirement's admins/managers see and move its applications", async () => {
    const [application] = await orgList();
    expect(application!.status).toBe("received");
    expect((application!.candidate as Json).displayName).toBeNull(); // delta is anonymous (T-04)
    expect(
      (await call("applications", { token: as("charlie"), query: { requirementId } })).status,
    ).toBe(403);
    expect([403, 404]).toContain(
      (await call("applications", { token: as("adminOther"), query: { requirementId } })).status,
    );
    const byTechnician = await move("delta", application!, "shortlisted");
    expect([403, 404]).toContain(byTechnician.status);
  });

  it("R-08 + Q7: proposal versions, explicit acceptance, no accepted → rejected; close refused (T-12)", async () => {
    let [app] = await orgList();
    expect((await move("manager", app!, "shortlisted")).status).toBe(200);
    [app] = await orgList();
    expect((await move("manager", app!, "proposed")).status).toBe(200);
    let [own] = await mine("delta");
    const v1 = own!.currentProposal as Json;
    expect(v1.version).toBe(1);
    const noTick = await move("delta", own!, "accepted", { proposalId: v1.id });
    expect(noTick.status).toBe(400); // acceptTerms is required
    expect(
      (await move("delta", own!, "accepted", { proposalId: v1.id, acceptTerms: true })).status,
    ).toBe(200);
    [app] = await orgList();
    expect((await move("manager", app!, "proposed")).status).toBe(200); // new version (R-08)
    [own] = await mine("delta");
    const v2 = own!.currentProposal as Json;
    expect([v2.version, own!.acceptedProposalId]).toEqual([2, v1.id]);
    const stale = await move("delta", own!, "accepted", { proposalId: v1.id, acceptTerms: true });
    expect([stale.status, stale.body.error?.reason]).toEqual([409, "PROPOSAL_STALE"]);
    [own] = await mine("delta");
    expect(
      (await move("delta", own!, "accepted", { proposalId: v2.id, acceptTerms: true })).status,
    ).toBe(200);
    [app] = await orgList();
    expect((await move("manager", app!, "rejected", { reason: "Q7" })).status).toBe(409);
    const close = await call("work-requirements", {
      method: "PATCH",
      token: as("manager"),
      body: { id: requirementId, status: "closed" },
    });
    expect([close.status, close.body.error?.reason]).toEqual([409, "ACTIVE_COMMITMENTS"]);
  });

  it("confirm re-checks and fills the seat; finish waits for the end (Q4); technician cancels with a reason (Q3)", async () => {
    let [app] = await orgList();
    const k = randomUUID();
    const confirmed = await move("manager", app!, "confirmed", {}, k);
    expect(confirmed.status).toBe(200);
    const replay = await move("manager", app!, "confirmed", {}, k);
    expect([replay.status, replay.body.data?.replayed]).toEqual([200, true]);
    expect((await requirementStatus()).status).toBe("covered");
    const full = await apply("foxtrot");
    expect([full.status, full.body.error?.reason]).toEqual([409, "REQUIREMENT_NOT_OPEN"]);
    [app] = await orgList();
    const early = await move("manager", app!, "finished");
    expect([early.status, early.body.error?.reason]).toEqual([409, "PERIOD_NOT_ENDED"]);
    let [own] = await mine("delta");
    expect((await move("delta", own!, "cancelled")).status).toBe(400); // reason required
    expect((await move("delta", own!, "cancelled", { reason: "Family emergency" })).status).toBe(
      200,
    );
    [own] = await mine("delta");
    expect([own!.status, own!.reason]).toEqual(["cancelled", "Family emergency"]);
    expect((await requirementStatus()).status).toBe("open"); // the seat is free again
    const reapply = await apply("delta");
    expect([reapply.status, reapply.body.error?.reason]).toEqual([409, "REAPPLY_NOT_ALLOWED"]); // T-09
  });

  it("Q5: re-apply after withdrawn, never after rejected; paused needs disappear; edit refused", async () => {
    expect((await apply("echo")).status).toBe(201);
    let [own] = await mine("echo");
    expect((await move("echo", own!, "withdrawn")).status).toBe(200);
    expect((await apply("echo")).status).toBe(201);
    expect((await apply("foxtrot")).status).toBe(201);
    const foxtrotApp =
      (await orgList()).find(
        (a) =>
          a.status === "received" && (a.candidate as Json).displayName === "Technician Foxtrot",
      ) ?? (await orgList()).filter((a) => a.status === "received").at(-1);
    expect((await move("manager", foxtrotApp!, "rejected", { reason: "Profile" })).status).toBe(
      200,
    );
    const fox = await apply("foxtrot");
    expect([fox.status, fox.body.error?.reason]).toEqual([409, "REAPPLY_NOT_ALLOWED"]);
    const pause = await call("work-requirements", {
      method: "PATCH",
      token: as("manager"),
      body: { id: requirementId, status: "paused" },
    });
    expect(pause.status).toBe(200);
    expect(
      (await call("opportunities", { token: as("delta"), query: { id: requirementId } })).status,
    ).toBe(404);
    [own] = await mine("echo");
    expect((own!.requirement as Json).status).toBe("paused");
    await call("work-requirements", {
      method: "PATCH",
      token: as("manager"),
      body: { id: requirementId, status: "open" },
    });
    // M05: a requirement that received applications cannot be edited.
    const current = (
      await call("work-requirements", { token: as("manager"), query: { id: requirementId } })
    ).body.data!.requirement as Json;
    const edit = await call("work-requirements", {
      method: "PUT",
      token: as("manager"),
      body: {
        id: requirementId,
        expectedUpdatedAt: current.updatedAt,
        title: "E2E hiring renamed",
        location: current.location,
        startsAt: current.startsAt,
        endsAt: current.endsAt,
        shift: current.shift,
        headcount: current.headcount,
        urgency: current.urgency,
        qualifications: (current.qualifications as Json[]).map((q) => ({
          qualificationTypeId: q.qualificationTypeId,
          level: q.level,
        })),
      },
    });
    expect([edit.status, edit.body.error?.reason]).toEqual([409, "HAS_APPLICATIONS"]);
    // Echo withdraws; with no accepted/confirmed application left, the need can be closed.
    [own] = await mine("echo");
    expect((await move("echo", own!, "withdrawn")).status).toBe(200);
    const close = await call("work-requirements", {
      method: "PATCH",
      token: as("manager"),
      body: { id: requirementId, status: "closed" },
    });
    expect(close.status).toBe(200);
  });
});
