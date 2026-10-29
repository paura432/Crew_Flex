// Search over the editorial bank (v1.8 `knowledge.js` → `searchKnowledge`, `Toolbox.jsx` ATA filter).
import { ATA, ENTRIES, type KnowledgeEntry } from "./data";

/** Without accents, lower case, trimmed: «  Hidráulica » → «hidraulica». Shared with the translator. */
export const normalizeText = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/**
 * Entries of `group` (null = every area) whose term, translation or definition contain the query.
 * Examples are not searched, as in v1.8. v1.8 did not trim; a trailing space no longer matters (TOOL-05 #6).
 */
export function searchKnowledge(query: string, group: string | null = null): KnowledgeEntry[] {
  const q = normalizeText(query);
  return ENTRIES.filter(
    (e) =>
      (group === null || e.group === group) &&
      normalizeText(`${e.term} ${e.translation} ${e.definition}`).includes(q),
  );
}

/** ATA chapters whose «code label» contain the query, accents ignored (v1.8 kept them, ✗ TOOL-05 #14). */
export const filterAta = (query: string) => {
  const q = normalizeText(query);
  return ATA.filter((a) => normalizeText(`${a.code} ${a.label}`).includes(q));
};
