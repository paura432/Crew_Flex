import "server-only";
import { getTranslations } from "next-intl/server";
import { isStaffingAgency } from "@/domain/recruiter";
import type { OrganizationRow } from "@/types/database";
import { listRepresentedClients } from "./api";
import { selectableClients } from "./view";

/**
 * What a staffing agency's builder adds (v1.8 «NECESIDAD PARA CLIENTE», BR-27): the eyebrow and the active clients
 * it may publish for. `null` for any other organization. A portfolio that cannot be read offers no client (the form
 * says how to add one; publishing is refused by the database anyway).
 */
export async function recruiterBuilder(organization: Pick<OrganizationRow, "id" | "type">) {
  if (!isStaffingAgency(organization.type)) return null;
  const [t, result] = await Promise.all([
    getTranslations("recruiter"),
    listRepresentedClients(organization.id),
  ]);
  return {
    eyebrow: t("requirementEyebrow"),
    builder: { clients: result.ok ? selectableClients(result.data.clients) : [] },
  };
}
