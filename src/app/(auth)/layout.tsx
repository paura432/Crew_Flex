import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { LocaleSwitcher } from "@/features/preferences/components/LocaleSwitcher";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("common");
  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="grid size-9 place-items-center rounded-lg bg-accent font-black text-navy"
            >
              CF
            </span>
            <span className="text-lg font-bold tracking-tight">{t("appName")}</span>
          </Link>
          <LocaleSwitcher variant="compact" />
        </div>
        <main className="rounded-xl border border-line bg-white p-6 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
