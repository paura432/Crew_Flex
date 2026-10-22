import { describe, expect, it } from "vitest";
import { dailyQuestions } from "@/domain/learning";
import { QUESTIONS, QUIZ_GROUPS, questionsById } from "./questions";
// Captured from the v1.8 prototype runtime (`src/features/progress.js` → `dailyQuestions(date, 10)`,
// ids and options); the 5-question challenge was checked there to be the first five.
import v18 from "./v18-daily.fixture.json";

describe("question bank (v1.8 progress.js)", () => {
  it("has 158 questions: 10 Fundamentos, 64 Inglés, 38 Siglas, 46 ATA, unique ids", () => {
    const count = (g: string) => QUESTIONS.filter((q) => q.group === g).length;
    expect(QUESTIONS).toHaveLength(158);
    expect(QUIZ_GROUPS.map(count)).toEqual([10, 46, 64, 38]);
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(158);
  });

  it("keeps the learning-medal notice (TOOL-08 #9)", () => {
    expect(QUESTIONS.find((q) => q.id === "fact-9")).toMatchObject({
      prompt: "¿Una medalla por aprender autoriza a firmar mantenimiento?",
      answer: "No, es un logro de aprendizaje",
    });
  });

  it("maps stored ids back to questions, or null when one is unknown", () => {
    expect(questionsById(["fact-0", "ata-29"])?.map((q) => q.answer)).toEqual([
      "Una unidad individual",
      "Energía hidráulica",
    ]);
    expect(questionsById(["fact-0", "gone"])).toBeNull();
  });
});

describe("daily selection parity with v1.8 (3 fixed dates)", () => {
  for (const [date, expected] of Object.entries(v18)) {
    it(`${date}: the 10 and the 5 questions, and each option order, are v1.8's`, () => {
      const pick = (count: 5 | 10) =>
        dailyQuestions(QUESTIONS, QUIZ_GROUPS, date, count).map(({ id, options }) => ({
          id,
          options,
        }));
      expect(pick(10)).toEqual(expected);
      expect(pick(5)).toEqual(expected.slice(0, 5));
    });
  }

  it("2026-10-22 interleaves Fundamentos, ATA, Inglés, Siglas, Fundamentos", () => {
    const groups = dailyQuestions(QUESTIONS, QUIZ_GROUPS, "2026-10-22", 5).map((q) => q.group);
    expect(groups).toEqual(["Fundamentos", "ATA", "Inglés", "Siglas", "Fundamentos"]);
  });
});
