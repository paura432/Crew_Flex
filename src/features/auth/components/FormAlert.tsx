"use client";

import { useTranslations } from "next-intl";
import type { AuthFormState } from "../state";

/** Auth errors are mapped by code: the server never ships user-facing prose. */
export function FormAlert({ state }: { state: AuthFormState }) {
  const t = useTranslations("auth.errors");
  if (state.status !== "error") return null;
  return (
    <p
      role="alert"
      className="rounded-lg border border-danger/30 bg-danger-bg px-3 py-2 text-sm font-medium text-danger"
    >
      {t(state.code)}
    </p>
  );
}
