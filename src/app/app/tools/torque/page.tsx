import { TOOLS_BASE } from "@/features/tools/ids";
import { ToolScreen } from "@/features/tools/components/ToolScreen";
import { toolMetadata } from "@/features/tools/metadata";

export const generateMetadata = () => toolMetadata("torque");

// Signed-in workbench; the same screen is public at /tools (T-145).
export default function ToolsTorquePage() {
  return <ToolScreen id="torque" base={TOOLS_BASE.app} />;
}
