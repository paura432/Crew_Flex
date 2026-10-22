import "server-only";
import type { NoticePreferencesInput } from "@/lib/validation/outreach";
import { invokeEdgeFunction } from "@/server/edge-functions";
import type {
  NoticePreferencesResponse,
  OutreachDistributeResponse,
  OutreachStatusResponse,
} from "@/types/api";

/** The caller's own notice preferences (professional accounts; the defaults while never saved). */
export const getNoticePreferences = () =>
  invokeEdgeFunction<NoticePreferencesResponse>("notice-preferences");

export const saveNoticePreferences = (input: NoticePreferencesInput) =>
  invokeEdgeFunction<NoticePreferencesResponse>("notice-preferences", {
    method: "PUT",
    body: input,
  });

/** Whether the requirement was distributed, when and to how many (admin/manager). */
export const getOutreachStatus = (requirementId: string) =>
  invokeEdgeFunction<OutreachStatusResponse>("requirement-outreach", { query: { requirementId } });

/** «Distribuir aviso Urgente / AOG»: once per requirement; the answer is a count. */
export const distributeOutreach = (requirementId: string) =>
  invokeEdgeFunction<OutreachDistributeResponse>("requirement-outreach", {
    method: "POST",
    body: { requirementId },
  });
