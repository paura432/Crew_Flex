import type { Tone } from "@/components/ui/tones";
import type { VerificationStatus } from "@/domain/qualification";

/** Verification status → chip tone, shared by the qualifications list and the workforce list. */
export const VERIFICATION_TONE: Record<VerificationStatus, Tone> = {
  verified: "ok",
  pending: "warn",
  rejected: "danger",
  expired: "danger",
};
