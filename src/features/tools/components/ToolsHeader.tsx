import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { TOOLS_BASE, type ToolsBase } from "../ids";

/** Workbench header (prototype `.tb-header`): kicker, title, lead and the way back to all tools. */
export async function ToolsHeader({
  title,
  back = false,
  base = TOOLS_BASE.app,
}: {
  title: string;
  back?: boolean;
  /** The workbench «Todas las herramientas» returns to (the public copy has its own, T-145). */
  base?: ToolsBase;
}) {
  const t = await getTranslations("tools");
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#dae8ed] pb-4">
      <div className="min-w-0">
        <p className="text-xs font-extrabold tracking-[0.17em] text-[#157877]">{t("kicker")}</p>
        <h1 className="mt-1.5 text-3xl leading-tight font-bold tracking-tight text-[#122e43] sm:text-[34px]">
          {title}
        </h1>
        <p className="mt-2 text-sm text-[#587083]">{t("lead")}</p>
      </div>
      {back && (
        <Link
          href={base}
          className="inline-flex min-h-10 pointer-coarse:min-h-11 items-center rounded-lg border border-[#ccd9df] px-4 text-xs font-bold text-[#1d4458] hover:bg-white"
        >
          {t("allTools")}
        </Link>
      )}
    </header>
  );
}
