// Locale-independent input helpers. Display formatting is locale-aware and lives in
// src/i18n/format.ts (dates) and the message catalogs (enum labels).

/** `datetime-local` values are entered and stored as UTC (shown as UTC everywhere, BR-10). */
export const toUtcIso = (local: string) => (local ? `${local}:00Z` : "");
export const toLocalInput = (iso: string) => iso.slice(0, 16);
