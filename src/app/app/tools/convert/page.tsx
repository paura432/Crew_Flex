import { TOOLS_BASE } from "@/features/tools/ids";
import { ToolScreen, toolMetadata } from "@/features/tools/components/ToolScreen";

export const generateMetadata = () => toolMetadata("convert");

// Signed-in workbench; the same screen is public at /tools (T-145).
export default function ToolsConvertPage() {
  return <ToolScreen id="convert" base={TOOLS_BASE.app} />;
}
