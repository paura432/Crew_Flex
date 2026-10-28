/**
 * Audit actions that can appear in an organization's own trail (rows with its organization id:
 * the organization's own acts; a technician's acts carry none, T-04). Each has a label in
 * `organization.profile.activity.actions.<action with _>`; anything else is shown as its code.
 */
export const ACTIVITY_ACTIONS = [
  "organization.updated",
  "organization.member_removed",
  "requirement.created",
  "requirement.updated",
  "requirement.status_changed",
  "requirement.archived",
  "requirement.client_changed",
  "requirement.outreach_distributed",
  "application.shortlisted",
  "application.proposed",
  "application.rejected",
  "application.confirmed",
  "application.cancelled",
  "application.finished",
] as const;

/** Catalog key (relative to `organization.profile`) of an action's label, or null for the raw code. */
export const activityLabelKey = (action: string): string | null =>
  (ACTIVITY_ACTIONS as readonly string[]).includes(action)
    ? `activity.actions.${action.replace(".", "_")}`
    : null;
