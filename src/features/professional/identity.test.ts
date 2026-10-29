import { describe, expect, it } from "vitest";
import { initials } from "./identity";

describe("initials", () => {
  it("takes the first letter of the first two words, upper case", () => {
    expect(initials("Marcos Beltrán")).toBe("MB");
    expect(initials("ana maría de la fuente")).toBe("AM");
    expect(initials("Delta")).toBe("D");
  });

  it("keeps accented letters and ignores extra spaces", () => {
    expect(initials("  álvaro   núñez ")).toBe("ÁN");
  });

  it("is empty for a blank name", () => {
    expect(initials("   ")).toBe("");
  });
});
