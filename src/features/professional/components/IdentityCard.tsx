import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/Button";
import { categoryKey, type Aircraft, type ProfessionalCategory } from "@/domain/passport";
import { initials } from "../identity";

/**
 * V1.8 identity card: initials avatar, name, base and declared experience, link to the passport.
 * The v1.8 medal strip shows the main category and the declared aircraft; until the medals exist
 * (N-15) they are one plain line under the base.
 */
export async function IdentityCard({
  name,
  baseLocation,
  yearsExperience,
  primaryCategory,
  aircraft,
}: {
  name: string;
  baseLocation: string | null;
  yearsExperience: number | null;
  primaryCategory: ProfessionalCategory | null;
  aircraft: readonly Aircraft[];
}) {
  const [t, tCategory] = await Promise.all([
    getTranslations("professional.identity"),
    getTranslations("passport.categories"),
  ]);
  const base = baseLocation?.trim() || t("noBase");
  const declared = [
    ...(primaryCategory ? [tCategory(categoryKey(primaryCategory))] : []),
    ...aircraft,
  ];
  return (
    <section
      aria-label={t("label")}
      className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-white p-5"
    >
      <span
        aria-hidden
        className="flex size-14 shrink-0 items-center justify-center rounded-full bg-navy text-lg font-bold text-white"
      >
        {initials(name)}
      </span>
      {/* X-17: a 12rem basis wraps «Editar perfil» under the text on phones instead of squeezing it. */}
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-lg font-semibold break-words">{name}</p>
        <p className="text-sm text-muted">
          {base}
          {yearsExperience !== null &&
            yearsExperience > 0 &&
            ` · ${t("experience", { count: yearsExperience })}`}
        </p>
        {declared.length > 0 && (
          <p className="text-sm font-medium break-words">
            <span className="sr-only">{t("declared")} </span>
            {declared.join(" · ")}
          </p>
        )}
      </div>
      <ButtonLink href="/app/professional/profile">{t("edit")}</ButtonLink>
    </section>
  );
}
