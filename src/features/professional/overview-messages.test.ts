import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";

// v1.8 printed «1 apartados por completar»: the count is an ICU plural here.
describe("profile progress copy", () => {
  const tEs = createTranslator({ locale: "es", messages: es, namespace: "professional.overview" });
  const tEn = createTranslator({ locale: "en", messages: en, namespace: "professional.overview" });

  it("pluralises the items left", () => {
    expect(tEs("toComplete", { count: 1 })).toBe("1 apartado por completar");
    expect(tEs("toComplete", { count: 3 })).toBe("3 apartados por completar");
    expect(tEn("toComplete", { count: 1 })).toBe("1 item to complete");
    expect(tEn("toComplete", { count: 3 })).toBe("3 items to complete");
  });

  it("states the percentage for the bar and its accessible name", () => {
    expect(tEs("progressLead", { percent: 71 })).toBe("Tu pasaporte está al 71%");
    expect(tEs("progressLabel", { percent: 71 })).toBe("Perfil completado al 71 por ciento");
    expect(tEn("progressLabel", { percent: 71 })).toBe("Profile 71 percent complete");
  });
});
