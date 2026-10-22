import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import { ACTIVITY_ACTIONS, activityLabelKey } from "./activity";

const lookup = (catalog: object, path: string) =>
  path.split(".").reduce<unknown>((node, k) => (node as Record<string, unknown>)?.[k], catalog);

describe("organization activity labels (ORG-07 #12)", () => {
  it("every known action has a label in both catalogs", () => {
    for (const action of ACTIVITY_ACTIONS) {
      const key = `organization.profile.${activityLabelKey(action)}`;
      expect(typeof lookup(es, key), `es ${key}`).toBe("string");
      expect(typeof lookup(en, key), `en ${key}`).toBe("string");
    }
  });

  it("an unknown action has no key (the page shows its code)", () => {
    expect(activityLabelKey("document.uploaded")).toBeNull();
    expect(activityLabelKey("requirement.created")).toBe("activity.actions.requirement_created");
  });
});
