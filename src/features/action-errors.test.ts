import { describe, expect, it, vi } from "vitest";

// Actions validate before calling anything; these cases never reach the Edge Functions.
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/availability/api", () => ({}));
vi.mock("@/features/qualifications/api", () => ({}));
vi.mock("@/features/documents/api", () => ({}));

import { deleteWindowAction, updateWindowAction } from "@/features/availability/actions";
import { updateDocumentAction } from "@/features/documents/actions";
import {
  deleteQualificationAction,
  updateQualificationAction,
} from "@/features/qualifications/actions";

// Every message an action returns is a catalog key (NX-08: no English text in the Spanish UI).
describe("server action errors travel as catalog keys", () => {
  it("availability: invalid window id", async () => {
    for (const result of [
      await updateWindowAction("not-a-uuid", {}),
      await deleteWindowAction("not-a-uuid"),
    ]) {
      expect(result).toMatchObject({
        ok: false,
        code: "VALIDATION_ERROR",
        message: "common.checkFields",
        fieldErrors: { form: "v.form.window" },
      });
    }
  });

  it("qualifications: invalid qualification id", async () => {
    for (const result of [
      await updateQualificationAction("not-a-uuid", {}),
      await deleteQualificationAction("not-a-uuid"),
    ]) {
      expect(result).toMatchObject({
        ok: false,
        message: "common.checkFields",
        fieldErrors: { form: "v.form.qualification" },
      });
    }
  });

  it("documents: invalid document id", async () => {
    expect(await updateDocumentAction("not-a-uuid", {})).toMatchObject({
      ok: false,
      message: "common.checkFields",
      fieldErrors: { form: "v.document.id" },
    });
  });
});
