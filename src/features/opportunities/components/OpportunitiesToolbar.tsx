import { getTranslations } from "next-intl/server";
import { buttonClass } from "@/components/ui/button-class";
import { controlClass } from "@/components/ui/Field";
import { FilterPill } from "@/components/ui/FilterPill";
import { Pager } from "@/components/ui/Pager";
import { OPPORTUNITIES_PAGE_SIZE } from "@/lib/validation/applications";
import type { OPPORTUNITY_PILLS } from "../view";
import { activePill, opportunitiesHref, type OpportunityFilters } from "../view";

/**
 * v1.8 «Buscar oportunidad» + the filter pills, as a native GET form and links (works without
 * JavaScript). Shared by the professional's «Oportunidades» and the organization's «Ofertas en la red».
 */
export async function OpportunitiesToolbar({
  filters,
  base,
  pills,
}: {
  filters: OpportunityFilters;
  base: string;
  pills: readonly (typeof OPPORTUNITY_PILLS)[number][];
}) {
  const t = await getTranslations("opportunities");
  const active = activePill(filters);
  return (
    <>
      <form action={base} className="mb-4 flex flex-wrap items-end gap-2" role="search">
        <label className="min-w-0 flex-1 basis-60 text-sm font-semibold">
          {t("searchLabel")}
          <input
            name="q"
            type="search"
            defaultValue={filters.q ?? ""}
            placeholder={t("searchPlaceholder")}
            maxLength={80}
            className={`${controlClass} mt-1`}
          />
        </label>
        {filters.urgency && <input type="hidden" name="urgency" value={filters.urgency} />}
        {filters.eligible && <input type="hidden" name="eligible" value={filters.eligible} />}
        <button type="submit" className={buttonClass()}>
          {t("searchSubmit")}
        </button>
      </form>
      <nav aria-label={t("filtersLabel")} className="mb-6 flex flex-wrap gap-2">
        {pills.map((pill) => (
          <FilterPill
            key={pill.key}
            href={opportunitiesHref(filters, pill.patch, base)}
            current={active === pill.key}
          >
            {t(`filter.${pill.key}`)}
          </FilterPill>
        ))}
      </nav>
    </>
  );
}

/** «{n} oportunidades · página p de P» + «Anterior»/«Siguiente», and the cap note when it applies. */
export async function OpportunitiesPager({
  filters,
  base,
  total,
  capped,
}: {
  filters: OpportunityFilters;
  base: string;
  total: number;
  capped: number | null;
}) {
  const t = await getTranslations("opportunities");
  const pages = Math.max(1, Math.ceil(total / OPPORTUNITIES_PAGE_SIZE));
  const page = Math.min(filters.page, pages);
  return (
    <Pager
      label={t("pagination")}
      info={t("pageInfo", { total, page, pages })}
      previous={
        page > 1
          ? { href: opportunitiesHref(filters, { page: page - 1 }, base), label: t("previous") }
          : null
      }
      next={
        page < pages
          ? { href: opportunitiesHref(filters, { page: page + 1 }, base), label: t("next") }
          : null
      }
      note={capped !== null ? t("cappedNote", { cap: capped }) : undefined}
    />
  );
}
