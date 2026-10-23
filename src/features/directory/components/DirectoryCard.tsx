import { getLocale, getTranslations } from "next-intl/server";
import { StatusChip } from "@/components/ui/StatusChip";
import { avatarInitials } from "@/domain/directory";
import { categoryKey } from "@/domain/passport";
import { countryName } from "@/features/organizations/countries";
import type { Locale } from "@/i18n/config";
import type { DirectoryCandidate } from "@/types/api";
import { BlockCandidateForm } from "./BlockCandidateForm";
import { MedalStrip } from "./MedalStrip";
import { ProfileDialog } from "./ProfileDialog";

/** v1.8 `Avatar`: initials, or «CF» with «Identidad protegida» while the professional is anonymous. */
function Avatar({ name, label, size }: { name: string | null; label: string; size: "md" | "lg" }) {
  return (
    <span
      role="img"
      aria-label={label}
      className={`flex shrink-0 items-center justify-center rounded-full bg-navy font-bold text-white ${
        size === "lg" ? "size-14 text-lg" : "size-12 text-base"
      }`}
    >
      {avatarInitials(name)}
    </span>
  );
}

/**
 * One directory row (v1.8 `candidate-v17`, MKT-02 #2, #3, #9, #13, #19): identity (pseudonym unless `open`),
 * base, medals; the expanded block (experience, English, aircraft, work countries, the restrictions flag) and
 * the «Perfil profesional» dialog with the same passport-card data. Never contact, employer, rate, documents,
 * qualifications or restriction text — the function does not return them (T-153).
 */
export async function DirectoryCard({
  candidate,
  blocked,
}: {
  candidate: DirectoryCandidate;
  blocked: boolean;
}) {
  const [t, tCategory, locale] = await Promise.all([
    getTranslations("directory"),
    getTranslations("passport.categories"),
    getLocale() as Promise<Locale>,
  ]);
  const d = candidate.declarations;
  const title = candidate.displayName ?? t("card.anonymous", { ref: candidate.ref });
  const avatarLabel = candidate.displayName
    ? t("card.avatarOf", { name: candidate.displayName })
    : t("card.protectedIdentity");
  const years = candidate.yearsExperience;
  const experience =
    years !== null ? t("card.experience", { count: years }) : t("card.experienceUnknown");
  const english = d.englishLevel
    ? t("card.english", { level: d.englishLevel })
    : t("card.englishNone");
  const aircraft =
    d.aircraft.length > 0
      ? t("card.aircraft", { list: d.aircraft.join(" · ") })
      : t("card.aircraftNone");
  const countries =
    d.workPermits.length > 0
      ? t("card.countries", { list: d.workPermits.map((c) => countryName(locale, c)).join(" · ") })
      : t("card.countriesNone");
  const categories =
    d.categories.length > 0
      ? t("card.categories", {
          list: d.categories.map((c) => tCategory(categoryKey(c))).join(" · "),
        })
      : null;
  const facts = (
    <>
      <p>
        {experience} · {english}
      </p>
      <p className="break-words">{aircraft}</p>
      <p className="break-words">{countries}</p>
      {categories && <p className="break-words">{categories}</p>}
      {d.hasRestrictions && <StatusChip tone="warn">{t("card.restrictions")}</StatusChip>}
    </>
  );

  return (
    <article aria-label={title} className="rounded-xl border border-line bg-white p-5">
      <header className="flex items-start gap-3">
        <Avatar name={candidate.displayName} label={avatarLabel} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold break-words">{title}</h3>
          <p className="text-sm text-muted">{candidate.baseLocation ?? t("card.baseNotShared")}</p>
          <MedalStrip candidate={candidate} />
        </div>
      </header>
      {/* «Ampliada» (MKT-01 #23): shown by the view toggle, server-rendered either way. */}
      <div className="mt-3 hidden space-y-1 text-sm group-data-[view=expanded]:block">{facts}</div>
      <footer className="mt-4 flex flex-wrap items-start gap-2">
        <ProfileDialog
          title={t("profile.title")}
          openLabel={t("card.openProfile")}
          closeLabel={t("profile.close")}
        >
          <div className="flex items-center gap-4">
            <Avatar name={candidate.displayName} label={avatarLabel} size="lg" />
            <div className="min-w-0">
              <p className="text-lg font-semibold break-words">{title}</p>
              <p className="text-sm text-muted">
                {years !== null && years > 0
                  ? t("profile.identity", {
                      base: candidate.baseLocation ?? t("profile.basePending"),
                      count: years,
                    })
                  : (candidate.baseLocation ?? t("profile.basePending"))}
              </p>
            </div>
          </div>
          <MedalStrip candidate={candidate} all />
          <h3 className="mt-5 mb-2 text-base font-semibold">{t("profile.sectionExperience")}</h3>
          <div className="space-y-1 text-sm">{facts}</div>
          <p className="mt-5 text-xs text-muted">{t("profile.privacy")}</p>
          <p className="mt-1 text-xs text-muted">{t("profile.learningNote")}</p>
        </ProfileDialog>
        <BlockCandidateForm candidateRef={candidate.ref} blocked={blocked} />
      </footer>
    </article>
  );
}
