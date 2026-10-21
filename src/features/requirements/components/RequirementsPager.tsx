import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";

const href = (page: number) => `/app/organization/requirements${page > 1 ? `?page=${page}` : ""}`;

/** «{total} necesidades · página {p} de {n}» with previous / next links (V1.8 lists paged by 20). */
export async function RequirementsPager({
  page,
  pages,
  total,
}: {
  page: number;
  pages: number;
  total: number;
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
            <Link href={href(Math.min(page - 1, pages))} className={buttonClass()}>
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
  );
}
