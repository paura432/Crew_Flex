import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import type { PublicToolId, ToolsBase } from "../ids";
import { DurationTool } from "./DurationTool";
import { KnowledgeTool } from "./KnowledgeTool";
import { ToolsHeader } from "./ToolsHeader";
import { TranslatorTool } from "./TranslatorTool";
import { UnitConverter } from "./UnitConverter";

const BODY: Record<PublicToolId, ReactNode> = {
  // One h1 (the workbench header); the translator's own title is an h2 (v1.8 had two h1, ✗ TOOL-06 #2).
  translator: <TranslatorTool />,
  torque: <UnitConverter torque />,
  convert: <UnitConverter />,
  knowledge: <KnowledgeTool />,
  duration: <DurationTool />,
};

/**
 * One browser-only tool with the workbench header, shared by /app/tools and the public /tools (T-145):
 * calculations run in the browser on bundled data; nothing is read from or stored on the server.
 */
export async function ToolScreen({ id, base }: { id: PublicToolId; base: ToolsBase }) {
  const t = await getTranslations("tools");
  return (
    <>
      <ToolsHeader title={t(`tile.${id}.title`)} back base={base} />
      {BODY[id]}
    </>
  );
}
