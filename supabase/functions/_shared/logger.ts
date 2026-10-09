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

export function logRequest(entry: LogEntry): void {
  const line = JSON.stringify({ level: entry.status >= 500 ? "error" : "info", ...entry });
  if (entry.status >= 500) console.error(line);
  else console.log(line);
}
