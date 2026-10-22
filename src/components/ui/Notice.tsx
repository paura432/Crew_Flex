import { unstable_rethrow } from "next/navigation";
import { useEffect, useRef } from "react";
import { isValidationKey, translateKey, type MessageResolver } from "@/i18n/validation";

// Codes with an `api.<CODE>.description` entry in the catalog.
const API_CODES = new Set([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "METHOD_NOT_ALLOWED",
  "CONFLICT",
  "PAYLOAD_TOO_LARGE",
  "NETWORK_ERROR",
  "INTERNAL_ERROR",
]);

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
  const ref = useRef<HTMLParagraphElement>(null);
  // X-08: an outcome that arrives after the focus was lost (the confirmed row is gone, or its button
  // was disabled while pending) takes it, instead of leaving keyboard users on <body>. Never steals
  // focus from a control.
  useEffect(() => {
    const active = document.activeElement;
    if (notice && (!active || active === document.body)) ref.current?.focus();
  }, [notice]);
  if (!notice) return null;
  return (
    <p
      ref={ref}
      tabIndex={-1}
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

/** What a server action call returns when the request itself failed (offline, dropped connection). */
const OFFLINE = {
  ok: false,
  status: "error",
  code: "NETWORK_ERROR",
  message: "api.action.offline",
  fieldErrors: undefined,
  requestId: undefined,
} as const;

/**
 * Calls a server action without ever throwing (X-02): a failed request becomes `NETWORK_ERROR` with
 * the «offline» copy instead of reaching the error boundary, so the page and the user's draft stay.
 * Next's own redirect/notFound errors still propagate. Both result shapes (`ok` and `status`) match.
 */
export async function callAction<T>(task: () => Promise<T>): Promise<T | typeof OFFLINE> {
  try {
    return await task();
  } catch (error) {
    unstable_rethrow(error);
    return OFFLINE;
  }
}

/**
 * User-facing copy for the error codes a user can hit while saving their own data.
 * `t` is a root translator (full keys); server messages that are `v.*` keys are resolved too. A raw
 * server message (the Edge Functions' English defaults, e.g. «Some fields are invalid.») is never
 * shown: it falls back to the catalog copy of its code.
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
        ? k(result.message === OFFLINE.message ? OFFLINE.message : "api.action.unreachable")
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
                  : isValidationKey(result.message)
                    ? k(result.message)
                    : result.code === "VALIDATION_ERROR"
                      ? k("common.checkFields")
                      : API_CODES.has(result.code)
                        ? k(`api.${result.code}.description`)
                        : k("common.errorHint");
  return { tone: "danger", text, requestId: result.requestId };
}
