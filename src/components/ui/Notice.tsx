import { resolveMessage, translateKey, type MessageResolver } from "@/i18n/validation";

/** Inline outcome of a form action: success (status) or failure (alert) with the request reference. */
export interface NoticeState {
  tone: "ok" | "danger";
  text: string;
  requestId?: string;
}

export function Notice({
  notice,
  referenceLabel,
}: {
  notice: NoticeState | null;
  referenceLabel: string;
}) {
  if (!notice) return null;
  return (
    <p
      role={notice.tone === "danger" ? "alert" : "status"}
      className={`rounded-lg border px-4 py-3 text-sm ${
        notice.tone === "danger"
          ? "border-danger/30 bg-danger-bg text-danger"
          : "border-ok/30 bg-ok-bg text-ok"
      }`}
    >
      {notice.text}
      {notice.requestId && <span className="mt-1 block font-mono text-xs">{referenceLabel}</span>}
    </p>
  );
}

/**
 * User-facing copy for the error codes a user can hit while saving their own data.
 * `t` is a root translator (full keys); server messages that are `v.*` keys are resolved too.
 */
export function actionErrorCopy(
  t: MessageResolver,
  result: { code: string; message: string; requestId?: string },
): NoticeState {
  const k = (key: string) => translateKey(t, key);
  const text =
    result.code === "UNAUTHORIZED"
      ? k("api.action.sessionExpired")
      : result.code === "NETWORK_ERROR"
        ? k("api.action.unreachable")
        : result.code === "NOT_FOUND"
          ? k("api.action.gone")
          : result.code === "CONFLICT"
            ? k("api.action.conflict")
            : result.code === "FORBIDDEN"
              ? k("api.FORBIDDEN.description")
              : result.code === "INTERNAL_ERROR"
                ? k("api.INTERNAL_ERROR.description")
                : result.message === "common.checkFields"
                  ? k("common.checkFields")
                  : resolveMessage(t, result.message);
  return { tone: "danger", text, requestId: result.requestId };
}
