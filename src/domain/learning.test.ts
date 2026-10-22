import { describe, expect, it } from "vitest";
import {
  addDays,
  completedDays,
  dailyQuestions,
  fnv1a,
  isIsoDay,
  madridDay,
  parseLearningHistory,
  streak,
  withOptions,
  type LearningQuestion,
} from "./learning";

const q = (id: string, group: string, answer = `answer ${id}`): LearningQuestion => ({
  id,
  group,
  prompt: `prompt ${id}`,
  answer,
  explanation: "",
});
const BANK = [
  ...["a1", "a2", "a3", "a4", "a5"].map((id) => q(id, "A")),
  ...["b1", "b2", "b3"].map((id) => q(id, "B")),
  q("b4", "B", "answer b1"), // same answer as b1: a distractor never repeats
];

describe("fnv1a", () => {
  it("is the standard 32-bit FNV-1a", () => {
    expect(fnv1a("")).toBe(2166136261);
    expect(fnv1a("a")).toBe(0xe40c292c);
    expect(fnv1a("foobar")).toBe(0xbf9cf968);
  });
});

describe("dailyQuestions", () => {
  it("interleaves the groups, is stable for a date and changes with it", () => {
    const day = dailyQuestions(BANK, ["A", "B"], "2026-10-22", 5);
    expect(day.map((x) => x.group)).toEqual(["A", "B", "A", "B", "A"]);
    expect(dailyQuestions(BANK, ["A", "B"], "2026-10-22", 5)).toEqual(day);
    expect(new Set(day.map((x) => x.id)).size).toBe(5);
    const other = dailyQuestions(BANK, ["A", "B"], "2026-10-23", 5).map((x) => x.id);
    expect(other).not.toEqual(day.map((x) => x.id));
  });

  it("the first five of ten are the five", () => {
    const bank = [..."abcdefghij"].flatMap((c) => [q(`x${c}`, "X"), q(`y${c}`, "Y")]);
    const ten = dailyQuestions(bank, ["X", "Y"], "2027-01-01", 10);
    expect(ten.slice(0, 5)).toEqual(dailyQuestions(bank, ["X", "Y"], "2027-01-01", 5));
  });
});

describe("withOptions", () => {
  it("adds 3 distinct distractors of the same group; the answer is among the options", () => {
    const a = withOptions(BANK, BANK[0]!, "2026-10-22");
    expect(a.options).toHaveLength(4);
    expect(a.options).toContain("answer a1");
    expect(a.options.every((o) => o.startsWith("answer a"))).toBe(true);
    const b = withOptions(BANK, BANK[6]!, "2026-10-22"); // b2: others b1, b3, b4 (= b1's answer)
    expect(b.options).toHaveLength(3);
    expect(new Set(b.options).size).toBe(3);
  });
});

describe("days", () => {
  it("isIsoDay accepts real calendar days only", () => {
    expect(isIsoDay("2028-02-29")).toBe(true);
    expect(isIsoDay("2027-02-29")).toBe(false);
    expect(isIsoDay("2026-1-01")).toBe(false);
    expect(isIsoDay("bad")).toBe(false);
  });

  it("addDays crosses months and years", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("madridDay is the calendar day in Europe/Madrid (summer and winter time)", () => {
    expect(madridDay(new Date("2026-10-21T21:59:00Z"))).toBe("2026-10-21"); // 23:59 CEST
    expect(madridDay(new Date("2026-10-21T22:00:00Z"))).toBe("2026-10-22"); // 00:00 CEST
    expect(madridDay(new Date("2026-12-31T22:59:00Z"))).toBe("2026-12-31"); // 23:59 CET
    expect(madridDay(new Date("2026-12-31T23:00:00Z"))).toBe("2027-01-01");
  });
});

describe("streak (same values as v1.8 progress.js)", () => {
  it("today not yet completed does not break the current streak", () => {
    expect(streak(["2026-10-20", "2026-10-21"], "2026-10-22")).toEqual({
      current: 2,
      best: 2,
      total: 2,
    });
  });

  it("ignores future and malformed days; best is the longest run", () => {
    expect(
      streak(["2026-10-20", "2026-10-21", "2026-10-18", "bad", "2026-10-23"], "2026-10-22"),
    ).toEqual({ current: 2, best: 2, total: 3 });
    expect(streak(["2026-10-20"], "2026-10-22")).toEqual({ current: 0, best: 1, total: 1 });
    expect(streak([], "2026-10-22")).toEqual({ current: 0, best: 0, total: 0 });
  });

  it("counts today once completed", () => {
    expect(streak(["2026-10-21", "2026-10-22"], "2026-10-22").current).toBe(2);
  });
});

describe("parseLearningHistory (untrusted localStorage)", () => {
  const five = ["a", "b", "c", "d", "e"];
  it("keeps valid days and drops the rest", () => {
    const raw = JSON.stringify({
      "2026-10-21": { ids: five, answers: ["x", "y", "z", "w", "v"] },
      "2026-10-22": { ids: five, answers: ["x"] },
      "2026-10-23": { ids: ["a"], answers: [] }, // not 5 or 10
      "2026-10-24": { ids: five, answers: [1] }, // not strings
      "2026-10-25": { ids: five, answers: ["1", "2", "3", "4", "5", "6"] }, // more answers than ids
      "not-a-day": { ids: five, answers: [] },
      // v1.8 format (full questions, count, complete): not ours, dropped
      "2026-10-26": { count: 5, questions: [], answers: [], complete: false },
    });
    const history = parseLearningHistory(raw);
    expect(Object.keys(history)).toEqual(["2026-10-21", "2026-10-22"]);
    expect(completedDays(history)).toEqual(["2026-10-21"]);
  });

  it("survives garbage", () => {
    expect(parseLearningHistory(null)).toEqual({});
    expect(parseLearningHistory("not json")).toEqual({});
    expect(parseLearningHistory("[]")).toEqual({});
    expect(parseLearningHistory("null")).toEqual({});
  });
});
