"use client";

import { useState } from "react";

/**
 * `Idempotency-Key`s for logical creates (I-1). Each distinct payload keeps its own key until a
 * confirmed success, so retrying ANY earlier payload whose outcome is unknown (timeout, network error,
 * second click — even after trying another payload in between) replays instead of duplicating
 * (independent review L4). A confirmed success releases the key of the payload that was just sent.
 * Actions run one at a time (forms are disabled while pending), so "just sent" is unambiguous.
 */
export function createIdempotencyKeys(newKey: () => string = () => crypto.randomUUID()) {
  const keys = new Map<string, string>();
  let last: string | null = null;
  return {
    keyFor(payload: unknown): string {
      const signature = JSON.stringify(payload);
      let key = keys.get(signature);
      if (!key) {
        key = newKey();
        keys.set(signature, key);
      }
      last = signature;
      return key;
    },
    release(): void {
      if (last !== null) keys.delete(last);
      last = null;
    },
  };
}

/** One key set per mounted form (stable across renders). */
export function useIdempotencyKey() {
  const [keys] = useState(() => createIdempotencyKeys());
  return keys;
}
