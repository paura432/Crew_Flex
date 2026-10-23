import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/Button";
import type { BadgeInput } from "@/domain/badges";
import type { Completeness } from "@/domain/professional";
import { COMPLETENESS_HREF } from "../completeness";
import { initials } from "../identity";
import { ProfessionalMedals } from "./ProfessionalMedals";
import { ProfileAvatar } from "./ProfileAvatar";
import { ProfileStatusDialog } from "./ProfileStatusDialog";

/**
 * v1.8 `.personal-passport` hero of «Mi espacio» (area 50 #2, N-15/N-18/N-23, T-143): the avatar (photo
 * kept in this browser or initials), name, base and experience, the medals, «Editar perfil», «Estado de
 * mi perfil ↗» (dialog), the progress below 100 % and the two v1.8 counters. A counter whose read
 * failed shows «—».
 */
export async function ProfessionalHero({
  userId,
  name,
  baseLocation,
  yearsExperience,
  medals,
  today,
  completeness,
  compatible,
  confirmed,
}: {
  userId: string;
  name: string;
  baseLocation: string | null;
  yearsExperience: number | null;
  medals: BadgeInput;
  /** `YYYY-MM-DD` (UTC). */
  today: string;
  completeness: Completeness;
  compatible: number | null;
  confirmed: number | null;
}) {
  const [t, tIdentity, tOverview, tItem, tActivity] = await Promise.all([
    getTranslations("profileHero"),
    getTranslations("professional.identity"),
    getTranslations("professional.overview"),
    getTranslations("professional.item"),
    getTranslations("professional.activity"),
  ]);
  const { percent, items, missing } = completeness;
  const stats = [
    { key: "compatible", value: compatible, label: tActivity("compatible") },
    { key: "confirmed", value: confirmed, label: tActivity("confirmed") },
  ];
  return (
    <section
      aria-label={tIdentity("label")}
      className="rounded-2xl bg-hero p-5 text-white shadow-sm sm:p-6"
    >
      <div className="flex items-start gap-4 sm:gap-5">
        <ProfileAvatar userId={userId} initials={initials(name)} />
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-bold tracking-tight break-words sm:text-[28px]">{name}</p>
          <p className="text-sm text-hero-text">
            {baseLocation?.trim() || tIdentity("noBase")}
            {yearsExperience !== null &&
              yearsExperience > 0 &&
              ` · ${tIdentity("experience", { count: yearsExperience })}`}
          </p>
          <ProfessionalMedals input={medals} today={today} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2.5">
        <ButtonLink href="/app/professional/profile">{tIdentity("edit")}</ButtonLink>
        <ProfileStatusDialog
          trigger={t("status")}
          title={t("statusTitle", { percent })}
          intro={t("statusIntro")}
          items={items.map((item) => ({
            key: item,
            label: tItem(item),
            done: !missing.includes(item),
            href: COMPLETENESS_HREF[item],
          }))}
          labels={{
            complete: tOverview("doIt"),
            done: tOverview("itemDone"),
            pending: tOverview("itemPending"),
            allDone: t("allDone"),
            close: t("close"),
          }}
        />
      </div>
      {/* v1.8 hides the progress from 95 %; with ten items that is 100 %. */}
      {percent < 100 && (
        <div className="mt-5 border-y border-white/20 py-4">
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <p className="font-semibold">{tOverview("progressLead", { percent })}</p>
            <p className="text-hero-text">{tOverview("toComplete", { count: missing.length })}</p>
          </div>
          <progress
            max={100}
            value={percent}
            aria-label={tOverview("progressLabel", { percent })}
            // v1.8 `.profile-progress progress`: mint value on a translucent white track.
            className="mt-3 block h-2 w-full appearance-none overflow-hidden rounded-full bg-white/15 [&::-moz-progress-bar]:bg-hero-bar [&::-webkit-progress-bar]:bg-white/15 [&::-webkit-progress-value]:bg-hero-bar"
          />
          <p className="mt-2 text-xs text-hero-text">{tOverview("progressNote")}</p>
        </div>
      )}
      <dl className="mt-5 grid grid-cols-2 gap-6">
        {stats.map((stat) => (
          <div key={stat.key} className="flex flex-col-reverse">
            <dt className="mt-1 text-xs text-hero-text">{stat.label}</dt>
            <dd className="text-3xl leading-tight font-bold tabular-nums">{stat.value ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
