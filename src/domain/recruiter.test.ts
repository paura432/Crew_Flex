import { describe, expect, it } from "vitest";
import { APPLICATION_STATUSES } from "./applications";
import { ORGANIZATION_TYPES } from "./organization";
import {
  activationBlocker,
  ADVANCING_APPLICATION_STATUSES,
  canActForClient,
  canRevoke,
  clientRequired,
  isStaffingAgency,
  RECRUITER_CONFLICTS,
  REPRESENTATION_STATUSES,
} from "./recruiter";

describe("recruiter (BR-27)", () => {
  it("only a staffing agency represents clients", () => {
    expect(ORGANIZATION_TYPES.filter(isStaffingAgency)).toEqual(["staffing_agency"]);
    expect(isStaffingAgency(null)).toBe(false);
  });

  it("an agency publishes only for a client; a draft may wait (v1.8 Company2.jsx:103)", () => {
    expect(clientRequired("staffing_agency", undefined)).toBe(true);
    expect(clientRequired("staffing_agency", "publish")).toBe(true);
    expect(clientRequired("staffing_agency", "draft")).toBe(false);
    for (const type of ORGANIZATION_TYPES.filter((t) => t !== "staffing_agency"))
      expect(clientRequired(type, "publish")).toBe(false);
  });

  it("acting for a client needs an active representation", () => {
    expect(REPRESENTATION_STATUSES.filter(canActForClient)).toEqual(["active"]);
  });

  it("forward steps act for the client; winding down does not", () => {
    expect(ADVANCING_APPLICATION_STATUSES).toEqual([
      "received",
      "shortlisted",
      "proposed",
      "accepted",
      "confirmed",
    ]);
    const windDown = APPLICATION_STATUSES.filter(
      (s) => !ADVANCING_APPLICATION_STATUSES.includes(s),
    );
    expect(windDown.sort()).toEqual(["cancelled", "finished", "rejected", "withdrawn"]);
  });

  it("activation: never the reviewer's own agency, pending only", () => {
    expect(activationBlocker({ status: "pending" }, true)).toBe("own");
    expect(activationBlocker({ status: "active" }, false)).toBe("notPending");
    expect(activationBlocker({ status: "revoked" }, false)).toBe("notPending");
    expect(activationBlocker({ status: "pending" }, false)).toBeNull();
  });

  it("revoking is final", () => {
    expect(REPRESENTATION_STATUSES.filter(canRevoke)).toEqual(["pending", "active"]);
  });

  it("SQLSTATEs CFR01, CFR02 in this order", () => {
    expect(RECRUITER_CONFLICTS).toEqual(["CLIENT_REQUIRED", "CLIENT_NOT_ACTIVE"]);
  });
});
