import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PUBLIC_TOOL_IDS, TOOLS_BASE } from "@/features/tools/ids";
import { ToolsHeader } from "@/features/tools/components/ToolsHeader";
import { ToolsHome } from "@/features/tools/components/ToolsHome";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("tools") };
}

// Public workbench (T-145): the browser-only tools, linking inside /tools; no session, no data.
export default async function PublicToolsPage() {
  const t = await getTranslations("tools");
  return (
    <>
      <ToolsHeader title={t("homeTitle")} />
      <ToolsHome base={TOOLS_BASE.public} ids={PUBLIC_TOOL_IDS} />
    </>
  );
}
