import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ConfirmButton } from "./ConfirmButton";

// No DOM in this suite (node environment): the first render is what a click starts from.
describe("ConfirmButton", () => {
  it("first shows only the action and sends nothing", () => {
    const onConfirm = vi.fn();
    const html = renderToStaticMarkup(
      createElement(ConfirmButton, {
        label: "Quitar",
        confirmLabel: "Sí, quitarla",
        cancelLabel: "Cancelar",
        onConfirm,
      }),
    );
    expect(html).toContain("Quitar");
    expect(html).not.toContain("Sí, quitarla");
    expect(html).not.toContain("Cancelar");
    expect(html).toContain("text-danger");
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("respects disabled", () => {
    const html = renderToStaticMarkup(
      createElement(ConfirmButton, {
        label: "Eliminar",
        confirmLabel: "Sí, eliminarla",
        cancelLabel: "Cancelar",
        onConfirm: () => {},
        disabled: true,
      }),
    );
    expect(html).toMatch(/<button[^>]*disabled/);
  });
});
