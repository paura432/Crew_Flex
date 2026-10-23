import { getTranslations } from "next-intl/server";
import { aircraftShort, badges, primaryBadges, type Badge, type BadgeInput } from "@/domain/badges";
import { categoryKey } from "@/domain/passport";
import { MedalStrip, type MedalView } from "./MedalStrip";

/**
 * The v1.8 medals of the caller's own passport (N-15, T-143), translated here; the strip only toggles.
 * Shown to the professional only (home and passport): the restriction text is their own.
 */
export async function ProfessionalMedals({
  input,
  today,
  all = false,
}: {
  input: BadgeInput;
  /** `YYYY-MM-DD` (UTC). */
  today: string;
  all?: boolean;
}) {
  const [t, tCategory] = await Promise.all([
    getTranslations("badges"),
    getTranslations("passport.categories"),
  ]);
  const list = badges(input, today);
  const { primary, others } = primaryBadges(list);

  const view = (b: Badge): MedalView => {
    const status = t(`status.${b.status}`);
    const base = { id: b.id, kind: b.kind, status, expired: b.status === "reviewValidity" };
    if (b.kind === "experience") {
      const years = b.years ?? 0;
      return {
        ...base,
        short: String(years),
        unit: years === 1 ? t("yearUnit") : t("yearsUnit"),
        label: t("years", { count: years }),
        detail: t("detail.experience"),
      };
    }
    if (b.kind === "aircraft") {
      return {
        ...base,
        short: aircraftShort(b.aircraft!),
        label: `${b.aircraft} · ${b.ratingCategory}`,
        detail:
          b.status === "reviewValidity"
            ? t("detail.reviewValidity")
            : (b.restrictions ?? t("detail.typeDeclared")),
      };
    }
    const label = tCategory(categoryKey(b.category!));
    return {
      ...base,
      short: b.category === "SHEET-METAL" ? "SM" : label,
      label,
      detail:
        b.status === "verified"
          ? t("detail.verified")
          : b.fromSkill
            ? t("detail.specialty")
            : t("detail.category"),
    };
  };

  return (
    <MedalStrip
      medals={list.map(view)}
      primaryIds={primary.map((b) => b.id)}
      all={all}
      labels={{
        strip: t("stripLabel"),
        more: t("more", { count: others.length }),
        less: t("less"),
        close: t("close"),
        footnote: t("footnote"),
      }}
    />
  );
}
