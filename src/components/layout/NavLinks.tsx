"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BELL_PATH } from "@/features/notices/components/NoticeBell";
import { isActiveHref } from "./nav-active";

export interface NavItem {
  href: string;
  label: string;
  /** A count after the label (unread notices): `text` is shown, `label` is what assistive tech reads. */
  badge?: { text: string; label: string };
}

// V1.8 `icons[tab]` (Shared.jsx: lucide 19 px, fallback Briefcase). Inline paths: no icon dependency.
const BRIEFCASE = "M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2";
const DASHBOARD = "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z";
const ICON_PATHS: Record<string, string> = {
  "/app/organization": DASHBOARD,
  "/app/organization/requirements": BRIEFCASE,
  "/app/organization/workforce":
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  "/app/professional": DASHBOARD,
  "/app/professional/profile":
    "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  "/app/professional/qualifications":
    "M12 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12M15.5 13 17 22l-5-3-5 3 1.5-9",
  "/app/professional/availability":
    "M3 4h18v18H3zM16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01",
  "/app/professional/opportunities": BRIEFCASE,
  "/app/professional/applications":
    "M9 2h6v4H9zM16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 14l2 2 4-4",
  // hiring-polish: the organization's «Candidaturas» and «Ofertas en la red» (v1.8 applications, jobs)
  "/app/organization/applications":
    "M9 2h6v4H9zM16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 14l2 2 4-4",
  "/app/organization/network": BRIEFCASE,
  // directory package: v1.8 `candidates: Search`
  "/app/organization/candidates": "M21 21l-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16",
  "/app/professional/documents":
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8",
  // v1.8 `logbook: BookOpen`
  "/app/professional/logbook":
    "M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",
  "/app/notices": BELL_PATH,
  "/app/tools":
    "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-8 8l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 8-8z",
  "/app/settings":
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.8 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.8H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.8-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1",
  "/app/admin/verifications":
    "M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1 1 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1zM9 12l2 2 4-4",
  // admin-org package: «Organización», «Administración», «Organizaciones», «Auditoría»
  "/app/organization/settings":
    "M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M10 21v-4h4v4",
  "/app/admin": DASHBOARD,
  "/app/admin/organizations": "M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M10 21v-4h4v4",
  // PKG recruiter: an agency's «Resumen» (v1.8 home) and the platform admin's «Representaciones» (users)
  "/app/recruiter": DASHBOARD,
  "/app/admin/representations":
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  "/app/admin/audit":
    "M9 2h6v4H9zM16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M8 11h8M8 15h8M8 19h5",
};

/** The menu icon of an entry (the mobile dock reuses it). */
export const iconPath = (href: string) => ICON_PATHS[href] ?? BRIEFCASE;

/** The inline 18 px stroke icon of an entry; the active one is accent in the sidebar. */
export function NavIcon({ href, className }: { href: string; className: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={iconPath(href)} />
    </svg>
  );
}

/**
 * Client only for `aria-current` on the active link. Below `lg` the items wrap onto as many rows as
 * needed: a horizontally scrolling strip hid the last item ("Availability") with no affordance.
 */
export function NavLinks({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-1 lg:flex-col">
        {items.map((item) => {
          const active = isActiveHref(item.href, pathname);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm pointer-coarse:min-h-11 whitespace-nowrap text-[#c4d3e1] hover:bg-white/5 hover:text-white aria-[current=page]:bg-navy-700 aria-[current=page]:text-white"
              >
                {/* V1.8 `.sidebar button.active svg{color:#ffad54}` */}
                <NavIcon
                  href={item.href}
                  className="size-[18px] shrink-0 group-aria-[current=page]:text-accent"
                />
                {item.label}
                {item.badge && (
                  <>
                    <span
                      aria-hidden
                      className="ml-auto rounded-full bg-accent px-1.5 text-xs leading-5 font-bold text-ink tabular-nums"
                    >
                      {item.badge.text}
                    </span>
                    <span className="sr-only">{` ${item.badge.label}`}</span>
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
