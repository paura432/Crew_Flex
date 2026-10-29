"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { controlClass, describedBy, Field } from "@/components/ui/Field";
import { closeAccountWord } from "@/lib/validation/account";
import { closeAccountAction } from "../actions";
import { initialCloseAccountState } from "../state";

/**
 * v1.8 «Cerrar cuenta» (`Account.jsx`): a closed disclosure with what happens, the word to type and the
 * irreversible button. Nothing is sent until the word matches (the server checks it again).
 */
export function CloseAccountForm() {
  const t = useTranslations("account.data");
  const tCommon = useTranslations("common");
  const word = closeAccountWord(useLocale());
  const [state, formAction, pending] = useActionState(closeAccountAction, initialCloseAccountState);
  const error =
    state.status !== "error"
      ? undefined
      : state.code === "CONFIRM_WORD"
        ? t("errors.CONFIRM_WORD", { word })
        : state.code === "ACTIVE_COMMITMENTS"
          ? t("errors.ACTIVE_COMMITMENTS")
          : t("errors.generic");

  return (
    <details className="rounded-lg border border-danger/30 p-4" open={state.status === "error"}>
      <summary className="cursor-pointer font-semibold text-danger pointer-coarse:min-h-11">
        {t("closeTitle")}
      </summary>
      <form action={formAction} className="mt-3 flex max-w-prose flex-col gap-3" noValidate>
        <p className="text-sm">{t("closeText")}</p>
        <p className="text-sm text-muted">{t("closeDetails")}</p>
        <Field id="confirm" label={t("confirmLabel", { word })} error={error}>
          <input
            id="confirm"
            name="confirm"
            type="text"
            autoComplete="off"
            spellCheck={false}
            required
            className={controlClass}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy("confirm", error)}
          />
        </Field>
        {state.status === "error" && state.requestId && state.code !== "CONFIRM_WORD" && (
          <p className="text-sm text-muted">{tCommon("reference", { id: state.requestId })}</p>
        )}
        <div>
          <Button type="submit" variant="danger" disabled={pending} aria-busy={pending}>
            {pending ? t("submitting") : t("submit")}
          </Button>
        </div>
      </form>
    </details>
  );
}
