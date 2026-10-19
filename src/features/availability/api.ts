import "server-only";
import type {
  CreateAvailabilityWindowInput,
  ReplaceAvailabilityDaysInput,
} from "@/lib/validation/availability";
import { invokeEdgeFunction } from "@/server/edge-functions";
import type {
  AvailabilityDaysResponse,
  AvailabilityDeleteResponse,
  AvailabilityListResponse,
  AvailabilityWindowResponse,
} from "@/types/api";

export const listAvailability = () =>
  invokeEdgeFunction<AvailabilityListResponse>("professional-availability");

export const createAvailabilityWindow = (
  input: CreateAvailabilityWindowInput,
  idempotencyKey: string,
) =>
  invokeEdgeFunction<AvailabilityWindowResponse>("professional-availability", {
    method: "POST",
    body: input,
    headers: { "Idempotency-Key": idempotencyKey },
  });

export const updateAvailabilityWindow = (id: string, input: CreateAvailabilityWindowInput) =>
  invokeEdgeFunction<AvailabilityWindowResponse>("professional-availability", {
    method: "PATCH",
    query: { id },
    body: input,
  });

export const deleteAvailabilityWindow = (id: string) =>
  invokeEdgeFunction<AvailabilityDeleteResponse>("professional-availability", {
    method: "DELETE",
    query: { id },
  });

/** Whole UTC days in one transaction (shift-cycle generator); idempotent per key. */
export const replaceAvailabilityDays = (
  input: ReplaceAvailabilityDaysInput,
  idempotencyKey: string,
) =>
  invokeEdgeFunction<AvailabilityDaysResponse>("professional-availability", {
    method: "PUT",
    body: input,
    headers: { "Idempotency-Key": idempotencyKey },
  });
