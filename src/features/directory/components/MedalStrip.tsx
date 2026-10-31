import { getTranslations } from "next-intl/server";
import { medals, splitMedals, type Medal } from "@/domain/directory";
import { categoryKey } from "@/domain/passport";
import type { DirectoryCandidate } from "@/types/api";

const tone: Record<Medal["kind"], string> = {
  experience: "border-[#edd8a7] bg-[#fff7e4] text-[#916413]",
  category: "border-navy/30 bg-navy text-white",
  aircraft: "border-line bg-canvas text-ink",
};

/**
 * v1.8 `MedalStrip` (MKT-02 #3): declared years, the main category, the first aircraft and a «+N» disclosure
 * for the rest; `all` shows everything (the profile dialog) with v1.8's note. Declarations only: never a
 * qualification, never a learning medal (those stay the professional's own, T-156).
 */
export async function MedalStrip({
  candidate,
  all = false,
}: {
  candidate: DirectoryCandidate;
  all?: boolean;
}) {
  const [t, tCategory] = await Promise.all([
    getTranslations("directory.medals"),
    getTranslations("passport.categories"),
  ]);
  const items = medals({ yearsExperience: candidate.yearsExperience, ...candidate.declarations });
  if (items.length === 0) return null;
  const { shown, more } = all ? { shown: items, more: [] } : splitMedals(items);
  const label = (m: Medal) =>
    m.kind === "experience"
      ? t("experience", { count: m.years })
      : m.kind === "category"
        ? t("category", { category: tCategory(categoryKey(m.category)) })
        : t("aircraft", { aircraft: m.aircraft });
  const medal = (m: Medal, index: number) => (
    // react-doctor-disable-next-line no-array-index-as-key -- derived static list; kinds can repeat and the order is fixed
    <li
      key={`${m.kind}-${index}`}
      title={label(m)}
      className={`inline-flex min-h-7 items-center gap-1 rounded-md border px-2 text-xs font-semibold ${tone[m.kind]}`}
    >
      <span className="sr-only">{label(m)}</span>
      <span aria-hidden>
        {m.kind === "experience" ? (
          <>
            <b className="text-sm tabular-nums">{m.years}</b> {t("yearsUnit")}
          </>
        ) : m.kind === "category" ? (
          tCategory(categoryKey(m.category))
        ) : (
          m.aircraft
        )}
      </span>
    </li>
  );
  return (
    <div>
      <ul aria-label={t("label")} className="mt-1 flex flex-wrap items-center gap-1.5">
        {shown.map(medal)}
      </ul>
      {more.length > 0 && (
        <details className="mt-1.5">
          <summary
            aria-label={t("more", { count: more.length })}
            className="inline-flex min-h-7 cursor-pointer list-none items-center rounded-md border border-line bg-white px-2 text-xs font-semibold text-muted pointer-coarse:min-h-11 [&::-webkit-details-marker]:hidden"
          >
            +{more.length}
          </summary>
          <ul aria-label={t("label")} className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {more.map((m, i) => medal(m, shown.length + i))}
          </ul>
        </details>
      )}
      {all && <p className="mt-2 text-xs text-muted">{t("note")}</p>}
    </div>
  );
}
