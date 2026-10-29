import { NextResponse, type NextRequest } from "next/server";
import { getMySessions } from "@/features/training/api";
import { sessionsIcs } from "@/features/training/ics";

/**
 * v1.9 «Exportar sesiones .ics» (V19-030): the caller's own confirmed sessions as a private download, as the
 * account export does (`/app/settings/export`). The function re-checks the session and the `training` flag.
 * A failure goes back to «Mis solicitudes» with a notice.
 */
export async function GET(request: NextRequest) {
  const result = await getMySessions();
  if (!result.ok) {
    return NextResponse.redirect(new URL("/app/training/requests?ics=failed", request.url));
  }
  return new Response(sessionsIcs(result.data.sessions, new Date().toISOString()), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="CrewFlex-formacion.ics"',
      "Cache-Control": "no-store",
    },
  });
}
