"use client";

// Learning medals by best streak (v1.8 `DailyLearning.jsx` «Tu colección de constancia» and
// `Badges.jsx` «Logros de aprendizaje»), one set of names and states for both (✗ TOOL-08 #2).
import { useTranslations } from "next-intl";
import { LEARNING_MEDALS } from "@/domain/learning";
import { AwardIcon } from "./icons";

export function LearningMedals({ best }: { best: number }) {
  const t = useTranslations("tools.daily");
  return (
    <ul className="my-4 flex flex-wrap gap-3">
      {LEARNING_MEDALS.map((medal) => {
        const earned = best >= medal.days;
        return (
          <li
            key={medal.id}
            className={`flex max-w-full min-w-0 flex-[1_1_140px] items-center gap-3 rounded-xl border px-4 py-3 sm:flex-none ${
              earned
                ? "border-[#edd8a7] bg-[#fff7e4] text-[#916413]"
                : "border-dashed border-[#d5e2eb] bg-[#f0f3f5] text-muted"
            }`}
          >
            <AwardIcon size={24} className="shrink-0" />
            <span className="min-w-0 [overflow-wrap:anywhere]">
              <b className="block text-sm">{t(`medal.${medal.id}`)}</b>
              <span className="mt-1 block text-xs">
                {earned ? t("medalEarned") : t("medalLocked", { count: medal.days })}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
