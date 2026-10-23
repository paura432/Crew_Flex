import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { detailVisible } from "./detail-gate";

const ID = "6f1c2c1e-2b0a-4a51-9a8e-0d3c5b7e9f10";
const MINE = "00000000-0000-4000-8000-0000000000a1";
const OTHER = "00000000-0000-4000-8000-0000000000b2";

type Result = { data: unknown; error: unknown };
/** A PostgREST builder stand-in: every call chains; awaiting it gives the table's (or RPC's) result. */
function fakeClient(results: Record<string, Result>) {
  const calls: string[] = [];
  const chain = (name: string): unknown => {
    const builder: unknown = new Proxy(
      {},
      {
        get: (_, key) =>
          key === "then"
            ? (resolve: (v: unknown) => void) =>
                resolve(results[name] ?? { data: null, error: null })
            : () => builder,
      },
    );
    return builder;
  };
  const client = {
    from: (table: string) => (calls.push(table), chain(table)),
    rpc: (fn: string) => (calls.push(fn), chain(fn)),
  };
  return { client: client as unknown as SupabaseClient, calls };
}
const ok = (data: unknown): Result => ({ data, error: null });
const failed: Result = { data: null, error: { code: "XX000" } };

describe("detailVisible (proxy 404 before the stream)", () => {
  it("a malformed id is a 404 without any read", async () => {
    const { client, calls } = fakeClient({});
    expect(await detailVisible({ kind: "requirement", id: "abc" }, client, "u")).toBe(false);
    expect(await detailVisible({ kind: "opportunity", id: "1" }, client, "u")).toBe(false);
    expect(calls).toEqual([]);
  });

  describe("requirement detail, matches, applications, edit", () => {
    const route = { kind: "requirement" as const, id: ID };
    const memberships = ok([
      { role: "member", organization_id: OTHER },
      { role: "admin", organization_id: MINE },
    ]);

    it("shows a requirement of the acting organization (highest role)", async () => {
      const { client } = fakeClient({
        work_requirements: ok({ organization_id: MINE }),
        organization_members: memberships,
      });
      expect(await detailVisible(route, client, "u")).toBe(true);
    });

    it("404 for another organization's (a platform admin reads every tenant) or a missing one", async () => {
      for (const requirement of [ok({ organization_id: OTHER }), ok(null)]) {
        const { client } = fakeClient({
          work_requirements: requirement,
          organization_members: memberships,
        });
        expect(await detailVisible(route, client, "u")).toBe(false);
      }
    });

    it("leaves it to the page without a membership or when a read fails", async () => {
      for (const results of [
        { work_requirements: ok(null), organization_members: ok([]) },
        { work_requirements: failed, organization_members: memberships },
        { work_requirements: ok({ organization_id: MINE }), organization_members: failed },
      ]) {
        const { client } = fakeClient(results);
        expect(await detailVisible(route, client, "u")).toBeNull();
      }
    });
  });

  describe("opportunity (professional) and «Ofertas en la red» (member)", () => {
    it("shows what the published projection returns, 404 otherwise", async () => {
      const professional = ok({ account_type: "professional" });
      for (const [rows, expected] of [
        [ok([{ id: ID }]), true],
        [ok([]), false],
        [failed, null],
      ] as const) {
        const { client } = fakeClient({ list_opportunities: rows, profiles: professional });
        expect(await detailVisible({ kind: "opportunity", id: ID }, client, "u")).toBe(expected);
      }
    });

    it("an organization account opening a professional opportunity is a 404 (the page's rule)", async () => {
      const { client } = fakeClient({
        list_opportunities: ok([{ id: ID }]),
        profiles: ok({ account_type: "organization" }),
      });
      expect(await detailVisible({ kind: "opportunity", id: ID }, client, "u")).toBe(false);
    });

    it("network: a member sees the projection; a non-member is left to the page's redirect", async () => {
      const member = ok([{ organization_id: MINE }]);
      const shown = fakeClient({
        list_opportunities: ok([{ id: ID }]),
        organization_members: member,
      });
      expect(await detailVisible({ kind: "network", id: ID }, shown.client, "u")).toBe(true);
      const own = fakeClient({ list_opportunities: ok([]), organization_members: member });
      expect(await detailVisible({ kind: "network", id: ID }, own.client, "u")).toBe(false);
      const outsider = fakeClient({ list_opportunities: ok([]), organization_members: ok([]) });
      expect(await detailVisible({ kind: "network", id: ID }, outsider.client, "u")).toBeNull();
    });
  });
});
