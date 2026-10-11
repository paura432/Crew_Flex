/** Inline outcome of a form action: success (status) or failure (alert) with the request reference. */
export interface NoticeState {
  tone: "ok" | "danger";
  text: string;
  requestId?: string;
}

export function Notice({ notice }: { notice: NoticeState | null }) {
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
      {notice.requestId && (
        <span className="mt-1 block font-mono text-xs">Reference: {notice.requestId}</span>
      )}
    </p>
  );
}

/** User-facing copy for the error codes a professional can hit while saving their own data. */
export function actionErrorCopy(result: {
  code: string;
  message: string;
  requestId?: string;
}): NoticeState {
  const text =
    result.code === "UNAUTHORIZED"
      ? "Your session expired. Sign in again."
      : result.code === "NETWORK_ERROR"
        ? "The service could not be reached. Nothing was saved — retry."
        : result.code === "NOT_FOUND"
          ? "This item no longer exists. Reload the page."
          : result.code === "CONFLICT"
            ? "You already declared this qualification. Edit the existing one instead."
            : result.message;
  return { tone: "danger", text, requestId: result.requestId };
}
