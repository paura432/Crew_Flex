import { TOOLS_BASE } from "@/features/tools/ids";
import { ToolScreen } from "@/features/tools/components/ToolScreen";
import { toolMetadata } from "@/features/tools/metadata";

export const generateMetadata = () => toolMetadata("translator");

// Signed-in workbench; the same screen is public at /tools (T-145).
export default function ToolsTranslatorPage() {
  return <ToolScreen id="translator" base={TOOLS_BASE.app} />;
}
