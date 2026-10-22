// Question bank of the daily challenge (v1.8 `src/features/progress.js` → `facts` + `questions`): 158 =
// 10 «Fundamentos» + 64 «Inglés» + 38 «Siglas» (from the dictionary) + 46 «ATA». Editorial data in
// Spanish, catalogue 2026-10-13.1 pending formal review; same order and ids as v1.8, so the daily
// selection matches it (parity test).
import type { LearningQuestion } from "@/domain/learning";
import { ATA, ENTRIES } from "../knowledge/data";

/** Interleaving order of the daily selection. */
export const QUIZ_GROUPS = ["Fundamentos", "ATA", "Inglés", "Siglas"] as const;

const FACTS: readonly (readonly [prompt: string, answer: string, explanation: string])[] = [
  [
    "¿Qué identifica un número de serie (S/N)?",
    "Una unidad individual",
    "El S/N distingue una unidad; el P/N identifica una referencia de pieza.",
  ],
  [
    "¿Qué significa AMM?",
    "Aircraft Maintenance Manual",
    "AMM es el manual de mantenimiento de la aeronave. Su aplicabilidad y revisión deben comprobarse.",
  ],
  [
    "¿Para qué sirve un catálogo ilustrado de piezas (IPC)?",
    "Identificar piezas y referencias",
    "Identifica piezas y referencias; no sustituye las instrucciones de mantenimiento aplicables.",
  ],
  [
    "¿Qué indica la aplicabilidad de un documento?",
    "A qué configuración o aeronave se aplica",
    "Una tarea o pieza no tiene por qué aplicar a todas las aeronaves de una familia.",
  ],
  [
    "¿Qué debes distinguir al leer una revisión?",
    "La versión vigente y la sustituida",
    "La revisión identifica una versión de la documentación; consultar la fuente controlada.",
  ],
  [
    "¿Qué diferencia hay entre lbf·ft y lbf·in?",
    "Un factor de 12",
    "Un pie equivale a doce pulgadas; la unidad cambia el valor numérico del par.",
  ],
  [
    "¿Cómo se convierte volumen de combustible en masa?",
    "Volumen multiplicado por densidad",
    "Las unidades y condiciones de temperatura deben ser compatibles.",
  ],
  [
    "¿Qué representa kg/L?",
    "Masa por unidad de volumen",
    "kg/L expresa densidad; L/kg es su inversa, volumen específico.",
  ],
  [
    "¿Qué significa UTC?",
    "Coordinated Universal Time",
    "La conversión a hora local depende también de la fecha y de la zona horaria.",
  ],
  [
    "¿Una medalla por aprender autoriza a firmar mantenimiento?",
    "No, es un logro de aprendizaje",
    "Una racha no acredita licencia, competencia ni autorización de una organización.",
  ],
];

export const QUESTIONS: readonly LearningQuestion[] = [
  ...FACTS.map(([prompt, answer, explanation], i) => ({
    id: `fact-${i}`,
    group: "Fundamentos",
    prompt,
    answer,
    explanation,
  })),
  ...ENTRIES.map((e) => ({
    id: e.id,
    group: e.group === "Siglas" ? "Siglas" : "Inglés",
    prompt: `¿Qué significa «${e.term}» en este contexto?`,
    answer: e.translation,
    explanation: e.definition,
  })),
  ...ATA.map((a) => ({
    id: `ata-${a.code}`,
    group: "ATA",
    prompt: `¿Qué sistema identifica ATA ${a.code}?`,
    answer: a.label,
    explanation: `ATA ${a.code}: ${a.label}. El índice orienta la búsqueda; no contiene procedimientos.`,
  })),
];

const BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));

/** The stored ids back to questions; null when one is no longer in the bank. */
export function questionsById(ids: readonly string[]): LearningQuestion[] | null {
  const found = ids.map((id) => BY_ID.get(id));
  return found.every((q) => q !== undefined) ? (found as LearningQuestion[]) : null;
}
