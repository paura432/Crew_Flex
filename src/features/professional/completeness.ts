import {
  futureAvailabilityCount,
  profileCompleteness,
  type Completeness,
  type CompletenessItem,
} from "@/domain/professional";
import type { ProfessionalOverview } from "./api";

/** Where each missing BR-11 item is completed (overview checklist and «Completar» links). */
export const COMPLETENESS_HREF: Record<CompletenessItem, string> = {
  display_name: "/app/professional/profile",
  base_location: "/app/professional/profile",
  primary_category: "/app/professional/profile",
  aircraft: "/app/professional/profile",
  years_experience: "/app/professional/profile",
  min_rate: "/app/professional/profile",
  work_permits: "/app/professional/profile",
  availability: "/app/professional/availability",
  courses: "/app/professional/qualifications",
  document: "/app/professional/documents",
};

/**
 * BR-11 completeness of the caller's own passport (overview and passport pages compute it the same
 * way). `documents` is the wallet count, or `null` while the wallet is off (the item is left out).
 */
export function completenessOf(
  displayName: string,
  overview: ProfessionalOverview,
  documents: number | null,
  now: Date,
): Completeness {
  return profileCompleteness({
    profile: {
      displayName,
      baseLocation: overview.profile.base_location,
      yearsExperience: overview.profile.years_experience,
      primaryCategory: overview.profile.primary_category,
      aircraft: overview.profile.aircraft,
      workPermits: overview.profile.work_permits,
      minRate: overview.minRate,
    },
    qualifications: overview.qualifications.map((q) => ({
      category: q.qualification_types.category,
      status: q.status,
    })),
    // v1.8 «Disponibilidad futura»: «AOG only» publishes availability too (BR-4.8); ended windows do not.
    futureAvailableWindows: futureAvailabilityCount(
      overview.availability.map((w) => ({ endsAt: w.ends_at, status: w.status })),
      now,
    ),
    documents,
  });
}
