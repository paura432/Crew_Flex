import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { buttonClass, ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StateMessage } from "@/components/ui/StateMessage";
import { getFavorites, getMyRequests } from "@/features/training/api";
import { RequestActions } from "@/features/training/components/RequestActions";
import { RequestSummary } from "@/features/training/components/TrainingViews";
import { TRAINING_PATH } from "@/features/training/view";
import { isTrainingEnabled } from "@/server/feature-flags";
import { requireSessionActor } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("trainingRequests") };
}

/**
 * V19-021/023/025: the professional's requests, explicit acceptance of the current terms, withdraw and cancel; favourites.
 * V19-030: the confirmed sessions as a private .ics download (a plain link, no script).
 */
export default async function TrainingRequestsPage({
  searchParams,
}: PageProps<"/app/training/requests">) {
  if (!(await isTrainingEnabled())) notFound();
  const [params, , t] = await Promise.all([
    searchParams,
    requireSessionActor(),
    getTranslations("training.requests"),
  ]);
  const [requests, favorites] = await Promise.all([getMyRequests(), getFavorites()]);
  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          <>
            <a href={`${TRAINING_PATH}/sessions.ics`} download className={buttonClass()}>
              {t("exportIcs")}
            </a>
            <ButtonLink href={TRAINING_PATH}>{t("toCatalog")}</ButtonLink>
          </>
        }
      />
      {params.ics === "failed" && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-sm text-danger"
        >
          {t("icsFailed")}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="space-y-4" aria-label={t("title")}>
          {!requests.ok ? (
            <ApiErrorState error={requests.error} requestId={requests.requestId} />
          ) : requests.data.requests.length === 0 ? (
            <StateMessage title={t("emptyTitle")} description={t("emptyDescription")} />
          ) : (
            requests.data.requests.map((r) => (
              <RequestSummary
                key={r.id}
                request={r}
                side="professional"
                actions={<RequestActions request={r} side="professional" />}
              />
            ))
          )}
        </section>
        <Panel title={t("favoritesTitle")}>
          {!favorites.ok ? (
            <ApiErrorState error={favorites.error} requestId={favorites.requestId} />
          ) : favorites.data.courses.length === 0 ? (
            <p className="text-sm text-muted">{t("favoritesEmpty")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {favorites.data.courses.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`${TRAINING_PATH}/${c.id}`}
                    className="font-semibold text-blue hover:underline pointer-coarse:min-h-11"
                  >
                    {c.title}
                  </Link>
                  <span className="text-muted"> · {c.providerName}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
