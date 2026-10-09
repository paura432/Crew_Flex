// Database row shapes used by direct (RLS-protected) reads from the Next.js server.
// PARTIAL: hand-written subset until `pnpm db:types` can run against the linked project
// (blocked: see docs/product/OPEN_DECISIONS.md OD-2). Replace with the generated
// `database.generated.ts` once available. Rows are NOT domain objects — map them.
import type { QualificationCategory, VerificationStatus } from "../domain/qualification.ts";

export type AccountType = "professional" | "organization";
export type PlatformRole = "user" | "platform_admin";
export type OrganizationRole = "member" | "manager" | "admin";
export type OrganizationType = "mro" | "airline" | "operator" | "staffing_agency" | "other";
export type ProfileVisibility = "private" | "anonymous" | "open";

export interface ProfileRow {
  id: string;
  display_name: string;
  account_type: AccountType;
  platform_role: PlatformRole;
}

export interface OrganizationRow {
  id: string;
  name: string;
  type: OrganizationType;
  country: string | null;
}

export interface MembershipRow {
  role: OrganizationRole;
  organizations: OrganizationRow;
}

export interface QualificationTypeRow {
  id: string;
  code: string;
  name: string;
  category: QualificationCategory;
  requires_expiry: boolean;
}

export interface TechnicianProfileRow {
  profile_id: string;
  base_location: string | null;
  mobility: "local" | "national" | "international";
  years_experience: number | null;
  current_status: "employed" | "contractor" | "between_contracts";
  visibility: ProfileVisibility;
}

export interface TechnicianQualificationRow {
  id: string;
  status: "active" | "withdrawn";
  issued_at: string | null;
  expires_at: string | null;
  verification_status: VerificationStatus;
  qualification_types: Pick<QualificationTypeRow, "code" | "name" | "category">;
}

export interface AvailabilityWindowRow {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "available" | "unavailable";
}
