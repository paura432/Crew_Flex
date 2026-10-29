import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { signOutAction } from "@/features/auth/actions";
import { getUnreadNoticeCount } from "@/features/notices/api";
import { NoticeBell } from "@/features/notices/components/NoticeBell";
import { unreadBadge } from "@/features/notices/view";
import { isStaffingAgency } from "@/domain/recruiter";
import { canOpenQualificationReview, isDocumentWalletEnabled } from "@/server/feature-flags";
import { primaryMembership, type SessionActor } from "@/server/session";
import { accountSummaryKeys } from "./account-summary";
import { Brand } from "./Brand";
import { MobileDock } from "./MobileDock";
import { NavDrawer } from "./NavDrawer";
import type { NavItem } from "./NavLinks";
import { TopBar } from "./TopBar";
import { switcherViews, type WorkspaceView } from "./views";
import { ViewSections, ViewSwitcher, type NavSection } from "./ViewSwitcher";

export async function AppShell({ actor, children }: { actor: SessionActor; children: ReactNode }) {
  const [t, tNav, tDomain, tNotices, tShell, walletEnabled, unreadResult] = await Promise.all([
    getTranslations("common"),
    getTranslations("nav"),
    getTranslations("domain"),
    getTranslations("notices"),
    getTranslations("shell"),
    actor.profile.account_type === "professional" ? isDocumentWalletEnabled() : false,
    getUnreadNoticeCount(),
  ]);
  // v2-18: unknown when the service does not answer — no badge, the page says why. Layouts do not
  // re-render on navigation: the count is fresh on load and after any action (revalidatePath).
  const unread = unreadResult.ok ? unreadResult.data.unread : null;
  const badge = unreadBadge(unread);
  const organization = primaryMembership(actor)?.organization;
  const isProfessional = actor.profile.account_type === "professional";

  const agency = isStaffingAgency(organization?.type);
  const organizationNav: NavItem[] = [
    // A staffing agency's «Resumen» is its «Espacio recruiter» (v1.8 «ESPACIO RECRUITER», BR-27).
    { href: agency ? "/app/recruiter" : "/app/organization", label: tNav("dashboard") },
    { href: "/app/organization/requirements", label: tNav("requirements") },
    // v1.8 company order: Resumen, Nueva necesidad, Ofertas y cobertura, Buscar candidatos,
    // Candidaturas, Ofertas en la red, Organización (v2-05, v2-20, v2-22); Plantilla is Next's own.
    { href: "/app/organization/candidates", label: tNav("candidates") },
    { href: "/app/organization/applications", label: tNav("organizationApplications") },
    { href: "/app/organization/network", label: tNav("network") },
    { href: "/app/organization/workforce", label: tNav("workforce") },
    // v1.8 «Organización» (SH-03 #22, OD-5 default): data and review state, every member reads it
    { href: "/app/organization/settings", label: tNav("organizationProfile") },
  ];
  const professionalNav: NavItem[] = [
    { href: "/app/professional", label: tNav("overview") },
    { href: "/app/professional/profile", label: tNav("profile") },
    { href: "/app/professional/qualifications", label: tNav("qualifications") },
    { href: "/app/professional/availability", label: tNav("availability") },
    // v1.8 order: … Disponibilidad, Oportunidades, Mis candidaturas, Wallet, Logbook (M07/M08, M14)
    { href: "/app/professional/opportunities", label: tNav("opportunities") },
    { href: "/app/professional/applications", label: tNav("applications") },
    ...(walletEnabled ? [{ href: "/app/professional/documents", label: tNav("documents") }] : []),
    { href: "/app/professional/logbook", label: tNav("logbook") },
  ];
  const accountNav: NavItem[] = [
    // v1.8 connected «Avisos» for every account type (SH-03 #10), with the unread count.
    {
      href: "/app/notices",
      label: tNotices("nav"),
      ...(badge
        ? { badge: { text: badge, label: tNotices("unread", { count: unread ?? 0 }) } }
        : {}),
    },
    { href: "/app/tools", label: tNav("tools") },
    { href: "/app/settings", label: tNav("settings") },
  ];
  // Platform admins only (UI convenience: proxy, pages, functions and RPCs re-check the role).
  // «Verificaciones» only while the qualification review is enabled (OD-3, server-side flag).
  const isPlatformAdmin = actor.profile.platform_role === "platform_admin";
  const platformNav: NavItem[] = [
    { href: "/app/admin", label: tNav("administration") },
    ...(canOpenQualificationReview(actor.profile)
      ? [{ href: "/app/admin/verifications", label: tNav("verifications") }]
      : []),
    { href: "/app/admin/organizations", label: tNav("adminOrganizations") },
    // Agencies' represented clients awaiting the evidence (D-12 provisional, T-130).
    { href: "/app/admin/representations", label: tNav("representations") },
    { href: "/app/admin/audit", label: tNav("audit") },
  ];

  const sections: NavSection[] = [
    ...(actor.memberships.length > 0
      ? [
          {
            label: organization?.name ?? tNav("organization"),
            // An agency's workspace is «Espacio recruiter» (BR-27): its section follows that view.
            view: agency ? ("recruiter" as const) : ("organization" as const),
            items: organizationNav,
          },
        ]
      : []),
    ...(isProfessional
      ? [{ label: tNav("professional"), view: "professional" as const, items: professionalNav }]
      : []),
    ...(isPlatformAdmin
      ? [{ label: tNav("platform"), view: "admin" as const, items: platformNav }]
      : []),
    { label: tNav("account"), items: accountNav },
  ];
  const views = switcherViews(actor);
  // v1.8 dock (T-141): technician «Inicio · Ofertas · Calendario · Candidaturas · Herramientas»;
  // company «Inicio · Ofertas · Candidatos · Candidaturas · Herramientas» (SH-05 #2, directory package); admin two.
  const tools = { href: "/app/tools", label: tShell("dock.tools") };
  const docks: Partial<Record<WorkspaceView, NavItem[]>> = {
    ...(isProfessional
      ? {
          professional: [
            { href: "/app/professional", label: tShell("dock.home") },
            { href: "/app/professional/opportunities", label: tShell("dock.offers") },
            { href: "/app/professional/availability", label: tShell("dock.calendar") },
            { href: "/app/professional/applications", label: tShell("dock.applications") },
            tools,
          ],
        }
      : {}),
    ...(actor.memberships.length > 0
      ? {
          // The same dock under both views: an agency's home is /app/recruiter (BR-27).
          [agency ? "recruiter" : "organization"]: [
            { href: agency ? "/app/recruiter" : "/app/organization", label: tShell("dock.home") },
            { href: "/app/organization/requirements", label: tShell("dock.offers") },
            { href: "/app/organization/candidates", label: tShell("dock.candidates") },
            { href: "/app/organization/applications", label: tShell("dock.applications") },
            tools,
          ],
        }
      : {}),
    ...(isPlatformAdmin
      ? { admin: [{ href: "/app/admin", label: tShell("dock.administration") }, tools] }
      : {}),
  };
  // Where /app lands (src/app/app/page.tsx): the dock's view before a workspace page is opened.
  const homeView: WorkspaceView = isPlatformAdmin
    ? "admin"
    : actor.memberships.length > 0
      ? agency
        ? "recruiter"
        : "organization"
      : "professional";
  const bell = (onLight: boolean) => (
    <NoticeBell
      count={unread}
      label={badge ? tNotices("bell", { count: unread ?? 0 }) : tNotices("nav")}
      onLight={onLight}
    />
  );

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        {t("skipToContent")}
      </a>
      <aside className="bg-navy text-[#c4d3e1] lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col">
        <NavDrawer
          label={t("menu")}
          brand={
            <Link
              href="/app"
              className="flex items-center pointer-coarse:min-h-11 pointer-coarse:min-w-11"
            >
              {/* Below 420 px the mark alone (the name stays for assistive tech) leaves room for the bell. */}
              <Brand onDark compact />
            </Link>
          }
          // From `lg` the bell moves to the white header (TopBar); one count, read once above.
          bell={<span className="contents lg:hidden">{bell(false)}</span>}
          toolbar={
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-lg px-3 py-2 text-sm text-[#c4d3e1] hover:bg-white/5 pointer-coarse:min-h-11"
              >
                {t("signOut")}
              </button>
            </form>
          }
        >
          {views.length > 0 && (
            <ViewSwitcher
              label={tNav("viewAs")}
              views={views.map((view) => ({ view, label: tNav(`views.${view}`) }))}
            />
          )}
          <ViewSections sections={sections} byView={views.length > 0} />
        </NavDrawer>
        <div className="hidden border-t border-white/10 px-5 py-4 lg:block">
          <p className="truncate text-sm font-semibold text-white">{actor.profile.display_name}</p>
          <p className="truncate text-xs text-[#91aac1]">
            {accountSummaryKeys(actor)
              .map((key) => tDomain(key))
              .join(" · ")}
          </p>
          <form action={signOutAction}>
            <button
              type="submit"
              className="mt-1 text-sm text-[#c4d3e1] hover:text-white hover:underline pointer-coarse:min-h-11"
            >
              {t("signOut")}
            </button>
          </form>
        </div>
      </aside>
      {/* Below `lg` the column reserves the dock's height (and the home indicator's) at its end. */}
      <div className="flex min-w-0 flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <TopBar
          items={sections.flatMap((section) => section.items)}
          home={t("appName")}
          label={tShell("breadcrumb")}
          bell={bell(true)}
        />
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
        {/* v1.8 `.app-footer` without its version label (area 10 #16): the motto from `md`. */}
        <footer className="mx-4 flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-line py-5 text-xs tracking-[0.1em] text-muted sm:mx-6 lg:mx-10">
          <span className="uppercase">{`${t("appName")} ${t("brandTag")}`}</span>
          <span className="hidden md:inline">{tShell("motto")}</span>
        </footer>
      </div>
      <MobileDock label={tShell("dock.label")} docks={docks} initial={homeView} />
    </div>
  );
}
