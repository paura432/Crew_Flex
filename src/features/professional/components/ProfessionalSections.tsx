import { getTranslations } from "next-intl/server";
import type { TechnicianProfileRow } from "@/types/database";

export async function ProfileFacts({ profile }: { profile: TechnicianProfileRow }) {
  const [t, tDomain] = await Promise.all([
    getTranslations("professional.facts"),
    getTranslations("domain"),
  ]);
  const notSet = (await getTranslations("common"))("notSet");
  const facts: [string, string][] = [
    [t("base"), profile.base_location ?? notSet],
    [t("mobility"), tDomain(`mobility.${profile.mobility}`)],
    [
      t("experience"),
      profile.years_experience === null ? notSet : t("years", { count: profile.years_experience }),
    ],
    [t("status"), tDomain(`technicianStatus.${profile.current_status}`)],
    [t("visibility"), tDomain(`visibility.${profile.visibility}.label`)],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
      {facts.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
          <dd className="font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
