import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { UnitConverter } from "@/features/tools/components/UnitConverter";
import { ToolsHeader } from "@/features/tools/components/ToolsHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tools");
  return { title: t("tile.torque.title") };
}

export default async function ToolsTorquePage() {
  const t = await getTranslations("tools");
  return (
    <>
      <ToolsHeader title={t("tile.torque.title")} back />
      <UnitConverter torque />
    </>
  );
}
