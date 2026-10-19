// Structured logs. Allowed fields only: never headers, tokens, passwords, documents or
// full payloads.

export interface LogEntry {
  fn: string;
  requestId: string;
  method: string;
  status: number;
  durationMs: number;
  actorId?: string;
  errorCode?: string;
  /** Internal error class/name only — never the raw message of a DB or SDK error. */
  internal?: string;
}

/**
 * One structured event line besides the request line (e.g. `orphan_object`, `document_url_issued`).
 * Ids only: a storage path may be logged only when it contains no user text (server-derived).
 */
export interface EventEntry {
  fn: string;
  requestId: string;
  event: string;
  level: "info" | "warn";
  actorId?: string;
  documentId?: string;
  /** Server-derived object path (`<uid>/<uuid>-<hex>`), never a user-supplied name. */
  path?: string;
  /** Error class/status only. */
  internal?: string;
}

export function logEvent(entry: EventEntry): void {
  const line = JSON.stringify(entry);
  if (entry.level === "warn") console.warn(line);
  else console.log(line);
}

export function logRequest(entry: LogEntry): void {
  const line = JSON.stringify({ level: entry.status >= 500 ? "error" : "info", ...entry });
  if (entry.status >= 500) console.error(line);
  else console.log(line);
}
