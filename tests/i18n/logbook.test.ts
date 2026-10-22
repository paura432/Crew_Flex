import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import { LOGBOOK_CATEGORIES, LOGBOOK_ENVIRONMENTS } from "../../src/domain/logbook";

// TEC-06 #11: v1.8 printed «3.5 h» in Spanish too; the port uses the language's decimal mark.
describe("logbook copy", () => {
  const tEs = createTranslator({ locale: "es", messages: es, namespace: "logbook" });
  const tEn = createTranslator({ locale: "en", messages: en, namespace: "logbook" });

  it("hours use the locale's decimal mark", () => {
    expect(tEs("hoursValue", { hours: 3.5 })).toBe("3,5 h");
    expect(tEn("hoursValue", { hours: 3.5 })).toBe("3.5 h");
    expect(tEs("hoursValue", { hours: 2 })).toBe("2 h");
  });

  it("keeps the v1.8 literals of the connected and demo screens", () => {
    expect(tEs("title")).toBe("Logbook personal");
    expect(tEs("eyebrow")).toBe("MI EXPERIENCIA");
    expect(tEs("save")).toBe("Guardar entrada");
    expect(tEs("selectable")).toBe("Seleccionable para expediente");
    expect(es.v.logbook.date.future).toBe("El logbook registra actividad realizada, no futura.");
    expect(tEs("invalid")).toBe("Indica una tarea realizada, fecha válida y descripción.");
  });

  it("labels every category and environment in both languages", () => {
    for (const c of LOGBOOK_CATEGORIES) {
      expect(es.logbook.category[c], c).toBeTruthy();
      expect(en.logbook.category[c], c).toBeTruthy();
    }
    for (const e of LOGBOOK_ENVIRONMENTS) {
      expect(es.logbook.environment[e], e).toBeTruthy();
      expect(en.logbook.environment[e], e).toBeTruthy();
    }
  });
});
