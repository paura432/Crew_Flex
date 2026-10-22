import { getLocale } from "next-intl/server";
import { NextResponse, type NextRequest } from "next/server";
import { exportFileName } from "@/features/account/state";
import { invokeEdgeFunction } from "@/server/edge-functions";
import type { AccountExportResponse } from "@/types/api";

/**
 * «Exportar mis datos y archivos» (v1.8 `CrewFlex-mis-datos.json`, M-3 default T-43): the caller's own
 * export from the `account` function, as a JSON download. A plain link (no script); the proxy already
 * sends signed-out visitors to the login. A failure goes back to Settings with a notice.
 */
export async function GET(request: NextRequest) {
  const result = await invokeEdgeFunction<AccountExportResponse>("account");
  if (!result.ok) {
    return NextResponse.redirect(new URL("/app/settings?export=failed", request.url));
  }
  const name = exportFileName(await getLocale());
  return new Response(JSON.stringify(result.data.export, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
