// Daily learning challenge (v1.8 `src/features/progress.js`): deterministic daily selection, answer
// options, streaks and the stored progress format. Pure: no clock, no storage. BUSINESS_RULES BR-16.
// A learning medal never qualifies anyone and never takes part in matching (BR-3 does not read it).

export interface LearningQuestion {
  id: string;
  group: string;
  prompt: string;
  answer: string;
  explanation: string;
}

export interface DailyQuestion extends LearningQuestion {
  /** The answer and up to 3 distractors of the same group, in a per-day order. */
  options: string[];
}

export const CHALLENGE_SIZES = [5, 10] as const;
export type ChallengeSize = (typeof CHALLENGE_SIZES)[number];

/** Medals by best streak; one set of names for the challenge and Mi espacio (✗ TOOL-08 #2). */
export const LEARNING_MEDALS = [
  { id: "first", days: 1 },
  { id: "week", days: 7 },
  { id: "month", days: 30 },
] as const;
export type LearningMedalId = (typeof LEARNING_MEDALS)[number]["id"];

/** 32-bit FNV-1a over the string's code points, as v1.8 `hash` (same values, bit for bit). */
export function fnv1a(text: string): number {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

const byHash = <T>(items: readonly T[], key: (item: T) => string) =>
  [...items].sort((a, b) => fnv1a(key(a)) - fnv1a(key(b)));

/** The question with its options for `date`: the answer plus 3 distinct distractors of its group. */
export function withOptions(
  bank: readonly LearningQuestion[],
  question: LearningQuestion,
  date: string,
): DailyQuestion {
  const others = [
    ...new Set(
      byHash(
        bank.filter((x) => x.group === question.group && x.answer !== question.answer),
        (x) => date + question.id + x.id,
      ).map((x) => x.answer),
    ),
  ].slice(0, 3);
  return {
    ...question,
    options: byHash([question.answer, ...others], (o) => date + question.id + o),
  };
}

/**
 * The challenge of `date`: groups interleaved in `groups` order (5: F A I S F; 10: … A I S F A), each
 * pool shuffled by the date's hash. The first 5 of the 10-question challenge are the 5-question one.
 */
export function dailyQuestions(
  bank: readonly LearningQuestion[],
  groups: readonly string[],
  date: string,
  count: ChallengeSize,
): DailyQuestion[] {
  const pools = groups.map((group) =>
    byHash(
      bank.filter((q) => q.group === group),
      (q) => date + q.id,
    ),
  );
  return Array.from({ length: count }, (_, i) => {
    const question = pools[i % groups.length]![Math.floor(i / groups.length)]!;
    return withOptions(bank, question, date);
  });
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar day «YYYY-MM-DD». */
export function isIsoDay(value: string): boolean {
  if (!ISO_DAY.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const MADRID = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" });

/**
 * The challenge's reference day: the calendar day in Europe/Madrid (v1.8 default, TOOL-07 #3). An
 * exception to BR-10 on purpose: it is not an operational time, only when «today's» challenge changes.
 */
export const madridDay = (now: Date) => MADRID.format(now);

export interface Streak {
  /** Consecutive days up to today; a today not yet completed does not break it until tomorrow. */
  current: number;
  /** Longest run of consecutive days up to today. */
  best: number;
  /** Days completed up to today. */
  total: number;
}

/** v1.8 `streak`: future and malformed days are ignored. */
export function streak(days: readonly string[], today: string): Streak {
  const completed = new Set(days.filter(isIsoDay));
  let cursor = completed.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (completed.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  const past = [...completed].filter((d) => d <= today).sort();
  let best = 0;
  let run = 0;
  let last = "";
  for (const d of past) {
    run = last && addDays(last, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    last = d;
  }
  return { current, best, total: past.length };
}

/** One day of progress. Only question ids and the chosen answers are kept (✗ TOOL-07 #19). */
export interface DayProgress {
  ids: string[];
  answers: string[];
}
export type LearningHistory = Record<string, DayProgress>;

const isStringArray = (x: unknown): x is string[] =>
  Array.isArray(x) && x.every((v) => typeof v === "string");

/**
 * Reads the stored history (untrusted: another tab, an older format, a hand edit). Days with a
 * malformed record are dropped; a record has 5 or 10 ids and no more answers than ids.
 */
export function parseLearningHistory(raw: string | null): LearningHistory {
  let stored: unknown;
  try {
    stored = JSON.parse(raw ?? "{}");
  } catch {
    return {};
  }
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
  const history: LearningHistory = {};
  for (const [day, record] of Object.entries(stored)) {
    if (!isIsoDay(day) || !record || typeof record !== "object") continue;
    const { ids, answers } = record as Record<string, unknown>;
    if (!isStringArray(ids) || !isStringArray(answers)) continue;
    if (!(CHALLENGE_SIZES as readonly number[]).includes(ids.length)) continue;
    if (answers.length > ids.length) continue;
    history[day] = { ids, answers };
  }
  return history;
}

export const isComplete = (day: DayProgress) => day.answers.length === day.ids.length;

/** Days whose challenge was finished (every question answered, right or wrong). */
export const completedDays = (history: LearningHistory) =>
  Object.entries(history)
    .filter(([, day]) => isComplete(day))
    .map(([date]) => date);
