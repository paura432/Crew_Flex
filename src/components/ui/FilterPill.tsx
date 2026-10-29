import Link from "next/link";
import type { ReactNode } from "react";

/** v1.8 `.filter-tabs` button as a plain link (works without JavaScript); the current one is navy. */
export function FilterPill({
  href,
  current,
  children,
}: {
  href: string;
  current: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "true" : undefined}
      className="inline-flex min-h-9 items-center rounded-full border border-line bg-white px-4 text-sm font-semibold text-muted pointer-coarse:min-h-11 aria-[current=true]:border-navy aria-[current=true]:bg-navy aria-[current=true]:text-white"
    >
      {children}
    </Link>
  );
}
