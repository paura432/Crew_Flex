import { describe, expect, it } from "vitest";
import { createIdempotencyKeys } from "./idempotency";

const counter = () => {
  let n = 0;
  return () => `k${++n}`;
};

describe("createIdempotencyKeys (I-1, review L4)", () => {
  it("the same payload reuses its key until a confirmed success", () => {
    const keys = createIdempotencyKeys(counter());
    expect(keys.keyFor({ day: "A" })).toBe("k1");
    expect(keys.keyFor({ day: "A" })).toBe("k1"); // retry after timeout / second click
    keys.release();
    expect(keys.keyFor({ day: "A" })).toBe("k2"); // a new logical operation after success
  });

  it("an uncertain payload keeps its key even after another payload was tried in between", () => {
    const keys = createIdempotencyKeys(counter());
    expect(keys.keyFor({ day: "A" })).toBe("k1"); // NETWORK_ERROR, maybe committed
    expect(keys.keyFor({ day: "B" })).toBe("k2"); // succeeds
    keys.release();
    expect(keys.keyFor({ day: "A" })).toBe("k1"); // retry of A replays, no duplicate window
  });

  it("different payloads never share a key", () => {
    const keys = createIdempotencyKeys(counter());
    expect(keys.keyFor({ a: 1 })).not.toBe(keys.keyFor({ a: 2 }));
  });
});
