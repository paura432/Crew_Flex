import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/edge-functions", () => ({ invokeEdgeFunction: vi.fn() }));
const results: Record<string, unknown> = {};
/** A PostgREST builder stand-in: every call chains, awaiting it gives the table's result. */
const chain = (result: unknown): unknown => {
  const builder: unknown = new Proxy(
    {},
    {
      get: (_, key) =>
        key === "then" ? (resolve: (v: unknown) => void) => resolve(result) : () => builder,
    },
  );
  return builder;
};
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ from: (table: string) => chain(results[table]) }),
}));

import { getOwnProfessionalOverview } from "./api";

describe("getOwnProfessionalOverview (X-16)", () => {
  beforeEach(() => {
    results.technician_profiles = { data: { profile_id: "p" }, error: null };
    results.technician_qualifications = { data: [], error: null };
    results.availability_windows = { data: [], error: null };
    results.technician_private_details = { data: null, error: null };
    results.technician_type_ratings = { data: [], error: null };
  });

  it("no technician profile → null (an organization account)", async () => {
    results.technician_profiles = { data: null, error: null };
    expect(await getOwnProfessionalOverview("p")).toBeNull();
  });

  it("a failed read throws instead of passing for «no profile»", async () => {
    results.availability_windows = { data: null, error: { message: "boom" } };
    await expect(getOwnProfessionalOverview("p")).rejects.toThrow("unavailable");
  });

  it("own data otherwise", async () => {
    expect(await getOwnProfessionalOverview("p")).toMatchObject({
      profile: { profile_id: "p" },
      minRate: null,
    });
  });

  it("the private row's rate arrives as a number (PostgREST may send numeric as text)", async () => {
    results.technician_private_details = { data: { min_rate: "45.50" }, error: null };
    expect((await getOwnProfessionalOverview("p"))?.minRate).toBe(45.5);
    results.technician_private_details = { data: null, error: { message: "boom" } };
    await expect(getOwnProfessionalOverview("p")).rejects.toThrow("unavailable");
  });

  it("the medals read the own categories, skills and type ratings (N-15); a failed read throws", async () => {
    results.technician_profiles = {
      data: { profile_id: "p", categories: ["B1.1"], skills: ["ndt"] },
      error: null,
    };
    results.technician_type_ratings = {
      data: [{ aircraft: "A330", category: "B1.1", expires_at: null, restrictions: null }],
      error: null,
    };
    const overview = await getOwnProfessionalOverview("p");
    expect(overview?.medalSource).toEqual({
      categories: ["B1.1"],
      skills: ["ndt"],
      typeRatings: [{ aircraft: "A330", category: "B1.1", expiresAt: null, restrictions: null }],
    });
    expect(overview?.profile).not.toHaveProperty("categories");
    results.technician_type_ratings = { data: null, error: { message: "boom" } };
    await expect(getOwnProfessionalOverview("p")).rejects.toThrow("unavailable");
  });
});
