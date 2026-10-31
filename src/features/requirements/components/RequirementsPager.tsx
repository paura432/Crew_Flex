import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button-class";

/** `base` keeps a view's own query (the archived list, T-64). */
const href = (page: number, base?: string) =>
  base
    ? `${base}${page > 1 ? `&page=${page}` : ""}`
    : `/app/organization/requirements${page > 1 ? `?page=${page}` : ""}`;

/** «{total} necesidades · página {p} de {n}» with previous / next links (V1.8 lists paged by 20). */
export async function RequirementsPager({
  page,
  pages,
  total,
  base,
}: {
  page: number;
  pages: number;
  total: number;
  base?: string;
}) {
  const t = await getTranslations("organization.requirements");
  return (
    <nav
      aria-label={t("pagination")}
      className="mt-6 flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-sm text-muted" role="status">
        {t("pageInfo", { total, page: Math.min(page, pages), pages })}
      </p>
      {pages > 1 && (
        <div className="flex gap-2">
          {page > 1 && (
            <Link href={href(Math.min(page - 1, pages), base)} className={buttonClass()}>
              {t("previous")}
            </Link>
          )}
          {page < pages && (
            <Link href={href(page + 1, base)} className={buttonClass()}>
              {t("next")}
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
