import { getTranslations } from "next-intl/server";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { Panel } from "@/components/ui/Panel";
import { getNoticePreferences } from "../api";
import { NoticePreferencesForm } from "./NoticePreferencesForm";

/** N-10 «Avisos de oportunidades» in Configuración (professional accounts; the page decides). */
export async function NoticePreferencesSection() {
  const [t, result] = await Promise.all([
    getTranslations("outreach.preferences"),
    getNoticePreferences(),
  ]);
  return (
    // The anchor the «Avisos» page links to.
    <div id="notice-preferences" className="scroll-mt-6">
      <Panel title={t("title")}>
        {result.ok ? (
          <NoticePreferencesForm preferences={result.data.preferences} />
        ) : (
          <ApiErrorState error={result.error} requestId={result.requestId} />
        )}
      </Panel>
    </div>
  );
}
