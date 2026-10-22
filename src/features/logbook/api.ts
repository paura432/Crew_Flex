import "server-only";
import type {
  CreateLogbookEntryInput,
  LogbookView,
  UpdateLogbookEntryInput,
} from "@/lib/validation/logbook";
import { invokeEdgeFunction } from "@/server/edge-functions";
import type { LogbookDeleteResponse, LogbookEntryResponse, LogbookListResponse } from "@/types/api";

export const listLogbook = (view: LogbookView) =>
  invokeEdgeFunction<LogbookListResponse>("professional-logbook", { query: { view } });

export const createLogbookEntry = (input: CreateLogbookEntryInput, idempotencyKey: string) =>
  invokeEdgeFunction<LogbookEntryResponse>("professional-logbook", {
    method: "POST",
    body: input,
    headers: { "Idempotency-Key": idempotencyKey },
  });

export const updateLogbookEntry = (id: string, input: UpdateLogbookEntryInput) =>
  invokeEdgeFunction<LogbookEntryResponse>("professional-logbook", {
    method: "PATCH",
    query: { id },
    body: input,
  });

export const deleteLogbookEntry = (id: string) =>
  invokeEdgeFunction<LogbookDeleteResponse>("professional-logbook", {
    method: "DELETE",
    query: { id },
  });
