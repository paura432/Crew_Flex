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

  it("archiving a need and changing its client are the organization's own acts (P15, I18N-05)", () => {
    // Both audit rows carry the organization id (`20261023600100:350`, `20261024500100:122`), so the trail
    // showed their raw codes («requirement.archived»).
    expect(activityLabelKey("requirement.archived")).toBe("activity.actions.requirement_archived");
    expect(activityLabelKey("requirement.client_changed")).toBe(
      "activity.actions.requirement_client_changed",
    );
  });

  it("an agency's represented-client acts carry its organization id too (P15 review)", () => {
    // `20261024500000:135,178` write the agency's id for «client.added» and «client.revoked».
    expect(activityLabelKey("client.added")).toBe("activity.actions.client_added");
    expect(activityLabelKey("client.revoked")).toBe("activity.actions.client_revoked");
  });
});
