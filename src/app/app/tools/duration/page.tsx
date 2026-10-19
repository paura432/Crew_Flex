import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DurationTool } from "@/features/tools/components/DurationTool";
import { ToolsHeader } from "@/features/tools/components/ToolsHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tools");
  return { title: t("tile.duration.title") };
}

export default async function ToolsDurationPage() {
  const t = await getTranslations("tools");
  return (
    <>
      <ToolsHeader title={t("tile.duration.title")} back />
      <DurationTool />
    </>
  );
}
