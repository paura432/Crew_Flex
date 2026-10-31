import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { buttonClass } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { StatusChip } from "@/components/ui/StatusChip";
import { listNotices } from "@/features/notices/api";
import { MarkAllReadButton, OpenNoticeButton } from "@/features/notices/components/NoticeButtons";
import { noticesIntroKey, noticeTitleKey, trainingStatusKey } from "@/features/notices/view";
import {
  pageCount,
  pageOffset,
  parseRequirementsPage,
  REQUIREMENTS_PAGE_SIZE,
} from "@/features/requirements/pagination";
import type { Locale } from "@/i18n/config";
import { formatDateTime } from "@/i18n/format";
import { requireSessionActor } from "@/server/session";
import type { Notice } from "@/types/api";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notices");
  return { title: t("nav") };
}

const href = (page: number) => `/app/notices${page > 1 ? `?page=${page}` : ""}`;

/**
 * v2-18 «Avisos internos» (v1.8 connected `Account.jsx:54`, demo «Notificaciones»), for every account
 * type: the changes of the reader's applications and of the applications to their organization's
 * requirements, newest first, 20 per page. Text comes from the catalog (never a raw status code);
 * «Nuevo» until opened; each notice leads to the application. In-app only: no e-mail or push.
 */
export default async function NoticesPage({ searchParams }: PageProps<"/app/notices">) {
  const [{ page: pageParam }, actor, t, tDomain, tMatching, tOutreach, tTraining, locale] =
    await Promise.all([
      searchParams,
      requireSessionActor(),
      getTranslations("notices"),
      getTranslations("domain"),
      getTranslations("matching"),
      getTranslations("outreach"),
      getTranslations("training"),
      getLocale() as Promise<Locale>,
    ]);
  const page = parseRequirementsPage(pageParam);
  const result = await listNotices(pageOffset(page), REQUIREMENTS_PAGE_SIZE);
  const intro = noticesIntroKey({
    professional: actor.profile.account_type === "professional",
    manages: actor.memberships.some((m) => m.role === "admin" || m.role === "manager"),
  });
  const professional = actor.profile.account_type === "professional";
  const header = (actions?: ReactNode) => (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t(`intro.${intro}`)}
        actions={actions}
      />
      {/* PKG outreach (v1.8 «Configura Urgente/AOG, movilización y silencio desde tu perfil.») */}
      {professional && (
        <p className="-mt-2 mb-6 max-w-prose text-sm text-muted">
          {tOutreach("noticesHint")}{" "}
          <Link
            href="/app/settings#notice-preferences"
            className="font-semibold text-blue underline"
          >
            {tOutreach("noticesHintLink")}
          </Link>
        </p>
      )}
    </>
  );
  if (!result.ok) {
    return (
      <>
        {header()}
        <ApiErrorState error={result.error} requestId={result.requestId} />
      </>
    );
  }
  const { notices, total, unread } = result.data;
  const pages = pageCount(total);
  if (total > 0 && page > pages) redirect(href(pages));

  // v1.8 `app.mjs:104` «{modo}: {título}» for an Urgent/AOG distribution (PKG outreach).
  const title = (n: Notice) => {
    const key = noticeTitleKey(n);
    return key === "outreachUrgent" || key === "outreachAog"
      ? tOutreach(`notice.${key}`, { title: n.requirementTitle ?? "" })
      : t(`kind.${key}`);
  };
  const trainingStatus = (status: string) => {
    const key = trainingStatusKey(status);
    return key ? tTraining(`status.${key}`) : null;
  };
  const description = (n: Notice) =>
    (n.kind === "outreach"
      ? // The title names the need; the organization and v1.8's invitation to decide follow.
        [n.organizationName, tOutreach("notice.description")]
      : n.kind === "training"
        ? // ADR-003: the course (or provider) and the status reached, from the catalog.
          [n.training?.title, n.training && trainingStatus(n.training.status)]
        : [
            n.requirementTitle,
            n.audience === "technician"
              ? n.organizationName
              : (n.candidate?.name ?? tMatching("anonymous", { ref: n.candidate?.ref ?? "" })),
            // The title already names a new application and every requirement change.
            n.kind === "application" &&
            noticeTitleKey(n) === "applicationUpdate" &&
            n.applicationStatus
              ? tDomain(`applicationStatus.${n.applicationStatus}`)
              : null,
          ]
    )
      .filter(Boolean)
      .join(" · ");

  return (
    <>
      {header(total > 0 ? <MarkAllReadButton unread={unread} /> : undefined)}
      {total === 0 ? (
        <StateMessage title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <>
          <ul aria-label={t("listLabel")} className="space-y-3">
            {notices.map((n) => (
              <li key={n.id}>
                <article
                  aria-labelledby={`n-${n.id}`}
                  className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-white p-4 sm:p-5 ${
                    n.readAt ? "border-line" : "border-accent/60"
                  }`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 id={`n-${n.id}`} className="font-semibold break-words">
                        {title(n)}
                      </h2>
                      {!n.readAt && <StatusChip tone="info">{t("new")}</StatusChip>}
                    </div>
                    <p className="text-sm break-words">{description(n)}</p>
                    <p className="text-xs text-muted tabular-nums">
                      <time dateTime={n.createdAt}>{formatDateTime(locale, n.createdAt)}</time>
                    </p>
                  </div>
                  <OpenNoticeButton
                    id={n.id}
                    label={
                      n.kind === "outreach"
                        ? tOutreach("notice.open")
                        : n.kind === "training"
                          ? t(`openTraining.${n.audience}`)
                          : t(`open.${n.audience}`)
                    }
                  />
                </article>
              </li>
            ))}
          </ul>
          <nav
            aria-label={t("pagination")}
            className="mt-6 flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-sm text-muted">
              {t("pageInfo", { total, page: Math.min(page, pages), pages })}
            </p>
            {pages > 1 && (
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={href(page - 1)} className={buttonClass()}>
                    {t("previous")}
                  </Link>
                )}
                {page < pages && (
                  <Link href={href(page + 1)} className={buttonClass()}>
                    {t("next")}
                  </Link>
                )}
              </div>
            )}
          </nav>
        </>
      )}
    </>
  );
}
