import type { SessionActor } from "@/server/session";

/**
 * The four v1.8 workspaces («Probar como» Técnico / Empresa / Recruiter + «Control CrewFlex») a
 * platform admin switches between (owner, 2026-10-22). Each view shows the admin's OWN account:
 * no impersonation, no extra read path — RLS and the Edge Functions decide as for anyone else.
 */
export const WORKSPACE_VIEWS = {
  professional: "/app/professional",
  organization: "/app/organization",
  recruiter: "/app/recruiter",
  admin: "/app/admin",
} as const;

export type WorkspaceView = keyof typeof WORKSPACE_VIEWS;

const ORDER = Object.keys(WORKSPACE_VIEWS) as WorkspaceView[];

/** The view a path belongs to; null for shared routes (tools, settings). */
export const viewOfPath = (pathname: string): WorkspaceView | null =>
  ORDER.find(
    (view) =>
      pathname === WORKSPACE_VIEWS[view] || pathname.startsWith(`${WORKSPACE_VIEWS[view]}/`),
  ) ?? null;

/**
 * Sidebar sections of one view, as v1.8 swapped the whole menu with the role: sections tagged with
 * another view are dropped; untagged ones (account) always stay. No view yet → everything.
 */
export const sectionsOfView = <S extends { view?: WorkspaceView }>(
  sections: S[],
  view: WorkspaceView | null,
) => (view === null ? sections : sections.filter((s) => !s.view || s.view === view));

/**
 * Views the switcher offers: none unless platform admin; Técnico needs a professional account and
 * Empresa a membership (otherwise those pages have nothing of the admin's own to show).
 */
export function switcherViews(
  actor: Pick<SessionActor, "profile" | "memberships">,
): WorkspaceView[] {
  if (actor.profile.platform_role !== "platform_admin") return [];
  return ORDER.filter(
    (view) =>
      (view !== "professional" || actor.profile.account_type === "professional") &&
      (view !== "organization" || actor.memberships.length > 0),
  );
}
