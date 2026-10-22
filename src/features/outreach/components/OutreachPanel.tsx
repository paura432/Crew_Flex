import { getLocale, getTranslations } from "next-intl/server";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { Panel } from "@/components/ui/Panel";
import { canDistributeOutreach, isOutreachUrgency } from "@/domain/outreach";
import type { WorkRequirement } from "@/domain/work-requirement";
import type { Locale } from "@/i18n/config";
import { formatDateTime } from "@/i18n/format";
import { getOutreachStatus } from "../api";
import { DistributeOutreachButton } from "./DistributeOutreachButton";

/**
 * v2-17, v1.8 «Distribución {urgencia}» (`Company2.jsx:168-176`) on an Urgent or AOG need: what the
 * distribution does, then the button while it can run, or when it ran and how many notices it created.
 * Never who received them. Planned needs and plain members get nothing (the read is admin/manager).
 */
export async function OutreachPanel({
  requirement,
  canManage,
  now,
}: {
  requirement: Pick<WorkRequirement, "id" | "status" | "urgency" | "startsAt">;
  canManage: boolean;
  /** Request time, from the page (render stays pure). */
  now: number;
}) {
  if (!canManage || !isOutreachUrgency(requirement.urgency)) return null;
  const [t, tDomain, locale, status] = await Promise.all([
    getTranslations("outreach.distribution"),
    getTranslations("domain"),
    getLocale() as Promise<Locale>,
    getOutreachStatus(requirement.id),
  ]);
  const title = t("title", { urgency: tDomain(`urgency.${requirement.urgency}`) });
  if (!status.ok) {
    return (
      <Panel title={title}>
        <ApiErrorState error={status.error} requestId={status.requestId} />
      </Panel>
    );
  }
  const { distribution } = status.data;
  const offered = canDistributeOutreach(requirement, distribution !== null, now);
  return (
    <Panel title={title}>
      <div className="space-y-3">
        <p className="max-w-prose text-sm text-muted">{t("explain")}</p>
        {distribution ? (
          <p className="text-sm font-medium">
            {t("done", {
              date: formatDateTime(locale, distribution.distributedAt),
              count: distribution.notified,
            })}
          </p>
        ) : (
          !offered && <p className="text-sm text-muted">{t("notOffered")}</p>
        )}
        <DistributeOutreachButton requirementId={requirement.id} offered={offered} />
      </div>
    </Panel>
  );
}
