import { describe, expect, it } from "vitest";
import { detailRouteOf, isUuid } from "./detail-routes";

const ID = "6f1c2c1e-2b0a-4a51-9a8e-0d3c5b7e9f10";

describe("detailRouteOf (real 404 before the stream)", () => {
  it("names the requirement detail and its sub-pages", () => {
    for (const suffix of ["", "/", "/matches", "/applications", "/edit"]) {
      expect(detailRouteOf(`/app/organization/requirements/${ID}${suffix}`)).toEqual({
        kind: "requirement",
        id: ID,
      });
    }
  });

  it("names the opportunity and the «Ofertas en la red» detail", () => {
    expect(detailRouteOf(`/app/professional/opportunities/${ID}`)).toEqual({
      kind: "opportunity",
      id: ID,
    });
    expect(detailRouteOf(`/app/organization/network/${ID}`)).toEqual({ kind: "network", id: ID });
  });

  it("leaves lists, the builder and other pages alone", () => {
    for (const path of [
      "/app/organization/requirements",
      "/app/organization/requirements/new",
      "/app/organization/requirements/new/",
      "/app/professional/opportunities",
      "/app/organization/network",
      `/app/organization/requirements/${ID}/unknown`,
      "/app/professional",
    ]) {
      expect(detailRouteOf(path), path).toBeNull();
    }
  });

  it("keeps a malformed id (the gate answers 404 for it)", () => {
    expect(detailRouteOf("/app/organization/requirements/abc")).toEqual({
      kind: "requirement",
      id: "abc",
    });
    expect(isUuid("abc")).toBe(false);
    expect(isUuid(ID)).toBe(true);
    expect(isUuid(ID.toUpperCase())).toBe(true);
  });
});
