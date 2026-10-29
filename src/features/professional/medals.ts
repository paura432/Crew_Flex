import { verifiedCodes, type BadgeInput } from "@/domain/badges";
import type { ProfessionalOverview } from "./api";

/** The medals' input from the own overview (home and passport compute it the same way). */
export function medalInputOf(overview: ProfessionalOverview, today: string): BadgeInput {
  return {
    yearsExperience: overview.profile.years_experience,
    primaryCategory: overview.profile.primary_category,
    ...overview.medalSource,
    verifiedCodes: verifiedCodes(
      overview.qualifications.map((q) => ({
        code: q.qualification_types.code,
        status: q.status,
        verificationStatus: q.verification_status,
        expiresAt: q.expires_at,
      })),
      today,
    ),
  };
}
