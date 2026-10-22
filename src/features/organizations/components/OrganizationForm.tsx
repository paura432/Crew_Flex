"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { controlClass, describedBy, Field } from "@/components/ui/Field";
import { actionErrorCopy, callAction, Notice, type NoticeState } from "@/components/ui/Notice";
import {
  ORGANIZATION_NAME_MAX,
  ORGANIZATION_TYPES,
  TAX_ADDRESS_MAX,
  TAX_ID_MAX,
} from "@/domain/organization";
import type { Locale } from "@/i18n/config";
import { resolveFieldErrors } from "@/i18n/validation";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/errors";
import { updateOrganizationInput } from "@/lib/validation/organization";
import type { OrganizationProfile } from "@/types/api";
import { updateOrganizationAction } from "../actions";
import { euCountryOptions, initialCountry } from "../countries";

/**
 * «Organización» (v1.8 connected `Account.jsx:64`): name («Razón social»), type, fiscal id and
 * address, EU country. One form, one save, full replacement; the version it was rendered with goes
 * back so a concurrent change is a conflict, never an overwrite.
 */
export function OrganizationForm({ organization }: { organization: OrganizationProfile }) {
  const t = useTranslations("organization.profile");
  const tRoot = useTranslations();
  const locale = useLocale() as Locale;
  const [rawErrors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [pending, startTransition] = useTransition();
  const errors = resolveFieldErrors(tRoot, rawErrors);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      organizationId: organization.id,
      expectedUpdatedAt: organization.updatedAt,
      name: String(form.get("name") ?? ""),
      type: String(form.get("type") ?? ""),
      country: String(form.get("country") ?? ""),
      taxId: String(form.get("taxId") ?? ""),
      taxAddress: String(form.get("taxAddress") ?? ""),
    };
    const parsed = updateOrganizationInput.safeParse(payload);
    setNotice(null);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await callAction(() => updateOrganizationAction(parsed.data));
      if (result.ok) {
        setNotice({ tone: "ok", text: t("saved") });
      } else {
        setErrors(result.fieldErrors ?? {});
        // Optimistic concurrency: nothing was saved; the form keeps the user's input.
        setNotice(
          result.code === "CONFLICT"
            ? { tone: "danger", text: t("conflict"), requestId: result.requestId }
            : actionErrorCopy(tRoot, result),
        );
      }
    });
  }

  const input = (id: string, hint?: string) => ({
    id,
    name: id,
    className: controlClass,
    required: true,
    "aria-invalid": Boolean(errors[id]),
    "aria-describedby": describedBy(id, errors[id], hint),
    disabled: pending,
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Notice
        notice={notice}
        referenceLabel={tRoot("common.reference", { id: notice?.requestId ?? "" })}
      />
      <div className="grid gap-5 md:grid-cols-2">
        <Field id="name" label={t("name")} hint={t("nameHint")} error={errors.name}>
          <input
            {...input("name", t("nameHint"))}
            defaultValue={organization.name}
            maxLength={ORGANIZATION_NAME_MAX}
            autoComplete="organization"
          />
        </Field>
        <Field id="type" label={t("type")} error={errors.type}>
          <select {...input("type")} defaultValue={organization.type}>
            {ORGANIZATION_TYPES.map((value) => (
              <option key={value} value={value}>
                {tRoot(`auth.orgType.${value}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="taxId" label={t("taxId")} error={errors.taxId}>
          <input
            {...input("taxId")}
            defaultValue={organization.taxId ?? ""}
            maxLength={TAX_ID_MAX}
            autoComplete="off"
          />
        </Field>
        <Field id="country" label={t("country")} error={errors.country}>
          <select {...input("country")} defaultValue={initialCountry(organization.country)}>
            <option value="" disabled>
              {t("countryChoose")}
            </option>
            {euCountryOptions(locale).map(({ code, name }) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <div className="md:col-span-2">
          <Field id="taxAddress" label={t("taxAddress")} error={errors.taxAddress}>
            <textarea
              {...input("taxAddress")}
              rows={2}
              defaultValue={organization.taxAddress ?? ""}
              maxLength={TAX_ADDRESS_MAX}
              autoComplete="street-address"
            />
          </Field>
        </div>
      </div>
      {errors.form && <p className="text-sm font-medium text-danger">{errors.form}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
          {pending ? tRoot("common.saving") : t("save")}
        </Button>
        <p className="text-sm text-muted">{t("reviewResetNote")}</p>
      </div>
    </form>
  );
}
