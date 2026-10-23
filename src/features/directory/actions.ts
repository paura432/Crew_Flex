"use server";

import { revalidatePath } from "next/cache";
import { directoryBlockInput } from "@/lib/validation/directory";
import { requireOrganizationContext } from "@/server/session";
import type { ApiErrorBody } from "@/types/api";
import { setDirectoryBlock } from "./api";
import { DIRECTORY_PATH } from "./query";

export type BlockCandidateActionState =
  | { ok: true; candidateRef: string; blocked: boolean }
  | {
      ok: false;
      code: ApiErrorBody["code"];
      message: string;
      requestId?: string;
      /** 409 reason (`DIRECTORY_CONFLICTS`). */
      reason?: ApiErrorBody["reason"];
    }
  | null;

/**
 * v2-16 «Bloquear» / «Desbloquear» from a directory card (`useActionState` form: works without JavaScript).
 * The organization is the caller's acting organization (session), never a posted id; the Edge Function and
 * the RPC re-check the admin/manager role from the database.
 */
export async function blockCandidateAction(
  _previous: BlockCandidateActionState,
  formData: FormData,
): Promise<BlockCandidateActionState> {
  const { organization } = await requireOrganizationContext();
  const parsed = directoryBlockInput.safeParse({
    organizationId: organization.id,
    candidateRef: formData.get("candidateRef"),
    blocked: formData.get("blocked") === "1",
  });
  if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR", message: "v.invalid" };
  const result = await setDirectoryBlock(parsed.data);
  if (!result.ok) {
    return {
      ok: false,
      code: result.error.code,
      message: result.error.message,
      reason: result.error.reason,
      requestId: result.requestId,
    };
  }
  revalidatePath(DIRECTORY_PATH);
  return { ok: true, candidateRef: result.data.candidateRef, blocked: result.data.blocked };
}
