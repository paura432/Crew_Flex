import { describe, expect, it } from "vitest";
import { acceptsPhoto, centredSquare, isStoredPhoto, photoKey, PHOTO_MAX_BYTES } from "./avatar";

describe("avatar photo (N-23, browser only)", () => {
  it("keeps v1.8's per-user key", () => {
    expect(photoKey("u-1")).toBe("crewflex-avatar-v1-u-1");
  });

  it("accepts JPG, PNG and WebP up to 2 MB, nothing else", () => {
    expect(acceptsPhoto({ type: "image/jpeg", size: PHOTO_MAX_BYTES })).toBe(true);
    expect(acceptsPhoto({ type: "image/webp", size: 10 })).toBe(true);
    expect(acceptsPhoto({ type: "image/png", size: PHOTO_MAX_BYTES + 1 })).toBe(false);
    expect(acceptsPhoto({ type: "image/gif", size: 10 })).toBe(false);
    expect(acceptsPhoto({ type: "image/svg+xml", size: 10 })).toBe(false);
  });

  it("shows only an image data URL of an accepted type (never a URL or script)", () => {
    expect(isStoredPhoto("data:image/jpeg;base64,AAAA")).toBe(true);
    expect(isStoredPhoto("data:image/svg+xml;base64,AAAA")).toBe(false);
    expect(isStoredPhoto("https://example.test/a.jpg")).toBe(false);
    expect(isStoredPhoto("javascript:alert(1)")).toBe(false);
    expect(isStoredPhoto(null)).toBe(false);
  });

  it("crops the centred square", () => {
    expect(centredSquare(800, 600)).toEqual({ x: 100, y: 0, side: 600 });
    expect(centredSquare(300, 500)).toEqual({ x: 0, y: 100, side: 300 });
  });
});
