import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/layout/Brand";
import { LocaleSwitcher } from "@/features/preferences/components/LocaleSwitcher";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center pointer-coarse:min-h-11">
            <Brand />
          </Link>
          <LocaleSwitcher variant="compact" />
        </div>
        <main className="rounded-xl border border-line bg-white p-6 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
