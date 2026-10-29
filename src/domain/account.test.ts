import { describe, expect, it } from "vitest";
import { EXPORT_FILES_MAX_BYTES, filesToEmbed } from "./account";

describe("filesToEmbed", () => {
  it("keeps the order and embeds every file that still fits under the cap", () => {
    const docs = [
      { id: "a", sizeBytes: 2 },
      { id: "b", sizeBytes: 5 },
      { id: "c", sizeBytes: 3 },
      { id: "d", sizeBytes: 1 },
    ];
    expect([...filesToEmbed(docs, 6)]).toEqual(["a", "c", "d"]);
  });

  it("embeds nothing above the cap and everything below it", () => {
    expect(filesToEmbed([{ id: "big", sizeBytes: EXPORT_FILES_MAX_BYTES + 1 }]).size).toBe(0);
    expect(filesToEmbed([{ id: "x", sizeBytes: EXPORT_FILES_MAX_BYTES }]).has("x")).toBe(true);
    expect(filesToEmbed([]).size).toBe(0);
  });
});
