import { useRef, type KeyboardEvent } from "react";

/**
 * WAI-ARIA radio group keys: arrows move (and wrap), Home/End jump to the ends. Returns the index to
 * select, or null for keys the group does not handle.
 */
export function radioKeyTarget(key: string, index: number, count: number): number | null {
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (index + 1) % count;
    case "ArrowLeft":
    case "ArrowUp":
      return (index - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/**
 * Roving tab stop for `role="radio"` buttons: one Tab stop (the checked option, else the first),
 * arrow keys move focus and selection together. `onSelect` receives the new index.
 */
export function useRovingRadio(count: number, checkedIndex: number, onSelect: (i: number) => void) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabStop = checkedIndex >= 0 ? checkedIndex : 0;
  return (index: number) => ({
    ref: (el: HTMLButtonElement | null) => {
      refs.current[index] = el;
    },
    tabIndex: index === tabStop ? 0 : -1,
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
      const target = radioKeyTarget(event.key, index, count);
      if (target === null) return;
      event.preventDefault();
      refs.current[target]?.focus();
      onSelect(target);
    },
  });
}
