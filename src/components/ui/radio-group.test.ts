import { describe, expect, it } from "vitest";
import { radioKeyTarget } from "./radio-group";

describe("radioKeyTarget (WAI-ARIA radio group)", () => {
  it("moves with the arrows and wraps at both ends", () => {
    expect(radioKeyTarget("ArrowRight", 0, 3)).toBe(1);
    expect(radioKeyTarget("ArrowDown", 2, 3)).toBe(0);
    expect(radioKeyTarget("ArrowLeft", 0, 3)).toBe(2);
    expect(radioKeyTarget("ArrowUp", 1, 3)).toBe(0);
  });

  it("jumps with Home and End, ignores other keys", () => {
    expect(radioKeyTarget("Home", 2, 3)).toBe(0);
    expect(radioKeyTarget("End", 0, 3)).toBe(2);
    expect(radioKeyTarget("Enter", 1, 3)).toBeNull();
    expect(radioKeyTarget("Tab", 1, 3)).toBeNull();
  });
});
