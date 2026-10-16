"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { controlClass, describedBy, Field } from "@/components/ui/Field";
import { resolveFieldErrors } from "@/i18n/validation";
import { signInAction } from "../actions";
import { initialAuthState } from "../state";
import { FormAlert } from "./FormAlert";

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("auth.signIn");
  const tRoot = useTranslations();
  const [state, formAction, pending] = useActionState(signInAction, initialAuthState);
  const errors = state.status === "error" ? resolveFieldErrors(tRoot, state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? (state.values ?? {}) : {};

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next ?? "/app"} />
      <FormAlert state={state} />
      <Field id="email" label={t("email")} error={errors.email}>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={values.email}
          required
          className={controlClass}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={describedBy("email", errors.email)}
        />
      </Field>
      <Field id="password" label={t("password")} error={errors.password}>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={controlClass}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={describedBy("password", errors.password)}
        />
      </Field>
      <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
