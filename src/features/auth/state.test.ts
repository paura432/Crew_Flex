import { describe, expect, it } from "vitest";
import { safeConfirmNext, safeNextPath } from "./state";

describe("safeNextPath", () => {
  it.each([
    ["/app/organization", "/app/organization"],
    ["https://evil.example/app", "/app"],
    ["//evil.example", "/app"],
    ["/app\\@evil.example", "/app"],
    ["/login", "/app"],
    [null, "/app"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

describe("safeConfirmNext (e-mail link landing)", () => {
  it.each([
    ["/reset-password", "/reset-password"],
    ["/app/settings", "/app/settings"],
    ["https://evil.example/reset-password", "/app"],
    ["/reset-password/../login", "/app"],
    [null, "/app"],
  ])("%s → %s", (input, expected) => {
    expect(safeConfirmNext(input)).toBe(expected);
  });
});
