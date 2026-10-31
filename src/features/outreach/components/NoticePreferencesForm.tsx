"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { controlClass, Field } from "@/components/ui/Field";
import { describedBy } from "@/components/ui/field-ids";
import { Notice, type NoticeState } from "@/components/ui/Notice";
import { actionErrorCopy, callAction } from "@/components/ui/action-result";
import { MOBILIZATION_HOURS_MAX, type NoticePreferences } from "@/domain/outreach";
import { resolveFieldErrors } from "@/i18n/validation";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/errors";
import { noticePreferencesInput } from "@/lib/validation/outreach";
import { saveNoticePreferencesAction } from "../actions";
import { preferencesFromForm } from "../form";

const checkboxLabel =
  "flex min-h-10 items-center gap-2 text-sm pointer-coarse:min-h-11 has-disabled:opacity-70";

/**
 * N-10, v1.8 connected «Avisos de oportunidades» (`Account.jsx:81`): what decides whether an Urgent/AOG
 * distribution reaches this professional. Its own save, apart from the passport. Validated here, in the
 * server action, the Edge Function and the database (the zone against the database's list).
 */
export function NoticePreferencesForm({ preferences }: { preferences: NoticePreferences }) {
  const t = useTranslations("outreach.preferences");
  const tRoot = useTranslations();
  const [rawErrors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [pending, startTransition] = useTransition();
  const errors = resolveFieldErrors(tRoot, rawErrors);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = noticePreferencesInput.safeParse(
      preferencesFromForm(new FormData(event.currentTarget)),
    );
    setNotice(null);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      setNotice({ tone: "danger", text: tRoot("common.checkFields") });
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await callAction(() => saveNoticePreferencesAction(parsed.data));
      if (result.ok) {
        setNotice({ tone: "ok", text: t("saved") });
      } else {
        setErrors(result.fieldErrors ?? {});
        setNotice(actionErrorCopy(tRoot, result));
      }
    });
  }

  const input = (id: keyof NoticePreferences, hint?: string) => ({
    id: `np-${id}`,
    name: id,
    className: controlClass,
    "aria-invalid": Boolean(errors[id]),
    "aria-describedby": describedBy(`np-${id}`, errors[id], hint),
    disabled: pending,
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <p className="max-w-prose text-sm text-muted">{t("description")}</p>
      <fieldset className="space-y-1">
        <legend className="sr-only">{t("consents")}</legend>
        <label className={checkboxLabel}>
          <input
            type="checkbox"
            name="urgentOptIn"
            className="size-4"
            defaultChecked={preferences.urgentOptIn}
            disabled={pending}
          />
          {t("urgent")}
        </label>
        <label className={checkboxLabel}>
          <input
            type="checkbox"
            name="aogOptIn"
            className="size-4"
            defaultChecked={preferences.aogOptIn}
            disabled={pending}
          />
          {t("aog")}
        </label>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="np-mobilizationHours"
          label={t("mobilization")}
          hint={t("mobilizationHint")}
          error={errors.mobilizationHours}
        >
          <input
            {...input("mobilizationHours", t("mobilizationHint"))}
            type="number"
            inputMode="numeric"
            min={0}
            max={MOBILIZATION_HOURS_MAX}
            step={1}
            defaultValue={preferences.mobilizationHours ?? ""}
          />
        </Field>
        <Field
          id="np-timeZone"
          label={t("timeZone")}
          hint={t("timeZoneHint")}
          error={errors.timeZone}
        >
          <input
            {...input("timeZone", t("timeZoneHint"))}
            type="text"
            autoComplete="off"
            spellCheck={false}
            defaultValue={preferences.timeZone}
          />
        </Field>
        <Field id="np-quietStart" label={t("quietStart")} error={errors.quietStart}>
          <input {...input("quietStart")} type="time" defaultValue={preferences.quietStart ?? ""} />
        </Field>
        <Field id="np-quietEnd" label={t("quietEnd")} error={errors.quietEnd}>
          <input {...input("quietEnd")} type="time" defaultValue={preferences.quietEnd ?? ""} />
        </Field>
      </div>
      <p className="max-w-prose text-sm text-muted">{t("note")}</p>
      <Notice
        notice={notice}
        referenceLabel={tRoot("common.reference", { id: notice?.requestId ?? "" })}
      />
      <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
        {t("save")}
      </Button>
    </form>
  );
}
