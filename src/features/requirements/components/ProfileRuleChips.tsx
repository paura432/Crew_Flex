import { useTranslations } from "next-intl";
import { categoryKey } from "@/domain/passport";
import type { RequirementProfileRules } from "@/domain/work-requirement";

/** Whether a requirement states any v1.8 profile rule beyond the country (BR-3.8–3.13). */
const hasProfileRules = (r: RequirementProfileRules) =>
  Boolean(
    r.category ||
    r.aircraft?.length ||
    r.requiresTypeRating ||
    r.engines?.length ||
    (r.minYears !== undefined && r.minYears !== null) ||
    r.requiredSkills?.length,
  );

/**
 * The v1.8 profile requirements a need states («Requisitos del perfil», P10): one chip per rule, worded as the
 * candidate card's checklist (`matching.profile.*`), so the organization reads what it asked for exactly as the
 * engine checks it (BR-3.8–3.13). Renders nothing when no rule is stated. Works in server and client components.
 */
export function ProfileRuleChips({ rules }: { rules: RequirementProfileRules }) {
  const t = useTranslations("matching");
  const tCategory = useTranslations("passport.categories");
  const tSkill = useTranslations("passport.skills");
  if (!hasProfileRules(rules)) return null;
  const category = rules.category ? tCategory(categoryKey(rules.category)) : "";
  const items: string[] = [];
  if (rules.category) items.push(t("profile.category", { category }));
  if (rules.aircraft?.length)
    items.push(t("profile.aircraft", { list: rules.aircraft.join(" / ") }));
  if (rules.requiresTypeRating)
    items.push(t("profile.typeRating", { category, list: (rules.aircraft ?? []).join(" / ") }));
  if (rules.engines?.length) items.push(t("profile.engine", { list: rules.engines.join(" / ") }));
  if (rules.minYears !== undefined && rules.minYears !== null)
    items.push(t("profile.minYears", { count: rules.minYears }));
  for (const skill of rules.requiredSkills ?? [])
    items.push(t("profile.skill", { skill: tSkill(skill) }));
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">
        {t("profileTitle")}
      </p>
      <ul className="mt-1 flex flex-wrap gap-2 text-sm">
        {items.map((item) => (
          <li
            key={item}
            className="rounded-md border border-navy/30 bg-navy/5 px-2 py-0.5 font-medium break-words"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
