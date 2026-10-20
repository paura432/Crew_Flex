"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
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
          const active =
            item.href === pathname ||
            (item.href !== "/app/organization" &&
              item.href !== "/app/professional" &&
              pathname.startsWith(`${item.href}/`));
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="flex items-center rounded-lg px-3 py-2.5 text-sm pointer-coarse:min-h-11 whitespace-nowrap text-[#c4d3e1] hover:bg-white/5 hover:text-white aria-[current=page]:bg-navy-700 aria-[current=page]:text-white"
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
