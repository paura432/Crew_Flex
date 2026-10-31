/** The `aria-describedby` of a Field control: its error when present, else its hint. */
export function describedBy(id: string, error?: string, hint?: string) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}
