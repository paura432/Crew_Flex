import Link from "next/link";
import type { ReactNode } from "react";
import { signOutAction } from "@/features/auth/actions";
import type { SessionActor } from "@/server/session";
import { NavLinks, type NavItem } from "./NavLinks";

const ORGANIZATION_NAV: NavItem[] = [
  { href: "/app/organization", label: "Dashboard" },
  { href: "/app/organization/requirements", label: "Requirements" },
  { href: "/app/organization/workforce", label: "Workforce" },
];

const PROFESSIONAL_NAV: NavItem[] = [
  { href: "/app/professional", label: "Overview" },
  { href: "/app/professional/profile", label: "Profile" },
  { href: "/app/professional/qualifications", label: "Qualifications" },
  { href: "/app/professional/availability", label: "Availability" },
];

export function AppShell({ actor, children }: { actor: SessionActor; children: ReactNode }) {
  const organization = actor.memberships[0]?.organization;
  const isProfessional = actor.profile.account_type === "professional";
  const sections = [
    ...(actor.memberships.length > 0
      ? [{ label: organization?.name ?? "Organization", items: ORGANIZATION_NAV }]
      : []),
    ...(isProfessional ? [{ label: "Professional", items: PROFESSIONAL_NAV }] : []),
  ];

  return (
    <div className="min-h-screen lg:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <aside className="bg-navy text-[#c4d3e1] lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col">
        <div className="flex items-center justify-between gap-4 px-4 py-4 lg:px-5 lg:py-6">
          <Link href="/app" className="flex items-center gap-2.5 text-white">
            <span
              aria-hidden
              className="grid size-9 place-items-center rounded-lg bg-accent font-black text-navy"
            >
              CF
            </span>
            <span className="leading-tight">
              <span className="block text-lg font-bold tracking-tight">Crew Flex</span>
              <span className="block text-[11px] tracking-[0.28em] text-[#91aac1]">AVIATION</span>
            </span>
          </Link>
          <form action={signOutAction} className="lg:hidden">
            <button
              type="submit"
              className="rounded-lg px-3 py-2 text-sm text-[#c4d3e1] hover:bg-white/5"
            >
              Sign out
            </button>
          </form>
        </div>
        <div className="space-y-4 px-2 pb-3 lg:flex-1 lg:px-3">
          {sections.map((section) => (
            <div key={section.label}>
              <p className="hidden px-3 pb-2 text-[11px] font-semibold tracking-[0.16em] text-[#91aac1] uppercase lg:block">
                {section.label}
              </p>
              <NavLinks items={section.items} label={section.label} />
            </div>
          ))}
        </div>
        <div className="hidden border-t border-white/10 px-5 py-4 lg:block">
          <p className="truncate text-sm font-semibold text-white">{actor.profile.display_name}</p>
          <form action={signOutAction}>
            <button
              type="submit"
              className="mt-1 text-sm text-[#c4d3e1] hover:text-white hover:underline"
            >
              Sign out
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
