// Row shapes used by direct (RLS-protected) reads from the Next.js server.
// Enums are derived from the generated schema (`database.generated.ts`, `pnpm db:types`) so they
// cannot drift from the database. Rows are NOT domain objects — map them.
import type { QualificationCategory, VerificationStatus } from "../domain/qualification.ts";
import type { Database } from "./database.generated";

type Enums = Database["public"]["Enums"];

export type AccountType = Enums["account_type"];
export type PlatformRole = Enums["platform_role"];
export type OrganizationRole = Enums["organization_role"];
export type OrganizationType = Enums["organization_type"];
export type ProfileVisibility = Enums["profile_visibility"];

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
  status: Enums["availability_status"];
}
