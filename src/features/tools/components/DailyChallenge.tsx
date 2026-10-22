"use client";

// Daily challenge (v1.8 `DailyLearning.jsx`): 5 or 10 questions a day, an explanation after each
// answer, streaks and medals. Selection, streaks and the stored format live in `src/domain/learning`
// (BR-16); progress stays in this browser for the signed-in user (`useLearningProgress`).
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { LoadingState } from "@/components/ui/StateMessage";
import { Metric } from "@/components/ui/Metric";
import {
  addDays,
  CHALLENGE_SIZES,
  completedDays,
  dailyQuestions,
  isComplete,
  streak,
  withOptions,
  type ChallengeSize,
  type LearningHistory,
} from "@/domain/learning";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import { QUESTIONS, QUIZ_GROUPS, questionsById } from "../learning/questions";
import { currentLearningDay, useLearningProgress } from "../learning/useLearningProgress";
import { AwardIcon, BookOpenIcon } from "./icons";
import { LearningMedals } from "./LearningMedals";
import { Footnote, PressedGroup, SectionHead, ToolPanel, toolButtonClass } from "./parts";

export function DailyChallenge({ userId }: { userId: string }) {
  const t = useTranslations("tools.daily");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const { history, today, save } = useLearningProgress(userId);
  const [size, setSize] = useState<ChallengeSize>(5);
  const [selected, setSelected] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const answered = useRef(false);

  const record = today && history ? history[today] : undefined;
  const stored = record ? questionsById(record.ids) : null;
  const questions =
    record && stored && today ? stored.map((q) => withOptions(QUESTIONS, q, today)) : null;
  const answers = questions ? record!.answers : [];
  const index = answers.length;

  // After an answer, move focus to the next question (or to «Challenge completed»).
  useEffect(() => {
    if (!answered.current) return;
    answered.current = false;
    heading.current?.focus();
  }, [index]);

  if (history === null || today === null) return <LoadingState label={tCommon("loading")} />;

  const complete = questions !== null && index === questions.length;
  const current = questions && !complete ? questions[index]! : null;
  const last = questions && !complete && index > 0 ? questions[index - 1]! : null;
  const stats = streak(completedDays(history), today);
  const yesterday = history[addDays(today, -1)];
  const unfinished = !questions && yesterday && !isComplete(yesterday);

  function persist(next: LearningHistory) {
    const ok = save(next);
    setSaveFailed(!ok);
    return ok;
  }

  function start() {
    const ids = dailyQuestions(QUESTIONS, QUIZ_GROUPS, today!, size).map((q) => q.id);
    persist({ ...history, [today!]: { ids, answers: [] } });
  }

  function confirm() {
    // The day changed while the question was open: the answer belongs to no day. The re-render shows
    // today's start screen with the «left unfinished» notice (v1.8 dropped it silently, ✗ TOOL-07 #8).
    if (currentLearningDay() !== today || !current?.options.includes(selected)) {
      setSelected("");
      return;
    }
    if (persist({ ...history, [today!]: { ids: record!.ids, answers: [...answers, selected] } })) {
      answered.current = true;
      setSelected("");
    }
  }

  const days = (count: number) => t("days", { count });
  const score = questions ? answers.filter((a, i) => a === questions[i]!.answer).length : 0;

  return (
    <div className="space-y-5">
      <div>
        <SectionHead kicker={t("kicker")} title={t("title")} icon={<BookOpenIcon size={32} />} />
        <p className="mt-2 text-sm text-[#587083]">
          {t("lead", { date: formatDate(locale, today) })}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label={t("current")} value={days(stats.current)} />
        <Metric label={t("best")} value={days(stats.best)} />
        <Metric className="col-span-2 sm:col-span-1" label={t("total")} value={stats.total} />
      </dl>

      <ToolPanel className="mx-auto max-w-[850px]">
        {!questions ? (
          <>
            {unfinished && (
              <p role="status" className="mb-4 rounded-lg bg-[#fff1d7] p-4 text-sm text-[#725119]">
                {t("unfinished", { date: formatDate(locale, addDays(today, -1)) })}
              </p>
            )}
            <h2
              ref={heading}
              tabIndex={-1}
              className="text-[23px] leading-tight font-bold tracking-tight text-[#122e43]"
            >
              {t(`introTitle.${size}`)}
            </h2>
            <p className="mt-3 mb-5 text-sm text-[#587083]">{t("introBody")}</p>
            <PressedGroup
              label={t("size")}
              value={size}
              onChange={setSize}
              options={CHALLENGE_SIZES.map((n) => ({
                value: n,
                label: t("sizeOption", { count: n }),
              }))}
            />
            <div className="mt-5">
              <button type="button" className={toolButtonClass(true)} onClick={start}>
                {t("start")}
              </button>
            </div>
          </>
        ) : complete ? (
          <div className="text-center">
            <AwardIcon size={48} className="mx-auto text-[#916413]" />
            <h2
              ref={heading}
              tabIndex={-1}
              className="mt-3 text-[23px] leading-tight font-bold tracking-tight text-[#122e43]"
            >
              {t("doneTitle")}
            </h2>
            <p className="mt-3 text-[23px] font-semibold text-[#203d50] tabular-nums">
              {t("score", { score, total: questions.length })}
            </p>
            <p className="mt-2 text-sm text-[#587083]">{t("doneBody")}</p>
            <details className="mt-5 text-left">
              <summary className="flex cursor-pointer items-center text-sm font-bold text-[#226969] pointer-coarse:min-h-11">
                {t("review")}
              </summary>
              <ol className="mt-3 space-y-3">
                {questions.map((q, i) => (
                  <li key={q.id} className="rounded-[10px] bg-[#f0f6f8] p-4 text-sm">
                    <p className="font-bold text-[#122e43]" lang="es">
                      {q.prompt}
                    </p>
                    <p className="mt-1">{t("yourAnswer", { answer: answers[i] ?? "" })}</p>
                    <p>{t("rightAnswer", { answer: q.answer })}</p>
                    <p className="mt-1 text-[#587083]" lang="es">
                      {q.explanation}
                    </p>
                  </li>
                ))}
              </ol>
            </details>
          </div>
        ) : (
          <>
            <p className="text-xs font-extrabold tracking-[0.17em] text-[#157877]">
              {t("progress", {
                group: current!.group,
                current: index + 1,
                total: questions.length,
              })}
            </p>
            <progress
              value={index}
              max={questions.length}
              aria-label={t("progressLabel")}
              className="my-4 block h-2 w-full accent-tool"
            />
            <h2
              ref={heading}
              tabIndex={-1}
              lang="es"
              className="text-[23px] leading-tight font-bold tracking-tight text-[#122e43]"
            >
              {current!.prompt}
            </h2>
            <div role="group" aria-label={t("options")} className="mt-5 grid gap-3 sm:grid-cols-2">
              {current!.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  lang="es"
                  aria-pressed={selected === option}
                  onClick={() => setSelected(option)}
                  className="min-h-[60px] rounded-[10px] border border-[#cbdbe3] bg-white p-4 text-left text-sm text-[#24465d] [overflow-wrap:anywhere] hover:bg-canvas aria-[pressed=true]:border-[#07877e] aria-[pressed=true]:bg-[#e7f5ef] aria-[pressed=true]:ring-1 aria-[pressed=true]:ring-[#07877e]"
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="mt-5">
              <button
                type="button"
                className={toolButtonClass(true)}
                disabled={!selected}
                onClick={confirm}
              >
                {t("confirm")}
              </button>
            </div>
          </>
        )}
        {saveFailed && (
          <p role="alert" className="mt-4 rounded-[7px] bg-[#fff1e9] p-3 text-sm text-[#a74428]">
            {t("saveError")}
          </p>
        )}
        <div role="status">
          {last && (
            <div className="mt-5 rounded-[10px] bg-[#f0f6f8] p-4 text-sm">
              <p className="font-bold text-[#122e43]">
                {answers[index - 1] === last.answer ? t("previousRight") : t("previousReview")}
              </p>
              <p className="mt-1" lang="es">
                {last.prompt}
              </p>
              <p className="mt-1 text-[#587083]" lang="es">
                {t("explained", { answer: last.answer, explanation: last.explanation })}
              </p>
            </div>
          )}
        </div>
      </ToolPanel>

      <ToolPanel>
        <h2 className="text-[23px] leading-tight font-bold tracking-tight text-[#122e43]">
          {t("medalsTitle")}
        </h2>
        <LearningMedals best={stats.best} />
        <p className="text-sm text-[#587083]">{t("medalsNote")}</p>
      </ToolPanel>

      <Footnote>{t("footnote")}</Footnote>
    </div>
  );
}
