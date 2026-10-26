import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/Button";

/**
 * v1.8 `.home-section` of «Mi espacio» (`TechnicianHome.jsx:15`, T-161): kicker, h2 and «Ver todas ↗» on
 * one row, the feed in a bordered box below (`.home-feed`). Server-safe: no state.
 */
export function HomeSection({
  id,
  kicker,
  title,
  href,
  viewAll,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  href: string;
  viewAll: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">{kicker}</p>
          <h2 id={id} className="mt-1 text-2xl font-bold tracking-tight">
            {title}
          </h2>
        </div>
        <ButtonLink href={href} variant="ghost" className="shrink-0">
          {viewAll} <span aria-hidden>↗</span>
        </ButtonLink>
      </div>
      <div className="rounded-2xl border border-line bg-white">{children}</div>
    </section>
  );
}
