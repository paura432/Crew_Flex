import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// E-4: a failed call is never reported as success, and nothing internal leaks to the UI.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  publicEnv: {
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:56321",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key_000000",
  },
}));
const session = { access_token: "user-jwt" };
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getSession: async () => ({ data: { session } }) },
  }),
}));

const { invokeEdgeFunction } = await import("./edge-functions");

describe("invokeEdgeFunction", () => {
  const fetchMock = vi.fn();
  beforeEach(() => vi.stubGlobal("fetch", fetchMock));
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("maps an unreachable function (rejected fetch / timeout) to NETWORK_ERROR, never ok", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    const result = await invokeEdgeFunction("work-requirements", { method: "POST", body: {} });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("NETWORK_ERROR");
    fetchMock.mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"));
    const timeout = await invokeEdgeFunction("professional-profile", { method: "PATCH", body: {} });
    expect(!timeout.ok && timeout.error.code).toBe("NETWORK_ERROR");
  });

  it("a non-envelope response (proxy HTML, 502) is a generic failure, not success, and leaks nothing", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("<html>Bad gateway: upstream 10.0.0.7</html>", { status: 502 }),
    );
    const result = await invokeEdgeFunction("matching-evaluate", { method: "POST", body: {} });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(result)).not.toContain("10.0.0.7");
  });

  it("forwards the user's token and the Idempotency-Key, and passes the envelope through", async () => {
    const envelope = { ok: true, data: { requirement: { id: "r1" } }, requestId: "x" };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(envelope), { status: 200 }));
    const result = await invokeEdgeFunction("work-requirements", {
      method: "POST",
      body: { a: 1 },
      headers: { "Idempotency-Key": "6f1c2a52-7b8e-4c1e-9a3f-0d2b5e8c4a11" },
    });
    expect(result).toEqual(envelope);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers.Authorization).toBe("Bearer user-jwt");
    expect(init.headers["Idempotency-Key"]).toBe("6f1c2a52-7b8e-4c1e-9a3f-0d2b5e8c4a11");
  });

  it("a caller-supplied header cannot replace the Authorization of the session", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, data: {}, requestId: "x" })),
    );
    await invokeEdgeFunction("health", { headers: { Authorization: "Bearer someone-else" } });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers.Authorization).toBe("Bearer user-jwt");
  });
});
