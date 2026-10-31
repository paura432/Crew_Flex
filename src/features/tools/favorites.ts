import { TOOL_IDS, type ToolId } from "./ids";

/** The stored favourites, in catalogue order; anything unknown or malformed is dropped. */
export function parseFavorites(raw: string): ToolId[] {
  try {
    const stored: unknown = JSON.parse(raw);
    if (!Array.isArray(stored)) return [];
    const ids = new Set<unknown>(stored);
    return TOOL_IDS.filter((id) => ids.has(id));
  } catch {
    return [];
  }
}
