import { describe, expect, it } from "vitest";
import { APPLICATION_TRANSITIONS } from "@/domain/applications";
import { applicationErrorCopy } from "./error-copy";
import { applicationDays, transitionLabelKey, withPackParam } from "./view";

describe("applications view helpers", () => {
  it("«Ver expediente» sets ?pack= and keeps the other filters; closing removes it", () => {
    const id = "00000000-0000-4000-8000-0000000000aa";
    expect(withPackParam("/app/organization/applications?status=received&page=2", id)).toBe(
      `/app/organization/applications?status=received&page=2&pack=${id}`,
    );
    expect(withPackParam(`/app/professional/applications?pack=${id}&status=received`, null)).toBe(
      "/app/professional/applications?status=received",
    );
    expect(withPackParam("/app/organization/requirements/r/applications", null)).toBe(
      "/app/organization/requirements/r/applications",
    );
  });

  it("one label per transition; re-proposal and the two cancellations are told apart", () => {
    expect(
      APPLICATION_TRANSITIONS.map((t) => `${t.actor}:${transitionLabelKey(t)}`).sort(),
    ).toEqual(
      [
        "organization:shortlisted",
        "organization:rejected",
        "organization:propose",
        "organization:rejected",
        "organization:rejected",
        "organization:repropose",
        "organization:confirmed",
        "organization:cancelAccepted",
        "organization:finished",
        "organization:cancelAssignment",
        "technician:withdrawn",
        "technician:withdrawn",
        "technician:accepted",
        "technician:withdrawn",
        "technician:withdrawn",
        "technician:cancelAssignment",
      ].sort(),
    );
  });

  it("a 409 with a reason names the server check; other errors keep the common copy", () => {
    const t = (key: string) => `«${key}»`;
    expect(
      applicationErrorCopy(t, { code: "CONFLICT", message: "x", reason: "HEADCOUNT_REACHED" }).text,
    ).toBe("«applications.conflict.HEADCOUNT_REACHED»");
    expect(applicationErrorCopy(t, { code: "FORBIDDEN", message: "x" }).text).toBe(
      "«api.FORBIDDEN.description»",
    );
  });

  it("«{n} jornadas»: the shifts when published, else the UTC days of the period (D-06 Q6)", () => {
    const period = { startsAt: "2026-12-21T06:00:00.000Z", endsAt: "2026-12-22T18:00:00.000Z" };
    expect(applicationDays(period)).toBe(2);
    expect(applicationDays({ ...period, shifts: null })).toBe(2);
    const shift = { startsAt: period.startsAt, endsAt: period.endsAt, baseHours: 8 };
    expect(applicationDays({ ...period, shifts: [shift, shift, shift] })).toBe(3);
  });
});
