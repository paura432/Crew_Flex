"use client";

import { callAction } from "@/components/ui/Notice";
import { useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { controlClass, describedBy, Field } from "@/components/ui/Field";
import { QUALIFICATION_CATEGORIES, type QualificationType } from "@/domain/qualification";
import type { RequirementLevel } from "@/domain/work-requirement";
import { SHIFTS, URGENCIES } from "@/domain/work-requirement";
import { resolveFieldErrors } from "@/i18n/validation";
import { useIdempotencyKey } from "@/lib/idempotency";
import { toUtcIso } from "@/lib/format";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/errors";
import { createWorkRequirementInput } from "@/lib/validation/work-requirement";
import { createRequirementAction } from "../actions";

export function RequirementForm({
  organizationId,
  qualificationTypes,
}: {
  organizationId: string;
  qualificationTypes: QualificationType[];
}) {
  const t = useTranslations("organization.new");
  const tDomain = useTranslations("domain");
  const tRoot = useTranslations();
  const [selected, setSelected] = useState<Map<string, RequirementLevel>>(new Map());
  const [rawErrors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<{ message: string; requestId?: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const idempotency = useIdempotencyKey();
  const errors = resolveFieldErrors(tRoot, rawErrors);

  const toggle = (id: string, include: boolean) =>
    setSelected((current) => {
      const next = new Map(current);
      if (include) next.set(id, "hard");
      else next.delete(id);
      return next;
    });
  const setLevel = (id: string, level: RequirementLevel) =>
    setSelected((current) => new Map(current).set(id, level));

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      organizationId,
      title: String(form.get("title") ?? ""),
      location: String(form.get("location") ?? ""),
      startsAt: toUtcIso(String(form.get("startsAt") ?? "")),
      endsAt: toUtcIso(String(form.get("endsAt") ?? "")),
      shift: String(form.get("shift") ?? ""),
      headcount: Number(form.get("headcount")),
      urgency: String(form.get("urgency") ?? ""),
      qualifications: [...selected].map(([qualificationTypeId, level]) => ({
        qualificationTypeId,
        level,
      })),
    };

    const parsed = createWorkRequirementInput.safeParse(payload);
    setServerError(null);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await callAction(() =>
        createRequirementAction(parsed.data, idempotency.keyFor(parsed.data)),
      );
      // On success the action redirects; we only get here on failure.
      if (result.status === "error") {
        setErrors(result.fieldErrors ?? {});
        setServerError({
          message:
            result.code === "FORBIDDEN"
              ? t("forbidden")
              : result.code === "NETWORK_ERROR"
                ? t("unreachable")
                : result.code === "UNAUTHORIZED"
                  ? t("sessionExpired")
                  : result.code === "VALIDATION_ERROR"
                    ? tRoot("common.checkFields")
                    : tRoot(`api.${result.code}.description`),
          requestId: result.requestId,
        });
      }
    });
  }

  const byCategory = Object.groupBy(qualificationTypes, (q) => q.category);
  const input = (id: string) => ({
    id,
    name: id,
    className: controlClass,
    "aria-invalid": Boolean(errors[id]),
    "aria-describedby": describedBy(id, errors[id]),
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-8">
      {serverError && (
        <div
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-sm text-danger"
        >
          <p className="font-semibold">{serverError.message}</p>
          {serverError.requestId && (
            <p className="mt-1 font-mono text-xs">
              {tRoot("common.reference", { id: serverError.requestId })}
            </p>
          )}
        </div>
      )}

      <fieldset className="grid gap-5 md:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold tracking-[0.12em] text-muted uppercase">
          {t("sectionNeed")}
        </legend>
        <Field id="title" label={t("fields.title")} error={errors.title}>
          <input {...input("title")} placeholder={t("titlePlaceholder")} />
        </Field>
        <Field id="location" label={t("fields.location")} error={errors.location}>
          <input {...input("location")} placeholder={t("locationPlaceholder")} />
        </Field>
        <Field id="headcount" label={t("fields.headcount")} error={errors.headcount}>
          <input {...input("headcount")} type="number" min={1} max={50} defaultValue={1} />
        </Field>
        <Field id="urgency" label={t("fields.urgency")} error={errors.urgency}>
          <select {...input("urgency")} defaultValue="planned">
            {URGENCIES.map((u) => (
              <option key={u} value={u}>
                {tDomain(`urgency.${u}`)}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>

      <fieldset className="grid gap-5 md:grid-cols-3">
        <legend className="mb-3 text-sm font-semibold tracking-[0.12em] text-muted uppercase">
          {t("sectionPeriod")}
        </legend>
        <Field id="startsAt" label={t("fields.starts")} error={errors.startsAt}>
          <input {...input("startsAt")} type="datetime-local" />
        </Field>
        <Field id="endsAt" label={t("fields.ends")} error={errors.endsAt}>
          <input {...input("endsAt")} type="datetime-local" />
        </Field>
        <Field id="shift" label={t("fields.shift")} error={errors.shift}>
          <select {...input("shift")} defaultValue="day">
            {SHIFTS.map((s) => (
              <option key={s} value={s}>
                {tDomain(`shift.${s}`)}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>

      <fieldset aria-describedby={errors.qualifications ? "qualifications-error" : undefined}>
        <legend className="mb-1 text-sm font-semibold tracking-[0.12em] text-muted uppercase">
          {t("sectionQualifications")}
        </legend>
        <p className="mb-4 text-sm text-muted">
          {t.rich("qualificationsIntro", {
            b: (chunks) => <strong className="text-ink">{chunks}</strong>,
          })}
        </p>
        {errors.qualifications && (
          <p id="qualifications-error" className="mb-3 text-sm font-medium text-danger">
            {errors.qualifications}
          </p>
        )}
        <div className="grid gap-6 md:grid-cols-2">
          {QUALIFICATION_CATEGORIES.map((category) => {
            const items = byCategory[category];
            if (!items?.length) return null;
            return (
              <div key={category}>
                <h3 className="mb-2 text-sm font-semibold">{tDomain(`category.${category}`)}</h3>
                <ul className="divide-y divide-line rounded-lg border border-line bg-white">
                  {items.map((q) => {
                    const level = selected.get(q.id);
                    const checkboxId = `q-${q.id}`;
                    return (
                      <li key={q.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                        <input
                          id={checkboxId}
                          type="checkbox"
                          className="size-4"
                          checked={level !== undefined}
                          onChange={(e) => toggle(q.id, e.target.checked)}
                        />
                        <label
                          htmlFor={checkboxId}
                          className="min-w-0 flex-1 text-sm pointer-coarse:py-3"
                        >
                          <span className="font-mono font-semibold">{q.code}</span>{" "}
                          <span className="text-muted">{q.name}</span>
                        </label>
                        {level && (
                          <select
                            aria-label={t("levelAria", { code: q.code })}
                            value={level}
                            onChange={(e) => setLevel(q.id, e.target.value as RequirementLevel)}
                            className="min-h-9 pointer-coarse:min-h-11 rounded-md border border-line bg-white px-2 text-sm"
                          >
                            <option value="hard">{tDomain("level.hard")}</option>
                            <option value="soft">{tDomain("level.soft")}</option>
                          </select>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
          {pending ? t("submitting") : t("submit")}
        </Button>
        <ButtonLink href="/app/organization/requirements">{tRoot("common.cancel")}</ButtonLink>
      </div>
    </form>
  );
}
