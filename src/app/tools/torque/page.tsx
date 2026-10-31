import { TOOLS_BASE } from "@/features/tools/ids";
import { ToolScreen } from "@/features/tools/components/ToolScreen";
import { toolMetadata } from "@/features/tools/metadata";

export const generateMetadata = () => toolMetadata("torque");

// Public copy (T-145): no session, no data read; the proxy still sets the CSP.
export default function PublicToolsTorquePage() {
  return <ToolScreen id="torque" base={TOOLS_BASE.public} />;
}
