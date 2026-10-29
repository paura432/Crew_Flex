import { getLocale, getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/Button";
import { EXPIRY_TONE, StatusChip } from "@/components/ui/StatusChip";
import { documentExpiryState, REVIEW_WINDOW_DAYS } from "@/domain/documents";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import type { ReviewItem } from "../reviews";

/**
 * The rows of «Documentos y cursos próximos a revisar» (v1.8 `Badges.jsx:10`): the panel of «Mi espacio»
 * and the `<details>` of the passport's «Pasaporte visual» render the same list (`upcomingReviews`).
 */
export async function UpcomingReviews({
  items,
  failed,
  today,
}: {
  items: ReviewItem[];
  /** The wallet read failed: the list covers the qualifications only, and says so. */
  failed: boolean;
  /** `YYYY-MM-DD` (UTC). */
  today: string;
}) {
  const [t, locale] = await Promise.all([
    getTranslations("professional.overview"),
    getLocale() as Promise<Locale>,
  ]);
  return (
    <>
      {failed && (
        <p className="mb-3 text-sm text-danger" role="alert">
          {t("reviewError")}
        </p>
      )}
      {items.length === 0 ? (
        <p className="text-sm text-muted">{t("reviewNone", { days: REVIEW_WINDOW_DAYS })}</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {items.map((item) => {
            const expired = documentExpiryState(item.expiresAt, today) === "expired";
            return (
              <li key={item.key} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <span>
                  <span className="font-semibold">{item.title}</span> ·{" "}
                  <span className="tabular-nums">{formatDate(locale, item.expiresAt)}</span>
                </span>
                <span className="flex items-center gap-3">
                  <StatusChip tone={EXPIRY_TONE[expired ? "expired" : "soon"]}>
                    {expired ? t("reviewExpired") : t("reviewSoon", { days: REVIEW_WINDOW_DAYS })}
                  </StatusChip>
                  <ButtonLink href={item.href} aria-label={`${t("reviewOpen")} · ${item.title}`}>
                    {t("reviewOpen")}
                  </ButtonLink>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted">{t("reviewHint")}</p>
    </>
  );
}
