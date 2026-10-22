import { describe, expect, it } from "vitest";
import type { Notice } from "@/types/api";
import { noticeHref, noticesIntroKey, noticeTitleKey, unreadBadge } from "./view";

const APP = "00000000-0000-4000-8000-0000000000a1";
const REQ = "00000000-0000-4000-8000-0000000000b1";

const notice = (over: Partial<Notice>): Notice => ({
  id: "00000000-0000-4000-8000-0000000000c1",
  kind: "application",
  audience: "technician",
  createdAt: "2026-10-23T08:00:00.000Z",
  readAt: null,
  applicationId: APP,
  requirementId: REQ,
  requirementTitle: "Need",
  organizationName: "Demo MRO Madrid",
  applicationStatus: "shortlisted",
  requirementStatus: null,
  candidate: null,
  outreachUrgency: null,
  ...over,
});

describe("notice view (v2-18)", () => {
  it("names a new application for the organization and every other change as an update", () => {
    expect(noticeTitleKey(notice({}))).toBe("applicationUpdate");
    expect(
      noticeTitleKey(notice({ audience: "organization", applicationStatus: "received" })),
    ).toBe("newApplication");
    expect(
      noticeTitleKey(notice({ audience: "organization", applicationStatus: "withdrawn" })),
    ).toBe("applicationUpdate");
    for (const [status, key] of [
      ["paused", "requirementPaused"],
      ["open", "requirementResumed"],
      ["closed", "requirementClosed"],
    ] as const) {
      expect(
        noticeTitleKey(
          notice({ kind: "requirement", applicationStatus: null, requirementStatus: status }),
        ),
      ).toBe(key);
    }
  });

  it("links each side to the application's card", () => {
    expect(noticeHref(notice({}))).toBe(`/app/professional/applications#a-${APP}`);
    expect(noticeHref(notice({ audience: "organization" }))).toBe(
      `/app/organization/requirements/${REQ}/applications#a-${APP}`,
    );
  });

  it("names an Urgent/AOG distribution by its mode and leads to the opportunity (PKG outreach)", () => {
    const outreach = (urgency: "urgent" | "aog") =>
      notice({
        kind: "outreach",
        applicationId: null,
        applicationStatus: null,
        outreachUrgency: urgency,
      });
    expect(noticeTitleKey(outreach("urgent"))).toBe("outreachUrgent");
    expect(noticeTitleKey(outreach("aog"))).toBe("outreachAog");
    expect(noticeHref(outreach("aog"))).toBe(`/app/professional/opportunities/${REQ}`);
  });

  it("introduces the page by what the account receives", () => {
    expect(noticesIntroKey({ professional: true, manages: false })).toBe("technician");
    expect(noticesIntroKey({ professional: true, manages: true })).toBe("both");
    expect(noticesIntroKey({ professional: false, manages: true })).toBe("organization");
    expect(noticesIntroKey({ professional: false, manages: false })).toBe("organization");
  });

  it("shows the unread count only when there is one, capped at 99+", () => {
    expect([null, 0, 1, 99, 100].map(unreadBadge)).toEqual([null, null, "1", "99", "99+"]);
  });
});
