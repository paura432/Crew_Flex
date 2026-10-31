import { describe, expect, it } from "vitest";
import { trainingWrite } from "./training";

const ORG = "00000000-0000-4000-8000-0000000000a1";

describe("trainingWrite", () => {
  // The server action forwards its parsed output and the Edge Function parses it again (empty texts are null by then).
  it("is idempotent: parsing the parsed output accepts it unchanged", () => {
    for (const body of [
      { op: "provider", input: { organizationId: ORG, name: "Academia", description: "Demo" } },
      {
        op: "course",
        input: {
          organizationId: ORG,
          title: "Curso",
          family: "safety",
          description: "Demo",
          language: "es",
          certificateInfo: "Certificado",
          issuer: "Academia",
          aircraft: "",
        },
      },
    ]) {
      const once = trainingWrite.parse(body);
      expect(trainingWrite.parse(once)).toEqual(once);
    }
  });
});
