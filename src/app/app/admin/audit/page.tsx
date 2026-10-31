import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonClass } from "@/components/ui/button-class";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StateMessage } from "@/components/ui/StateMessage";
import { listAuditEvents } from "@/features/admin/api";
import { metadataPairs, parseAuditPage, shortId } from "@/features/admin/map";
import type { Locale } from "@/i18n/config";
import { formatDateTime } from "@/i18n/format";
import { requireSessionActor } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("audit") };
}

const href = (page: number) => `/app/admin/audit${page > 1 ? `?page=${page}` : ""}`;

function Id({ id }: { id: string | null }) {
  return id ? (
    <span className="font-mono" title={id}>
      {shortId(id)}
    </span>
  ) : (
    <span>—</span>
  );
}

/**
 * Read-only audit trail for platform admins (v1.8 «Auditoría», ADM-02 #17): newest first, 50 per
 * page, with actor and object as the rows store them (ids, codes and flags; never free text or
 * personal data, S-9). 404 for anyone else (proxy + this page; RLS would show them nothing anyway).
 */
export default async function AuditPage({ searchParams }: PageProps<"/app/admin/audit">) {
  const actor = await requireSessionActor();
  if (actor.profile.platform_role !== "platform_admin") notFound();
  const [{ page: pageParam }, t, locale] = await Promise.all([
    searchParams,
    getTranslations("admin.audit"),
    getLocale() as Promise<Locale>,
  ]);
  const page = parseAuditPage(pageParam);
  const result = await listAuditEvents(page);

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      {!result ? (
        <StateMessage tone="danger" title={t("errorTitle")} description={t("errorText")} />
      ) : result.events.length === 0 ? (
        <StateMessage
          title={t("emptyTitle")}
          action={
            page > 1 ? (
              <Link href={href(1)} className={buttonClass()}>
                {t("first")}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <caption className="sr-only">{t("caption", { page })}</caption>
              <thead className="bg-canvas text-xs font-semibold text-muted">
                <tr>
                  <th scope="col" className="py-2 pr-4">
                    {t("when")}
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    {t("action")}
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    {t("actor")}
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    {t("object")}
                  </th>
                  <th scope="col" className="py-2">
                    {t("details")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.events.map((event) => (
                  <tr key={event.id} className="border-t border-line align-top">
                    <td className="py-2 pr-4 whitespace-nowrap tabular-nums">
                      {formatDateTime(locale, event.at)}
                    </td>
                    <td className="py-2 pr-4 font-mono">{event.action}</td>
                    <td className="py-2 pr-4">
                      {event.actorId ? <Id id={event.actorId} /> : t("system")}
                    </td>
                    <td className="py-2 pr-4">
                      {event.entityType} · <Id id={event.entityId} />
                    </td>
                    <td className="py-2 font-mono text-xs break-all text-muted">
                      {metadataPairs(event.metadata).join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav
            aria-label={t("pagination")}
            className="mt-6 flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-sm text-muted">{t("pageInfo", { page })}</p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={href(page - 1)} className={buttonClass()}>
                  {t("newer")}
                </Link>
              )}
              {result.hasMore && (
                <Link href={href(page + 1)} className={buttonClass()}>
                  {t("older")}
                </Link>
              )}
            </div>
          </nav>
        </Panel>
      )}
    </>
  );
}
