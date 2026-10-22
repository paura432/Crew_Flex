import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { signOutAction } from "@/features/auth/actions";
import { getUnreadNoticeCount } from "@/features/notices/api";
import { NoticeBell } from "@/features/notices/components/NoticeBell";
import { unreadBadge } from "@/features/notices/view";
import { canOpenQualificationReview, isDocumentWalletEnabled } from "@/server/feature-flags";
import { primaryMembership, type SessionActor } from "@/server/session";
import { accountSummaryKeys } from "./account-summary";
import { NavDrawer } from "./NavDrawer";
import type { NavItem } from "./NavLinks";
import { switcherViews } from "./views";
import { ViewSections, ViewSwitcher, type NavSection } from "./ViewSwitcher";

export async function AppShell({ actor, children }: { actor: SessionActor; children: ReactNode }) {
  const [t, tNav, tDomain, tNotices, walletEnabled, unreadResult] = await Promise.all([
    getTranslations("common"),
    getTranslations("nav"),
    getTranslations("domain"),
    getTranslations("notices"),
    actor.profile.account_type === "professional" ? isDocumentWalletEnabled() : false,
    getUnreadNoticeCount(),
  ]);
  // v2-18: unknown when the service does not answer — no badge, the page says why. Layouts do not
  // re-render on navigation: the count is fresh on load and after any action (revalidatePath).
  const unread = unreadResult.ok ? unreadResult.data.unread : null;
  const badge = unreadBadge(unread);
  const organization = primaryMembership(actor)?.organization;
  const isProfessional = actor.profile.account_type === "professional";

  const organizationNav: NavItem[] = [
    { href: "/app/organization", label: tNav("dashboard") },
    { href: "/app/organization/requirements", label: tNav("requirements") },
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
    { href: "/app/admin/audit", label: tNav("audit") },
  ];

  const sections: NavSection[] = [
    ...(actor.memberships.length > 0
      ? [
          {
            label: organization?.name ?? tNav("organization"),
            view: "organization" as const,
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

  return (
    <div className="min-h-screen lg:flex">
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
              className="flex items-center gap-2.5 text-white pointer-coarse:min-h-11"
            >
              <span
                aria-hidden
                className="grid size-9 place-items-center rounded-lg bg-accent font-black text-navy"
              >
                CF
              </span>
              {/* Below 420 px the mark alone (the name stays for assistive tech) leaves room for the bell. */}
              <span className="sr-only leading-tight min-[420px]:not-sr-only">
                <span className="block text-lg font-bold tracking-tight">{t("appName")}</span>
                <span className="block text-[11px] tracking-[0.28em] text-[#91aac1]">
                  {t("brandTag")}
                </span>
              </span>
            </Link>
          }
          bell={
            <NoticeBell
              count={unread}
              label={badge ? tNotices("bell", { count: unread ?? 0 }) : tNotices("nav")}
            />
          }
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
      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
