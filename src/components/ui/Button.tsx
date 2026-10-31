import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonClass, type Size, type Variant } from "./button-class";

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, className, size)} {...props} />;
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, className, size)} {...props} />;
}
