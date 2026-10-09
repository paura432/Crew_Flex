import { AppShell } from "@/components/layout/AppShell";
import { requireSessionActor } from "@/server/session";

// Server-side session check in addition to proxy.ts (defense in depth).
export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const actor = await requireSessionActor();
  return <AppShell actor={actor}>{children}</AppShell>;
}
