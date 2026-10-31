"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { controlClass, Field } from "@/components/ui/Field";
import { describedBy } from "@/components/ui/field-ids";
import { resolveFieldErrors } from "@/i18n/validation";
import { ORGANIZATION_TYPES, PASSWORD_MAX, PASSWORD_MIN } from "@/lib/validation/auth";
import { signUpAction } from "../actions";
import { initialAuthState } from "../state";
import { FormAlert } from "./FormAlert";

type AccountType = "professional" | "organization";

/**
 * Open sign-up, or — with the invitation flag (T-40) — the invitation's own form: the account type is
 * the invitation's (no choice) and the code travels with the form (the server re-checks both).
 */
export function RegisterForm({
  invitation,
}: {
  invitation?: { code: string; accountType: AccountType };
}) {
  const t = useTranslations("auth.register");
  const tRoot = useTranslations();
  const [state, formAction, pending] = useActionState(signUpAction, initialAuthState);
  const [chosenType, setAccountType] = useState<AccountType>("organization");
  const accountType = invitation?.accountType ?? chosenType;
  const errors = state.status === "error" ? resolveFieldErrors(tRoot, state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? (state.values ?? {}) : {};

  if (state.status === "check_email") {
    return (
      <div role="status" className="rounded-lg border border-ok/30 bg-ok-bg px-4 py-3 text-ok">
        <p className="font-semibold">{t("checkInboxTitle")}</p>
        <p className="text-sm">{t("checkInboxText", { email: state.email })}</p>
      </div>
    );
  }

  const text = (id: string, label: string, props: Record<string, string> = {}) => (
    <Field id={id} label={label} error={errors[id]} hint={props.hint}>
      <input
        id={id}
        name={id}
        type={props.type ?? "text"}
        autoComplete={props.autoComplete}
        defaultValue={props.type === "password" ? undefined : values[id]}
        required
        // Native hint for password managers; the server action validates (noValidate form).
        minLength={props.type === "password" ? PASSWORD_MIN : undefined}
        maxLength={props.type === "password" ? PASSWORD_MAX : undefined}
        className={controlClass}
        aria-invalid={Boolean(errors[id])}
        aria-describedby={describedBy(id, errors[id], props.hint)}
      />
    </Field>
  );

  return (
    <form
      key={state.status === "error" ? JSON.stringify(values) : "initial"}
      action={formAction}
      className="flex flex-col gap-4"
      noValidate
    >
      <FormAlert state={state} />
      {invitation ? (
        <>
          <p className="rounded-lg border border-line bg-canvas px-4 py-3 text-sm">
            {t("invitedAs", { type: tRoot(`domain.accountType.${invitation.accountType}`) })}
          </p>
          <input type="hidden" name="accountType" value={invitation.accountType} />
          <Field id="invitationCode" label={t("invitationCode")} hint={t("invitationCodeHint")}>
            <input
              id="invitationCode"
              name="invitationCode"
              type="text"
              readOnly
              value={invitation.code}
              autoComplete="off"
              spellCheck={false}
              className={`${controlClass} font-mono text-sm`}
              aria-describedby="invitationCode-hint"
            />
          </Field>
        </>
      ) : (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{t("registeringAs")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["organization", t("organization"), t("organizationDetail")],
                ["professional", t("professional"), t("professionalDetail")],
              ] as const
            ).map(([value, label, detail]) => (
              <label
                key={value}
                className="flex cursor-pointer flex-col rounded-lg border border-line bg-white p-3 has-[:checked]:border-accent has-[:checked]:bg-warn-bg/40"
              >
                <span className="flex items-center gap-2 font-semibold">
                  <input
                    type="radio"
                    name="accountType"
                    value={value}
                    checked={accountType === value}
                    onChange={() => setAccountType(value)}
                  />
                  {label}
                </span>
                <span className="text-sm text-muted">{detail}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {text("displayName", t("yourName"), { autoComplete: "name" })}
      {text("email", t("email"), { type: "email", autoComplete: "email" })}
      {text("password", t("password"), {
        type: "password",
        autoComplete: "new-password",
        hint: t("passwordHint"),
      })}

      {accountType === "organization" && (
        <>
          {text("organizationName", t("organizationName"), { autoComplete: "organization" })}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="organizationType"
              label={t("organizationType")}
              error={errors.organizationType}
            >
              <select
                id="organizationType"
                name="organizationType"
                defaultValue={values.organizationType || "mro"}
                className={controlClass}
              >
                {ORGANIZATION_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {tRoot(`auth.orgType.${value}`)}
                  </option>
                ))}
              </select>
            </Field>
            {text("country", t("country"), { hint: t("countryHint"), autoComplete: "country" })}
          </div>
        </>
      )}

      <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
