import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { ButtonLink } from "@/components/ui/Button";
import { FilterPill } from "@/components/ui/FilterPill";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pager } from "@/components/ui/Pager";
import { StateMessage } from "@/components/ui/StateMessage";
import {
  TRAINING_REQUEST_STATUSES,
  TRAINING_STATUS_LABEL_KEYS,
  type TrainingRequestStatus,
} from "@/domain/training";
import { getInbox } from "@/features/training/api";
import { RequestActions } from "@/features/training/components/RequestActions";
import { RequestSummary } from "@/features/training/components/TrainingViews";
import { requireTrainingProvider } from "@/features/training/provider";
import { INBOX_PATH, PROVIDER_PATH } from "@/features/training/view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("trainingInbox") };
}

const PAGE = 20;

/** V19-022…026: inquiries and seat requests to the organization's courses; only the display name and the note (N-5). */
export default async function TrainingInboxPage({
  searchParams,
}: PageProps<"/app/organization/training/inbox">) {
  const { organization } = await requireTrainingProvider();
  const [search, t, tStatus] = await Promise.all([
    searchParams,
    getTranslations("training.provider.inbox"),
    getTranslations("training.status"),
  ]);
  const status = TRAINING_REQUEST_STATUSES.includes(search.status as TrainingRequestStatus)
    ? (search.status as TrainingRequestStatus)
    : undefined;
  const page = Math.max(1, Number.parseInt(String(search.page ?? "1"), 10) || 1);
  const result = await getInbox({
    organizationId: organization.id,
    status,
    offset: (page - 1) * PAGE,
    limit: PAGE,
  });
  const href = (s?: string, p = 1) => {
    const q = new URLSearchParams({
      ...(s ? { status: s } : {}),
      ...(p > 1 ? { page: String(p) } : {}),
    }).toString();
    return q ? `${INBOX_PATH}?${q}` : INBOX_PATH;
  };
  const pages = result.ok ? Math.max(1, Math.ceil(result.data.total / PAGE)) : 1;

  return (
    <>
      <PageHeader
        eyebrow={organization.name}
        title={t("title")}
        description={t("description")}
        actions={
          <ButtonLink href={PROVIDER_PATH} variant="ghost">
            {t("back")}
          </ButtonLink>
        }
      />
      <nav aria-label={t("filter")} className="mb-4 flex flex-wrap gap-2">
        <FilterPill href={href()} current={!status}>
          {t("all")}
        </FilterPill>
        {TRAINING_REQUEST_STATUSES.map((s) => (
          <FilterPill key={s} href={href(s)} current={status === s}>
            {tStatus(TRAINING_STATUS_LABEL_KEYS[s] as never)}
          </FilterPill>
        ))}
      </nav>
      {!result.ok ? (
        <ApiErrorState error={result.error} requestId={result.requestId} />
      ) : result.data.requests.length === 0 ? (
        <StateMessage title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <>
          <div className="space-y-4">
            {result.data.requests.map((r) => (
              <RequestSummary
                key={r.id}
                request={r}
                side="provider"
                actions={<RequestActions request={r} side="provider" />}
              />
            ))}
          </div>
          <Pager
            label={t("pagerLabel")}
            info={t("pageInfo", { page, pages })}
            previous={page > 1 ? { href: href(status, page - 1), label: t("previous") } : null}
            next={page < pages ? { href: href(status, page + 1), label: t("next") } : null}
          />
        </>
      )}
    </>
  );
}
