import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ToolsHeader } from "@/features/tools/components/ToolsHeader";
import { TranslatorTool } from "@/features/tools/components/TranslatorTool";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tools");
  return { title: t("tile.translator.title") };
}

// One h1 (the workbench header); the translator's own title is an h2 (v1.8 had two h1, ✗ TOOL-06 #2).
export default async function ToolsTranslatorPage() {
  const t = await getTranslations("tools");
  return (
    <>
      <ToolsHeader title={t("tile.translator.title")} back />
      <TranslatorTool />
    </>
  );
}
