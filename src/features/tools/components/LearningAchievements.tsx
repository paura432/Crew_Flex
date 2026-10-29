"use client";

// «Logros de aprendizaje» in Mi espacio (v1.8 `Badges.jsx`, learning view): the challenge medals and
// streaks of the signed-in user, read from this browser. Never a qualification, never shared.
import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { completedDays, streak } from "@/domain/learning";
import { useLearningProgress } from "../learning/useLearningProgress";
import { LearningMedals } from "./LearningMedals";

export function LearningAchievements({ userId }: { userId: string }) {
  const t = useTranslations("tools.daily");
  const tCommon = useTranslations("common");
  const { history, today } = useLearningProgress(userId);
  const stats = history && today ? streak(completedDays(history), today) : null;
  return (
    <Panel
      title={t("achievementsTitle")}
      actions={<ButtonLink href="/app/tools/daily">{t("openChallenge")}</ButtonLink>}
    >
      <p className="text-sm text-muted">{t("achievementsNote")}</p>
      {stats ? (
        <>
          <LearningMedals best={stats.best} />
          <p className="text-sm">{t("achievementsStats", { ...stats })}</p>
        </>
      ) : (
        <p role="status" className="my-4 text-sm text-muted">
          {tCommon("loading")}
        </p>
      )}
      <p className="mt-3 text-xs text-muted">{t("badgesNote")}</p>
    </Panel>
  );
}
