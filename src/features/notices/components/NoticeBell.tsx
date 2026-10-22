import Link from "next/link";
import { unreadBadge } from "../view";

/** Lucide `bell` (v1.8 demo `Bell 20`), inline like the menu icons. */
export const BELL_PATH = "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0";

/**
 * The shell's bell (v1.8 demo «Ver notificaciones»): a link to «Avisos» with the unread count
 * (the demo had only a dot). The accessible name carries the count; the badge is decoration.
 * `count` null = unknown (the service could not answer): no badge, the link still works.
 */
export function NoticeBell({ count, label }: { count: number | null; label: string }) {
  const badge = unreadBadge(count);
  return (
    <Link
      href="/app/notices"
      aria-label={label}
      className="relative grid size-10 shrink-0 place-items-center rounded-lg text-[#c4d3e1] hover:bg-white/5 hover:text-white pointer-coarse:size-11"
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={BELL_PATH} />
      </svg>
      {badge && (
        <span
          aria-hidden
          className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-xs leading-none font-bold text-ink tabular-nums"
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
