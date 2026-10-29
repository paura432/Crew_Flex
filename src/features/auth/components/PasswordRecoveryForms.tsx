"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { controlClass, describedBy, Field } from "@/components/ui/Field";
import { resolveFieldErrors } from "@/i18n/validation";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/validation/auth";
import { requestPasswordResetAction, updatePasswordAction } from "../actions";
import { initialAuthState } from "../state";
import { FormAlert } from "./FormAlert";

/** Step 1: ask for the recovery e-mail. Same confirmation whether or not the account exists. */
export function ForgotPasswordForm() {
  const t = useTranslations("auth.recovery");
  const tRoot = useTranslations();
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialAuthState);
  const errors = state.status === "error" ? resolveFieldErrors(tRoot, state.fieldErrors ?? {}) : {};

  if (state.status === "check_email") {
    return (
      <div role="status" className="rounded-lg border border-ok/30 bg-ok-bg px-4 py-3 text-ok">
        <p className="font-semibold">{t("sentTitle")}</p>
        <p className="text-sm">{t("sentText", { email: state.email })}</p>
      </div>
    );
  }
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormAlert state={state} />
      <Field id="email" label={t("email")} error={errors.email}>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.status === "error" ? state.values?.email : undefined}
          required
          className={controlClass}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={describedBy("email", errors.email)}
        />
      </Field>
      <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
        {pending ? t("sending") : t("send")}
      </Button>
    </form>
  );
}

/** Step 2 (inside the recovery session opened by the e-mail link): choose the new password. */
export function ResetPasswordForm() {
  const t = useTranslations("auth.recovery");
  const tRoot = useTranslations();
  const [state, formAction, pending] = useActionState(updatePasswordAction, initialAuthState);
  const errors = state.status === "error" ? resolveFieldErrors(tRoot, state.fieldErrors ?? {}) : {};
  const field = (id: "password" | "confirm", label: string, hint?: string) => (
    <Field id={id} label={label} error={errors[id]} hint={hint}>
      <input
        id={id}
        name={id}
        type="password"
        autoComplete="new-password"
        required
        // Native hint for password managers; the server action validates (noValidate form).
        minLength={id === "password" ? PASSWORD_MIN : undefined}
        maxLength={PASSWORD_MAX}
        className={controlClass}
        aria-invalid={Boolean(errors[id])}
        aria-describedby={describedBy(id, errors[id], hint)}
      />
    </Field>
  );
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormAlert state={state} />
      {field("password", t("newPassword"), t("passwordHint"))}
      {field("confirm", t("confirmPassword"))}
      <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
