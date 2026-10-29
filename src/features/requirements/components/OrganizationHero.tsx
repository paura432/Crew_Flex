import { getTranslations } from "next-intl/server";
import { PLANE_PATH } from "@/components/layout/BrandMark";
import { ButtonLink } from "@/components/ui/Button";

/**
 * v1.8 `.dashboard-hero` of the organization's «Resumen» (`Dashboard.jsx:24`, `styles/v11.css`; ORG-01 #7,
 * SHOT-05 #2; T-167): the two chips, «El técnico adecuado. Las fechas adecuadas.», the sentence and
 * «Explorar candidatos →» to the directory (BR-28, admin/manager — the directory refuses a plain member),
 * with the decorative «CF / AVIATION» mark from 981 px as v1.8 (`@media(max-width:980px)` hides it). Static copy: no figure here is computed.
 */
export async function OrganizationHero({ canManage }: { canManage: boolean }) {
  const t = await getTranslations("orgHome.hero");
  return (
    <section
      aria-labelledby="org-hero-title"
      className="relative flex items-center justify-between gap-6 overflow-hidden rounded-2xl bg-navy p-6 text-white sm:px-9 sm:py-8"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-60 -right-32 size-[550px] rounded-full border border-white/10"
      />
      <div className="relative min-w-0">
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-md bg-warn-bg px-2 py-0.5 text-warn">{t("brand")}</span>
          <span className="rounded-md bg-white/10 px-2 py-0.5 text-[#acc3d9]">{t("tag")}</span>
        </div>
        <h2
          id="org-hero-title"
          className="mt-4 mb-2 max-w-3xl text-2xl font-bold tracking-tight sm:text-[29px]"
        >
          {t("title")}
        </h2>
        <p className="max-w-xl text-sm leading-relaxed text-[#a9bfd2]">{t("body")}</p>
        {canManage && (
          <ButtonLink href="/app/organization/candidates" variant="inverse" className="mt-5">
            {t("cta")} <span aria-hidden>→</span>
          </ButtonLink>
        )}
      </div>
      {/* v1.8 hides the mark up to 600 px; the plane is the brand's own path (`<Plane size={80} strokeWidth={1} />`). */}
      <div
        aria-hidden
        className="relative hidden shrink-0 -rotate-[8deg] flex-col items-center gap-3 px-6 py-4 min-[981px]:flex"
      >
        <svg
          viewBox="0 0 24 24"
          width={80}
          height={80}
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[#80a4c2]/30"
        >
          <path d={PLANE_PATH} />
        </svg>
        <span className="text-xs tracking-[0.2em] text-[#7e9bb2]">{t("mark")}</span>
      </div>
    </section>
  );
}
