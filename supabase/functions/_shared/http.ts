import { corsHeaders } from "./cors.ts";
import { ApiError, normalizeError, type FieldIssue } from "./errors.ts";
import { logRequest } from "./logger.ts";

export type ApiSuccess<T> = { ok: true; data: T; requestId: string };
export type ApiFailure = {
  ok: false;
  error: { code: string; message: string; issues?: FieldIssue[] };
  requestId: string;
};

export interface RequestContext {
  req: Request;
  url: URL;
  requestId: string;
  /** Set by handlers once the actor is known, for logging. */
  actorId?: string;
}

export interface HandlerResult<T> {
  status?: number;
  data: T;
}

export type Handler = (
  ctx: RequestContext,
) => Promise<HandlerResult<unknown>> | HandlerResult<unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requestIdFrom(req: Request): string {
  const incoming = req.headers.get("x-request-id");
  return incoming && UUID.test(incoming) ? incoming : crypto.randomUUID();
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Wraps per-method handlers with: request id, CORS, method check, error normalization,
 * the standard response envelope and a structured log line.
 */
export function createHandler(fn: string, handlers: Partial<Record<"GET" | "POST", Handler>>) {
  const methods = Object.keys(handlers);

  return async (req: Request): Promise<Response> => {
    const started = performance.now();
    const requestId = requestIdFrom(req);
    const cors = corsHeaders(req, methods);
    const headers = { ...cors, "x-request-id": requestId };

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

    const ctx: RequestContext = { req, url: new URL(req.url), requestId };
    let status = 500;
    let errorCode: string | undefined;
    let internal: string | undefined;

    try {
      const handler = handlers[req.method as "GET" | "POST"];
      if (!handler) throw new ApiError("METHOD_NOT_ALLOWED");
      const result = await handler(ctx);
      status = result.status ?? 200;
      const body: ApiSuccess<unknown> = { ok: true, data: result.data, requestId };
      return json(body, status, headers);
    } catch (error) {
      const apiError = normalizeError(error);
      if (!(error instanceof ApiError)) internal = error instanceof Error ? error.name : "unknown";
      status = apiError.status;
      errorCode = apiError.code;
      const body: ApiFailure = {
        ok: false,
        error: {
          code: apiError.code,
          message: apiError.message,
          ...(apiError.issues ? { issues: apiError.issues } : {}),
        },
        requestId,
      };
      return json(body, status, headers);
    } finally {
      logRequest({
        fn,
        requestId,
        method: req.method,
        status,
        durationMs: Math.round(performance.now() - started),
        actorId: ctx.actorId,
        errorCode,
        internal,
      });
    }
  };
}
