import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ToolsHeader } from "@/features/tools/components/ToolsHeader";
import { ToolsHome } from "@/features/tools/components/ToolsHome";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("tools") };
}

// Every signed-in account (professional and organization), like the prototype. Calculations run in
// the browser; nothing is stored server-side. The session is checked by the /app layout.
export default async function ToolsPage() {
  const t = await getTranslations("tools");
  return (
    <>
      <ToolsHeader title={t("homeTitle")} />
      <ToolsHome />
    </>
  );
}
