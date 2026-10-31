"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { controlClass, Field } from "@/components/ui/Field";
import { describedBy } from "@/components/ui/field-ids";
import { Notice, type NoticeState } from "@/components/ui/Notice";
import { actionErrorCopy, callAction } from "@/components/ui/action-result";
import { CLIENT_EMAIL_MAX, CLIENT_NAME_MAX } from "@/domain/recruiter";
import { resolveFieldErrors } from "@/i18n/validation";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/errors";
import { addRepresentedClientInput } from "@/lib/validation/recruiter";
import { addClientAction } from "../actions";

/**
 * v1.8 «Nuevo cliente» + «Correo del cliente» → «Añadir cliente» (Company2.jsx:211). The client is saved
 * `pending` (T-130): «Cliente guardado» says it waits for the administration's evidence.
 */
export function AddClientForm({ organizationId }: { organizationId: string }) {
  const t = useTranslations("recruiter.clients");
  const tRoot = useTranslations();
  const [rawErrors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [pending, startTransition] = useTransition();
  const errors = resolveFieldErrors(tRoot, rawErrors);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const input = {
      organizationId,
      name: String(data.get("clientName") ?? ""),
      contactEmail: String(data.get("clientEmail") ?? ""),
    };
    setNotice(null);
    const parsed = addRepresentedClientInput.safeParse(input);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await callAction(() => addClientAction(input));
      if (result.ok) {
        form.reset();
        setNotice({ tone: "ok", text: t("added") });
        return;
      }
      setErrors(result.fieldErrors ?? {});
      setNotice(
        result.code === "CONFLICT"
          ? { tone: "danger", text: t("duplicate"), requestId: result.requestId }
          : result.code === "FORBIDDEN"
            ? { tone: "danger", text: t("notAgency"), requestId: result.requestId }
            : actionErrorCopy(tRoot, result),
      );
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 border-t border-line pt-4">
      <h3 className="text-sm font-semibold">{t("formTitle")}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="clientName" label={t("name")} error={errors.name}>
          <input
            id="clientName"
            name="clientName"
            required
            maxLength={CLIENT_NAME_MAX}
            autoComplete="organization"
            className={controlClass}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={describedBy("clientName", errors.name)}
            disabled={pending}
          />
        </Field>
        <Field
          id="clientEmail"
          label={t("email")}
          hint={t("emailHint")}
          error={errors.contactEmail}
        >
          <input
            id="clientEmail"
            name="clientEmail"
            type="email"
            maxLength={CLIENT_EMAIL_MAX}
            autoComplete="off"
            className={controlClass}
            aria-invalid={Boolean(errors.contactEmail)}
            aria-describedby={describedBy("clientEmail", errors.contactEmail, t("emailHint"))}
            disabled={pending}
          />
        </Field>
      </div>
      <Notice
        notice={notice}
        referenceLabel={tRoot("common.reference", { id: notice?.requestId ?? "" })}
      />
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? t("adding") : t("add")}
      </Button>
    </form>
  );
}
