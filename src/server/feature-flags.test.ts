import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// OD-3 checkpoint: the qualification review stays closed unless the server flag is exactly "true".
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({ notFound }));
const requireSessionActor = vi.fn();
vi.mock("@/server/session", () => ({ requireSessionActor }));
const getReviewQueue = vi.fn();
const submitReview = vi.fn();
vi.mock("@/features/reviews/api", () => ({ getReviewQueue, submitReview }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
  getLocale: async () => "en",
}));

const { canOpenQualificationReview, isQualificationReviewEnabled } =
  await import("./feature-flags");
const { reviewQualificationAction } = await import("@/features/reviews/actions");
const { default: VerificationsPage } = await import("@/app/app/admin/verifications/page");

const admin = { platform_role: "platform_admin" };
const user = { platform_role: "user" };
const validReview = {
  qualificationId: "00000000-0000-4000-8000-000000000001",
  decision: "verified",
  expectedUpdatedAt: "2026-10-15T10:00:00.000Z",
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllEnvs());

describe("qualification review flag (OD-3)", () => {
  it.each([undefined, "", "false", "1", "TRUE", "yes"])("is off for %j", (value) => {
    vi.stubEnv("QUALIFICATION_REVIEW_ENABLED", value);
    expect(isQualificationReviewEnabled()).toBe(false);
    expect(canOpenQualificationReview(admin)).toBe(false);
  });

  it("is on only for the exact value 'true', and still only for platform admins", () => {
    vi.stubEnv("QUALIFICATION_REVIEW_ENABLED", "true");
    expect(isQualificationReviewEnabled()).toBe(true);
    expect(canOpenQualificationReview(admin)).toBe(true);
    expect(canOpenQualificationReview(user)).toBe(false);
  });
});

describe("/app/admin/verifications", () => {
  it("disabled: 404 before reading the session or calling the Edge Function", async () => {
    vi.stubEnv("QUALIFICATION_REVIEW_ENABLED", "false");
    await expect(VerificationsPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(requireSessionActor).not.toHaveBeenCalled();
    expect(getReviewQueue).not.toHaveBeenCalled();
  });

  it("enabled: a non-admin still gets a 404 and the function is not called", async () => {
    vi.stubEnv("QUALIFICATION_REVIEW_ENABLED", "true");
    requireSessionActor.mockResolvedValueOnce({ profile: user });
    await expect(VerificationsPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getReviewQueue).not.toHaveBeenCalled();
  });

  it("enabled: a platform admin reaches the queue", async () => {
    vi.stubEnv("QUALIFICATION_REVIEW_ENABLED", "true");
    requireSessionActor.mockResolvedValueOnce({ profile: admin });
    getReviewQueue.mockResolvedValueOnce({ ok: true, data: { pending: [], recent: [] } });
    await expect(VerificationsPage()).resolves.toBeTruthy();
    expect(notFound).not.toHaveBeenCalled();
    expect(getReviewQueue).toHaveBeenCalledOnce();
  });
});

describe("reviewQualificationAction", () => {
  it("disabled: refused as NOT_FOUND without calling the Edge Function", async () => {
    vi.stubEnv("QUALIFICATION_REVIEW_ENABLED", "false");
    const result = await reviewQualificationAction(validReview);
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(submitReview).not.toHaveBeenCalled();
  });

  it("enabled: validates and forwards to the Edge Function (which re-checks the role)", async () => {
    vi.stubEnv("QUALIFICATION_REVIEW_ENABLED", "true");
    submitReview.mockResolvedValueOnce({
      ok: false,
      error: { code: "FORBIDDEN", message: "not authorized" },
      requestId: "r-1",
    });
    const result = await reviewQualificationAction(validReview);
    expect(submitReview).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });
});
