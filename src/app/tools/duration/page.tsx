import { TOOLS_BASE } from "@/features/tools/ids";
import { ToolScreen, toolMetadata } from "@/features/tools/components/ToolScreen";

export const generateMetadata = () => toolMetadata("duration");

// Public copy (T-145): no session, no data read; the proxy still sets the CSP.
export default function PublicToolsDurationPage() {
  return <ToolScreen id="duration" base={TOOLS_BASE.public} />;
}
