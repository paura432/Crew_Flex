"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "@/lib/validation/zod";
import type { ApiErrorCode, ApiResponse } from "@/types/api";
import { markAllNoticesRead, markNoticeRead } from "./api";
import { noticeHref } from "./view";

export type NoticeActionResult =
  { ok: true } | { ok: false; code: ApiErrorCode; message: string; requestId?: string };

const failure = (result: Extract<ApiResponse<unknown>, { ok: false }>): NoticeActionResult => ({
  ok: false,
  code: result.error.code,
  message: result.error.message,
  requestId: result.requestId,
});

/**
 * v1.8 «Ver oportunidades»: marks the notice read and goes where it leads. The destination comes from
 * the notice the server returned for this reader (never from the browser); the shell's count follows.
 */
export async function openNoticeAction(id: unknown): Promise<NoticeActionResult> {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR", message: "v.invalid" };
  const result = await markNoticeRead(parsed.data);
  if (!result.ok) return failure(result);
  revalidatePath("/app", "layout");
  // Hidden since it was listed (access lost, retention): back to the list, now without it.
  redirect(result.data.notice ? noticeHref(result.data.notice) : "/app/notices");
}

/** v1.8 demo «Marcar todas como leídas». */
export async function markAllNoticesReadAction(): Promise<NoticeActionResult> {
  const result = await markAllNoticesRead();
  if (!result.ok) return failure(result);
  revalidatePath("/app", "layout");
  return { ok: true };
}
