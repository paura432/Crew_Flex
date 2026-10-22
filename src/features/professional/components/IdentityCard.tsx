import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/Button";
import { initials } from "../identity";

/** V1.8 identity card: initials avatar, name, base and declared experience, link to the passport. */
export async function IdentityCard({
  name,
  baseLocation,
  yearsExperience,
}: {
  name: string;
  baseLocation: string | null;
  yearsExperience: number | null;
}) {
  const t = await getTranslations("professional.identity");
  const base = baseLocation?.trim() || t("noBase");
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
      </div>
      <ButtonLink href="/app/professional/profile">{t("edit")}</ButtonLink>
    </section>
  );
}
