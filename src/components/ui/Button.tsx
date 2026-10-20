import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const base =
  "inline-flex min-h-10 pointer-coarse:min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-ink hover:bg-accent-hover",
  secondary: "border border-line bg-white text-ink hover:bg-canvas",
  ghost: "text-blue hover:bg-info-bg",
  // Irreversible actions (V1.8 `.action.danger`): never the orange of a normal CTA.
  danger: "border border-danger/40 bg-white text-danger hover:bg-danger-bg",
};

export function buttonClass(variant: Variant = "secondary", extra = "") {
  return `${base} ${variants[variant]} ${extra}`;
}

export function Button({
  variant = "secondary",
  className = "",
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({
  variant = "secondary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}
