import { getTranslations } from "next-intl/server";
import { badges, type BadgeInput } from "@/domain/badges";
import { initials } from "../identity";
import { ProfessionalMedals } from "./ProfessionalMedals";
import { AvatarPhotoControls, ProfileAvatar } from "./ProfileAvatar";

/**
 * v1.8 `Badges` «Pasaporte visual» on the passport page (N-15 row 9, N-23): the avatar with its photo
 * controls (this browser only), every medal and the v1.8 footnote; an empty passport says what to add.
 */
export async function PassportVisual({
  userId,
  name,
  medals,
  today,
}: {
  userId: string;
  name: string;
  medals: BadgeInput;
  /** `YYYY-MM-DD` (UTC). */
  today: string;
}) {
  const [t, tPhoto] = await Promise.all([
    getTranslations("badges.passport"),
    getTranslations("profileHero.photo"),
  ]);
  const empty = badges(medals, today).length === 0;
  return (
    <section
      aria-label={t("label")}
      className="mb-6 rounded-xl border border-line bg-white p-5 sm:p-6"
    >
      <p className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">{t("kicker")}</p>
      <div className="mt-3 flex flex-wrap items-start gap-4">
        <ProfileAvatar userId={userId} initials={initials(name)} size="md" />
        <div className="min-w-0 flex-1 basis-48 space-y-2">
          <p className="text-lg font-semibold break-words">{name}</p>
          <AvatarPhotoControls
            userId={userId}
            labels={{
              add: tPhoto("add"),
              change: tPhoto("change"),
              saving: tPhoto("saving"),
              remove: tPhoto("remove"),
              note: tPhoto("note"),
              invalid: tPhoto("invalid"),
              saveFailed: tPhoto("saveFailed"),
              removeFailed: tPhoto("removeFailed"),
            }}
          />
        </div>
      </div>
      {empty ? (
        <p className="mt-3 text-sm text-muted">{t("empty")}</p>
      ) : (
        <ProfessionalMedals input={medals} today={today} all />
      )}
      <p className="mt-2 text-xs text-muted">{t("footnote")}</p>
    </section>
  );
}
