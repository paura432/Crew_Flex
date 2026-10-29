import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DailyChallenge } from "@/features/tools/components/DailyChallenge";
import { ToolsHeader } from "@/features/tools/components/ToolsHeader";
import { requireSessionActor } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tools");
  return { title: t("tile.daily.title") };
}

// Progress is kept in this browser under the signed-in user's id (from the verified session, never
// from the request). One h1 (v1.8 had two, ✗ TOOL-07 #2).
export default async function ToolsDailyPage() {
  const [t, actor] = await Promise.all([getTranslations("tools"), requireSessionActor()]);
  return (
    <>
      <ToolsHeader title={t("tile.daily.title")} back />
      <DailyChallenge userId={actor.id} />
    </>
  );
}
