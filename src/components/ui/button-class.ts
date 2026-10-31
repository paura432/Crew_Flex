export type Variant = "primary" | "secondary" | "ghost" | "danger" | "inverse" | "inverseLink";
export type Size = "md" | "sm";

// Colour and size come only from `variant` and `size`: two utilities for the same property in one
// class list resolve by stylesheet order, not by position, so a caller's `bg-*`/`text-*`/`min-h-*`
// override silently loses (X-01: white-on-white «Iniciar sesión»). `tests/design` forbids them.
const base =
  "inline-flex pointer-coarse:min-h-11 items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const sizes: Record<Size, string> = {
  md: "min-h-10 px-4 text-sm",
  sm: "min-h-8 px-3 text-xs",
};
const variants: Record<Variant, string> = {
  primary: "bg-accent text-ink hover:bg-accent-hover",
  secondary: "border border-line bg-white text-ink hover:bg-canvas",
  ghost: "text-blue hover:bg-info-bg",
  // Irreversible actions (V1.8 `.action.danger`): never the orange of a normal CTA.
  danger: "border border-danger/40 bg-white text-danger hover:bg-danger-bg",
  // Secondary action on the navy landing.
  inverse: "border border-white/40 text-white hover:bg-white/10",
  // v1.8 `.action.link` on the «Mi espacio» hero («Estado de mi perfil ↗»): text only, no border.
  inverseLink: "text-hero-text hover:bg-white/10",
};

export function buttonClass(variant: Variant = "secondary", extra = "", size: Size = "md") {
  return `${base} ${sizes[size]} ${variants[variant]} ${extra}`;
}
