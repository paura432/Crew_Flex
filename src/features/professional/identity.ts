/**
 * Avatar initials as in v1.8 (`ProfileIdentity.jsx`): first letter of the first two words, upper
 * case. No photo is stored (D-07/D-10), so this is the whole avatar.
 */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0]!.toLocaleUpperCase("es"))
    .join("");
}
