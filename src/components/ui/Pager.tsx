import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClass } from "./Button";

/**
 * «{total} … · página {p} de {n}» (`role=status`) with «Anterior» / «Siguiente» links; the caller builds
 * the texts and the hrefs (null = no such page). V1.8 pages its lists by 20.
 */
export function Pager({
  label,
  info,
  previous,
  next,
  note,
}: {
  label: string;
  info: string;
  previous: { href: string; label: string } | null;
  next: { href: string; label: string } | null;
  note?: ReactNode;
}) {
  return (
    <nav aria-label={label} className="mt-6 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" role="status">
          {info}
        </p>
        {(previous || next) && (
          <div className="flex gap-2">
            {previous && (
              <Link href={previous.href} className={buttonClass()}>
                {previous.label}
              </Link>
            )}
            {next && (
              <Link href={next.href} className={buttonClass()}>
                {next.label}
              </Link>
            )}
          </div>
        )}
      </div>
      {note && <p className="text-xs text-muted">{note}</p>}
    </nav>
  );
}
