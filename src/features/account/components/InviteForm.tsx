"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { controlClass, Field } from "@/components/ui/Field";
import { describedBy } from "@/components/ui/field-ids";
import { resolveFieldErrors } from "@/i18n/validation";
import { INVITABLE_ACCOUNT_TYPES } from "@/lib/validation/account";
import { createInvitationAction } from "../actions";
import { initialInviteState } from "../state";

const KNOWN_ERRORS = ["CONFLICT", "NOT_FOUND", "FORBIDDEN", "VALIDATION_ERROR"] as const;
const errorKey = (code: string) =>
  (KNOWN_ERRORS as readonly string[]).includes(code)
    ? (code as (typeof KNOWN_ERRORS)[number])
    : "generic";

/** v1.8 «Invitar a la beta»: e-mail + account type (never «Administración»); the code is never shown. */
export function InviteForm() {
  const t = useTranslations("account.invite");
  const tRoot = useTranslations();
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState(createInvitationAction, initialInviteState);
  const errors = state.status === "error" ? resolveFieldErrors(tRoot, state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? (state.values ?? {}) : {};

  return (
    <form
      key={state.status === "sent" ? `sent-${state.email}` : "form"}
      action={formAction}
      className="flex flex-col gap-4"
      noValidate
    >
      {state.status === "sent" && (
        <p
          role="status"
          className="rounded-lg border border-ok/30 bg-ok-bg px-4 py-3 text-sm text-ok"
        >
          {t("sent", { email: state.email })}
        </p>
      )}
      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger-bg px-3 py-2 text-sm font-medium text-danger"
        >
          {t(`errors.${errorKey(state.code)}`)}
          {state.requestId && (
            <span className="block font-normal">
              {tCommon("reference", { id: state.requestId })}
            </span>
          )}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="invite-email" label={t("email")} error={errors.email}>
          <input
            id="invite-email"
            name="email"
            type="email"
            autoComplete="off"
            required
            defaultValue={values.email}
            className={controlClass}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={describedBy("invite-email", errors.email)}
          />
        </Field>
        <Field id="invite-type" label={t("accountType")} error={errors.accountType}>
          <select
            id="invite-type"
            name="accountType"
            defaultValue={values.accountType || "professional"}
            className={controlClass}
            aria-invalid={Boolean(errors.accountType)}
            aria-describedby={describedBy("invite-type", errors.accountType)}
          >
            {INVITABLE_ACCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>
                {tRoot(`domain.accountType.${type}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div>
        <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
          {pending ? t("submitting") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
