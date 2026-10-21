import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./api", () => ({ replaceAvailabilityDays: vi.fn() }));

import { replaceAvailabilityDays } from "./api";
import { replaceDaysAction } from "./actions";

const KEY = "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d";
const VERSION = "0123456789abcdef0123456789abcdef";
const days = [{ date: "2028-10-01", status: "available" as const }];

describe("replaceDaysAction: version check on calendar save (W5-03)", () => {
  beforeEach(() => {
    vi.mocked(replaceAvailabilityDays).mockReset();
  });

  it("forwards the version the draft was made on", async () => {
    vi.mocked(replaceAvailabilityDays).mockResolvedValue({
      ok: true,
      data: { changeId: KEY, replayed: false },
      requestId: "req-0",
    });
    expect(await replaceDaysAction({ days, expectedVersion: VERSION }, KEY)).toEqual({ ok: true });
    expect(replaceAvailabilityDays).toHaveBeenCalledWith({ days, expectedVersion: VERSION }, KEY);
  });

  it("a stale calendar comes back as CONFLICT, nothing else is retried", async () => {
    vi.mocked(replaceAvailabilityDays).mockResolvedValue({
      ok: false,
      error: { code: "CONFLICT", message: "Conflict." },
      requestId: "req-1",
    });
    expect(await replaceDaysAction({ days, expectedVersion: VERSION }, KEY)).toMatchObject({
      ok: false,
      code: "CONFLICT",
      requestId: "req-1",
    });
    expect(replaceAvailabilityDays).toHaveBeenCalledTimes(1);
  });

  it("refuses a malformed version without calling the API", async () => {
    expect(await replaceDaysAction({ days, expectedVersion: "v1" }, KEY)).toMatchObject({
      ok: false,
      code: "VALIDATION_ERROR",
      fieldErrors: { expectedVersion: "v.days.version" },
    });
    expect(replaceAvailabilityDays).not.toHaveBeenCalled();
  });
});
