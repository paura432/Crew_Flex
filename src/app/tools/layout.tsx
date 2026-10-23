import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/layout/Brand";
import { ButtonLink } from "@/components/ui/Button";
import { LocaleSwitcher } from "@/features/preferences/components/LocaleSwitcher";

/**
 * v1.8 tools without an account (area 10 #10, TOOL-01 #1, T-145): the anonymous shell of the
 * connected v1.8 («Acceder a mi cuenta» · «Herramientas»). Public like the landing: it reads no
 * session and no data (the proxy only refreshes cookies and sets the same CSP).
 */
export default async function PublicToolsLayout({ children }: { children: ReactNode }) {
  const [t, tCommon] = await Promise.all([
    getTranslations("publicTools"),
    getTranslations("common"),
  ]);
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        {tCommon("skipToContent")}
      </a>
      <header className="bg-navy text-[#c4d3e1]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center pointer-coarse:min-h-11">
            <Brand onDark compact />
          </Link>
          <div className="flex items-center gap-2">
            <LocaleSwitcher variant="compact" onDark />
            <ButtonLink href="/login" variant="inverse">
              {t("signIn")}
            </ButtonLink>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-10">
        <p className="mb-6 rounded-lg border border-line bg-white px-4 py-3 text-sm text-muted">
          {t("note")}
        </p>
        {children}
      </main>
    </div>
  );
}
