"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { controlClass, describedBy, Field } from "@/components/ui/Field";
import type { QualificationCategory, QualificationType } from "@/domain/qualification";
import type { RequirementLevel } from "@/domain/work-requirement";
import { SHIFTS, URGENCIES } from "@/domain/work-requirement";
import { SHIFT_LABEL, URGENCY_LABEL } from "@/lib/format";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/errors";
import { createWorkRequirementInput } from "@/lib/validation/work-requirement";
import { createRequirementAction } from "../actions";

const CATEGORY_LABEL: Record<QualificationCategory, string> = {
  LICENSE: "Licences",
  TYPE_RATING: "Type ratings",
  TRAINING: "Training",
  APPROVAL: "Approvals",
  SKILL: "Skills",
};

/** `datetime-local` values are entered and stored as UTC (shown as UTC everywhere). */
const toUtcIso = (local: string) => (local ? `${local}:00Z` : "");

export function RequirementForm({
  organizationId,
  qualificationTypes,
}: {
  organizationId: string;
  qualificationTypes: QualificationType[];
}) {
  const [selected, setSelected] = useState<Map<string, RequirementLevel>>(new Map());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<{ message: string; requestId?: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

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
      const result = await createRequirementAction(parsed.data);
      // On success the action redirects; we only get here on failure.
      if (result.status === "error") {
        setErrors(result.fieldErrors ?? {});
        setServerError({
          message:
            result.code === "FORBIDDEN"
              ? "Your role cannot create requirements in this organization."
              : result.code === "NETWORK_ERROR"
                ? "The service could not be reached. Your data is still here — retry."
                : result.code === "UNAUTHORIZED"
                  ? "Your session expired. Sign in again."
                  : result.message,
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
            <p className="mt-1 font-mono text-xs">Reference: {serverError.requestId}</p>
          )}
        </div>
      )}

      <fieldset className="grid gap-5 md:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold tracking-[0.12em] text-muted uppercase">
          01 · Need
        </legend>
        <Field id="title" label="Title" error={errors.title}>
          <input {...input("title")} placeholder="B1.1 · A320 line maintenance reinforcement" />
        </Field>
        <Field id="location" label="Location" error={errors.location}>
          <input {...input("location")} placeholder="Madrid (MAD)" />
        </Field>
        <Field id="headcount" label="Headcount" error={errors.headcount}>
          <input {...input("headcount")} type="number" min={1} max={50} defaultValue={1} />
        </Field>
        <Field id="urgency" label="Urgency" error={errors.urgency}>
          <select {...input("urgency")} defaultValue="planned">
            {URGENCIES.map((u) => (
              <option key={u} value={u}>
                {URGENCY_LABEL[u]}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>

      <fieldset className="grid gap-5 md:grid-cols-3">
        <legend className="mb-3 text-sm font-semibold tracking-[0.12em] text-muted uppercase">
          02 · Period (UTC)
        </legend>
        <Field id="startsAt" label="Starts (UTC)" error={errors.startsAt}>
          <input {...input("startsAt")} type="datetime-local" />
        </Field>
        <Field id="endsAt" label="Ends (UTC)" error={errors.endsAt}>
          <input {...input("endsAt")} type="datetime-local" />
        </Field>
        <Field id="shift" label="Shift" error={errors.shift}>
          <select {...input("shift")} defaultValue="day">
            {SHIFTS.map((s) => (
              <option key={s} value={s}>
                {SHIFT_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>

      <fieldset aria-describedby={errors.qualifications ? "qualifications-error" : undefined}>
        <legend className="mb-1 text-sm font-semibold tracking-[0.12em] text-muted uppercase">
          03 · Qualifications
        </legend>
        <p className="mb-4 text-sm text-muted">
          <strong className="text-ink">Hard</strong> requirements filter candidates out;{" "}
          <strong className="text-ink">soft</strong> ones only affect the score. At least one hard
          requirement is needed.
        </p>
        {errors.qualifications && (
          <p id="qualifications-error" className="mb-3 text-sm font-medium text-danger">
            {errors.qualifications}
          </p>
        )}
        <div className="grid gap-6 md:grid-cols-2">
          {(Object.keys(CATEGORY_LABEL) as QualificationCategory[]).map((category) => {
            const items = byCategory[category];
            if (!items?.length) return null;
            return (
              <div key={category}>
                <h3 className="mb-2 text-sm font-semibold">{CATEGORY_LABEL[category]}</h3>
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
                        <label htmlFor={checkboxId} className="min-w-0 flex-1 text-sm">
                          <span className="font-mono font-semibold">{q.code}</span>{" "}
                          <span className="text-muted">{q.name}</span>
                        </label>
                        {level && (
                          <select
                            aria-label={`${q.code} requirement level`}
                            value={level}
                            onChange={(e) => setLevel(q.id, e.target.value as RequirementLevel)}
                            className="min-h-9 rounded-md border border-line bg-white px-2 text-sm"
                          >
                            <option value="hard">Hard</option>
                            <option value="soft">Soft</option>
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
          {pending ? "Creating…" : "Create requirement"}
        </Button>
        <ButtonLink href="/app/organization/requirements">Cancel</ButtonLink>
      </div>
    </form>
  );
}
