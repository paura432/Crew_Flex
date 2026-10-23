import { describe, expect, it } from "vitest";
import {
  addRepresentedClientInput,
  listRepresentedClientsQuery,
  representedClientActionInput,
} from "./recruiter";

const ORG = "3f0c6a52-1d4b-4c55-9a4e-2f1f6f0e9a10";

describe("addRepresentedClientInput (v1.8 «Nuevo cliente»)", () => {
  it("trims the name, lowercases the e-mail, an empty e-mail is none", () => {
    expect(
      addRepresentedClientInput.parse({
        organizationId: ORG,
        name: "  Operador cliente 1 ",
        contactEmail: " OPS@Client.test ",
      }),
    ).toEqual({ organizationId: ORG, name: "Operador cliente 1", contactEmail: "ops@client.test" });
    expect(
      addRepresentedClientInput.parse({ organizationId: ORG, name: "Cliente", contactEmail: "" })
        .contactEmail,
    ).toBeUndefined();
  });

  it("refuses a short or long name and an invalid e-mail with the v1.8 messages", () => {
    const issues = (input: object) =>
      addRepresentedClientInput
        .safeParse({ organizationId: ORG, name: "Cliente", ...input })
        .error?.issues.map((i) => i.message);
    expect(issues({ name: " x " })).toEqual(["v.recruiter.clientName"]);
    expect(issues({ name: "y".repeat(121) })).toEqual(["v.recruiter.clientName"]);
    expect(issues({ contactEmail: "not-an-email" })).toEqual(["v.recruiter.clientEmail"]);
  });

  it("is strict: no status, agency or identity from the payload (S-2)", () => {
    for (const extra of [
      { status: "active" },
      { agencyId: ORG },
      { createdBy: ORG },
      { role: "admin" },
    ])
      expect(
        addRepresentedClientInput.safeParse({ organizationId: ORG, name: "Cliente", ...extra })
          .success,
        JSON.stringify(extra),
      ).toBe(false);
  });
});

describe("representedClientActionInput", () => {
  it("revoke takes no note; activate needs evidence (≤ 2000)", () => {
    expect(representedClientActionInput.safeParse({ id: ORG, action: "revoke" }).success).toBe(
      true,
    );
    expect(
      representedClientActionInput.safeParse({ id: ORG, action: "revoke", note: "x" }).success,
    ).toBe(false);
    expect(
      representedClientActionInput.safeParse({ id: ORG, action: "activate", note: "  " }).error
        ?.issues[0]?.message,
    ).toBe("v.recruiter.noteRequired");
    expect(
      representedClientActionInput.safeParse({
        id: ORG,
        action: "activate",
        note: "n".repeat(2001),
      }).error?.issues[0]?.message,
    ).toBe("v.recruiter.noteMax");
    expect(
      representedClientActionInput.parse({ id: ORG, action: "activate", note: " Mandate ref. 7 " }),
    ).toEqual({ id: ORG, action: "activate", note: "Mandate ref. 7" });
    expect(representedClientActionInput.safeParse({ id: ORG, action: "restore" }).success).toBe(
      false,
    );
  });
});

describe("listRepresentedClientsQuery", () => {
  it("an organization's portfolio or the review view, not both", () => {
    expect(listRepresentedClientsQuery.safeParse({ organizationId: ORG }).success).toBe(true);
    expect(listRepresentedClientsQuery.safeParse({ view: "review" }).success).toBe(true);
    expect(
      listRepresentedClientsQuery.safeParse({ organizationId: ORG, view: "review" }).success,
    ).toBe(false);
    expect(listRepresentedClientsQuery.safeParse({}).success).toBe(false);
  });
});
