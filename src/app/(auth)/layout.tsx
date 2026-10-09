import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid size-9 place-items-center rounded-lg bg-accent font-black text-navy"
          >
            CF
          </span>
          <span className="text-lg font-bold tracking-tight">Crew Flex</span>
        </Link>
        <main className="rounded-xl border border-line bg-white p-6 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
