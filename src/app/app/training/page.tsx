import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { Button, ButtonLink } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pager } from "@/components/ui/Pager";
import { StateMessage } from "@/components/ui/StateMessage";
import { CATALOG_PAGE_SIZE, TRAINING_FAMILIES, TRAINING_MODES } from "@/domain/training";
import { getCatalog } from "@/features/training/api";
import { EditionSummary } from "@/features/training/components/TrainingViews";
import {
  catalogHref,
  catalogQuery,
  parseCatalogFilters,
  REQUESTS_PATH,
  TRAINING_PATH,
} from "@/features/training/view";
import { isTrainingEnabled } from "@/server/feature-flags";
import { requireSessionActor } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("training") };
}

/** V19-003…006: published courses only (course + reviewed provider + published edition), 12 per page on the server. */
export default async function TrainingCatalogPage({ searchParams }: PageProps<"/app/training">) {
  if (!(await isTrainingEnabled())) notFound();
  const [search, , t, tRoot] = await Promise.all([
    searchParams,
    requireSessionActor(),
    getTranslations("training.catalog"),
    getTranslations("training"),
  ]);
  const filters = parseCatalogFilters(search);
  const result = await getCatalog(catalogQuery(filters));
  const pages = result.ok ? Math.max(1, Math.ceil(result.data.total / CATALOG_PAGE_SIZE)) : 1;
  if (result.ok && result.data.total > 0 && filters.page > pages)
    redirect(catalogHref(filters, { page: pages }));

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={<ButtonLink href={REQUESTS_PATH}>{t("myRequests")}</ButtonLink>}
      />
      <form
        method="get"
        action={TRAINING_PATH}
        className="mb-6 grid gap-3 rounded-lg border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">
          {t("search")}
          <input
            name="q"
            defaultValue={filters.q}
            placeholder={t("searchPlaceholder")}
            className={controlClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t("family")}
          <select name="family" defaultValue={filters.family} className={controlClass}>
            <option value="">{t("any")}</option>
            {TRAINING_FAMILIES.map((f) => (
              <option key={f} value={f}>
                {tRoot(`family.${f}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t("mode")}
          <select name="mode" defaultValue={filters.mode} className={controlClass}>
            <option value="">{t("any")}</option>
            {TRAINING_MODES.map((m) => (
              <option key={m} value={m}>
                {tRoot(`mode.${m}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t("language")}
          <input name="language" defaultValue={filters.language} className={controlClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t("country")}
          <input name="country" defaultValue={filters.country} className={controlClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t("from")}
          <input type="date" name="from" defaultValue={filters.from} className={controlClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t("to")}
          <input type="date" name="to" defaultValue={filters.to} className={controlClass} />
        </label>
        <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
          <Button type="submit" variant="primary">
            {t("apply")}
          </Button>
          <ButtonLink href={TRAINING_PATH} variant="ghost">
            {t("clear")}
          </ButtonLink>
        </div>
      </form>

      {!result.ok ? (
        <ApiErrorState error={result.error} requestId={result.requestId} />
      ) : result.data.courses.length === 0 ? (
        <StateMessage title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted" role="status">
            {t("count", { count: result.data.total })}
          </p>
          <ul className="grid gap-4 md:grid-cols-2">
            {result.data.courses.map((c) => (
              <li key={c.id} className="space-y-3 rounded-lg border border-line bg-white p-4">
                <p className="text-xs font-semibold text-muted">{tRoot(`family.${c.family}`)}</p>
                <h2 className="text-lg font-semibold">
                  <Link
                    href={`${TRAINING_PATH}/${c.id}`}
                    className="text-blue hover:underline pointer-coarse:min-h-11"
                  >
                    {c.title}
                  </Link>
                </h2>
                <p className="text-sm text-muted">
                  {c.providerName} · {c.language}
                  {c.aircraft ? ` · ${c.aircraft}` : ""}
                </p>
                {c.editions[0] && <EditionSummary edition={c.editions[0]} />}
              </li>
            ))}
          </ul>
          <Pager
            label={t("pagerLabel")}
            info={t("pageInfo", { page: filters.page, pages })}
            previous={
              filters.page > 1
                ? { href: catalogHref(filters, { page: filters.page - 1 }), label: t("previous") }
                : null
            }
            next={
              filters.page < pages
                ? { href: catalogHref(filters, { page: filters.page + 1 }), label: t("next") }
                : null
            }
          />
        </>
      )}
    </>
  );
}
