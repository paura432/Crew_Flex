import { describe, expect, it } from "vitest";
import type { RepresentedClient } from "@/types/api";
import { CLIENT_STATUS_TONE, clientSince, selectableClients } from "./view";

const client = (over: Partial<RepresentedClient>): RepresentedClient => ({
  id: "c",
  organizationId: "o",
  name: "Cliente",
  contactEmail: null,
  status: "pending",
  createdAt: "2026-10-20T10:00:00.000Z",
  activatedAt: null,
  revokedAt: null,
  ...over,
});

describe("recruiter view helpers", () => {
  it("the builder offers active clients only, by name, without their e-mail", () => {
    expect(
      selectableClients([
        client({ id: "b", name: "Beta", status: "active", contactEmail: "b@x.test" }),
        client({ id: "p", name: "Pending", status: "pending" }),
        client({ id: "a", name: "Alfa", status: "active" }),
        client({ id: "r", name: "Revoked", status: "revoked" }),
      ]),
    ).toEqual([
      { id: "a", name: "Alfa" },
      { id: "b", name: "Beta" },
    ]);
  });

  it("each state has its date line and tone", () => {
    expect(clientSince(client({}))).toEqual({ key: "addedOn", date: "2026-10-20T10:00:00.000Z" });
    expect(
      clientSince(client({ status: "active", activatedAt: "2026-10-21T10:00:00.000Z" })).key,
    ).toBe("activatedOn");
    expect(
      clientSince(client({ status: "revoked", revokedAt: "2026-10-22T10:00:00.000Z" })).key,
    ).toBe("revokedOn");
    expect(CLIENT_STATUS_TONE).toEqual({ pending: "warn", active: "ok", revoked: "neutral" });
  });
});
