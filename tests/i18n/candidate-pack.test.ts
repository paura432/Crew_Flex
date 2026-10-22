import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import es from "../../messages/es.json";

// v2-15 / v2-04 (HIRE-05, MKT-05 #8): the v1.8 literals of the Candidate Pack, and the two deliberate changes
// (T-115): no «wallet» in the copy date (here the wallet holds documents, which the copy has not) and no
// promise of an unlock in the protection notice (D-07 P3 open).
describe("Candidate Pack copy", () => {
  const tEs = createTranslator({ locale: "es", messages: es, namespace: "candidatePack" });
  const tEn = createTranslator({ locale: "en", messages: en, namespace: "candidatePack" });

  it("keeps the v1.8 literals", () => {
    expect(tEs("badge")).toBe("Expediente compartido");
    expect(tEs("view")).toBe("Ver expediente");
    expect(tEs("noExpiryApplicable")).toBe("Sin fecha aplicable");
    expect(tEs("noRestrictions")).toBe("Sin restricciones declaradas");
    expect(tEs("experienceTitle")).toBe("Experiencia compartida");
    expect(tEs("previewExperienceTitle")).toBe("Experiencia que compartes");
    expect(tEs("minRate", { amount: "45,50 €", unit: tEs("rateUnit.hour") })).toBe(
      "Mínimo declarado: 45,50 € / hora",
    );
    expect(
      ["none", "valid", "soon", "expired"].map((s) =>
        tEs(`courseState.${s}` as "courseState.none"),
      ),
    ).toEqual(["Sin caducidad", "Vigente", "Caduca pronto", "Caducado"]);
  });

  it("dates the copy without the wallet and promises no unlock", () => {
    expect(tEs("copyDate", { date: "24 oct 2026" })).toBe(
      "Copia del perfil: 24 oct 2026. Los cambios del pasaporte y del logbook no alteran esta versión.",
    );
    expect(tEs("protected")).toBe(
      "Los originales, nombres de archivos y metadatos identificativos permanecen protegidos.",
    );
    for (const t of [tEs, tEn]) {
      expect(t("protected")).not.toMatch(/desbloque|unlock/i);
      expect(t("copyDate", { date: "x" })).not.toMatch(/wallet/i);
    }
  });

  it("the logbook no longer says its mark shares nothing", () => {
    expect(es.logbook.cvRelevantHint).toContain("Los expedientes ya enviados conservan su copia.");
    expect(en.logbook.cvRelevantHint).toContain("Dossiers already sent keep their copy.");
    expect(es.logbook.disclaimer).not.toContain("ninguna empresa tiene acceso");
  });
});
