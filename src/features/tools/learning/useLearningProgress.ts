// Challenge progress of the signed-in user, kept in this browser only (v1.8 default, TOOL-07 #17):
// `localStorage["crewflex-learning-<user id>"]`, question ids and chosen answers per Madrid day. No
// `guest` key shared between people (✗ TOOL-07 #18). Client-only; imported by client components.
import { useMemo, useSyncExternalStore } from "react";
import { madridDay, parseLearningHistory, type LearningHistory } from "@/domain/learning";

const CHANGE_EVENT = "crewflex-learning-change";

const readRaw = (key: string) => {
  try {
    return localStorage.getItem(key) ?? "{}";
  } catch {
    return "{}"; // blocked storage reads as no progress; saving then reports the error
  }
};

function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

// v1.8 re-reads the day every 30 s and on focus, so an open tab moves to the next day by itself.
function subscribeClock(onChange: () => void) {
  const timer = setInterval(onChange, 30_000);
  window.addEventListener("focus", onChange);
  return () => {
    clearInterval(timer);
    window.removeEventListener("focus", onChange);
  };
}

const today = () => madridDay(new Date());

/** `history` and `today` are null on the server and until hydration (render a loading state). */
export function useLearningProgress(userId: string) {
  const key = `crewflex-learning-${userId}`;
  const raw = useSyncExternalStore(
    subscribeStorage,
    () => readRaw(key),
    () => null,
  );
  const day = useSyncExternalStore(subscribeClock, today, () => null);
  const history = useMemo(() => (raw === null ? null : parseLearningHistory(raw)), [raw]);

  /** Writes the whole history; false when the browser refuses (quota, blocked storage). */
  function save(next: LearningHistory): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      return false;
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return true;
  }

  return { history, today: day, save };
}

/** The day now, read at the moment of an answer (the rendered day may be up to 30 s old). */
export const currentLearningDay = today;
