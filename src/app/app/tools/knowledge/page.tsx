import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { KnowledgeTool } from "@/features/tools/components/KnowledgeTool";
import { ToolsHeader } from "@/features/tools/components/ToolsHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tools");
  return { title: t("tile.knowledge.title") };
}

export default async function ToolsKnowledgePage() {
  const t = await getTranslations("tools");
  return (
    <>
      <ToolsHeader title={t("tile.knowledge.title")} back />
      <KnowledgeTool />
    </>
  );
}
