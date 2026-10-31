import type { ExpiryState } from "@/domain/documents";

export type Tone = "neutral" | "ok" | "warn" | "danger" | "info";

/** BR-12 expiry state → tone, shared by the wallet, the qualifications list and the review list. */
export const EXPIRY_TONE: Record<Exclude<ExpiryState, "none">, Tone> = {
  valid: "ok",
  soon: "warn",
  expired: "danger",
};
