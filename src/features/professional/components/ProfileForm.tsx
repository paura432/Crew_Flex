"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { controlClass, describedBy, Field } from "@/components/ui/Field";
import { actionErrorCopy, Notice, type NoticeState } from "@/components/ui/Notice";
import { Panel } from "@/components/ui/Panel";
import {
  MOBILITIES,
  PROFILE_VISIBILITIES,
  TECHNICIAN_STATUSES,
  type ProfessionalProfile,
  type ProfileVisibility,
} from "@/domain/professional";
import { MOBILITY_LABEL, TECHNICIAN_STATUS_LABEL } from "@/lib/format";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/errors";
import { updateProfessionalProfileInput } from "@/lib/validation/professional";
import { updateProfileAction } from "../actions";
import { VISIBILITY_COPY } from "./ProfessionalSections";

/**
 * "Mi pasaporte" (prototype S1): identity, experience & mobility, network visibility — the fields
 * the data model justifies. One form, one save, full replacement (no partial updates).
 */
export function ProfileForm({ profile }: { profile: ProfessionalProfile }) {
  const [visibility, setVisibility] = useState<ProfileVisibility>(profile.visibility);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const years = String(form.get("yearsExperience") ?? "").trim();
    const payload = {
      displayName: String(form.get("displayName") ?? ""),
      baseLocation: String(form.get("baseLocation") ?? ""),
      mobility: String(form.get("mobility") ?? ""),
      yearsExperience: years === "" ? null : Number(years),
      currentStatus: String(form.get("currentStatus") ?? ""),
      visibility,
    };
    const parsed = updateProfessionalProfileInput.safeParse(payload);
    setNotice(null);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await updateProfileAction(parsed.data);
      if (result.ok) {
        setNotice({ tone: "ok", text: "Passport updated. Matching uses the new data." });
      } else {
        setErrors(result.fieldErrors ?? {});
        setNotice(actionErrorCopy(result));
      }
    });
  }

  const input = (id: string, hint?: string) => ({
    id,
    name: id,
    className: controlClass,
    "aria-invalid": Boolean(errors[id]),
    "aria-describedby": describedBy(id, errors[id], hint),
    disabled: pending,
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Notice notice={notice} />

      <Panel title="01 · Identity">
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="displayName" label="Professional name" error={errors.displayName}>
            <input {...input("displayName")} defaultValue={profile.displayName} maxLength={120} />
          </Field>
          <Field
            id="baseLocation"
            label="Base"
            hint="Airport or city, e.g. Madrid (MAD)"
            error={errors.baseLocation}
          >
            <input
              {...input("baseLocation", "Airport or city, e.g. Madrid (MAD)")}
              defaultValue={profile.baseLocation ?? ""}
              maxLength={80}
              placeholder="Madrid (MAD)"
            />
          </Field>
        </div>
      </Panel>

      <Panel title="02 · Experience and mobility">
        <div className="grid gap-5 md:grid-cols-3">
          <Field id="yearsExperience" label="Years of experience" error={errors.yearsExperience}>
            <input
              {...input("yearsExperience")}
              type="number"
              min={0}
              max={60}
              step={1}
              inputMode="numeric"
              defaultValue={profile.yearsExperience ?? ""}
            />
          </Field>
          <Field id="currentStatus" label="Current status" error={errors.currentStatus}>
            <select {...input("currentStatus")} defaultValue={profile.currentStatus}>
              {TECHNICIAN_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TECHNICIAN_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="mobility" label="Mobility" error={errors.mobility}>
            <select {...input("mobility")} defaultValue={profile.mobility}>
              {MOBILITIES.map((m) => (
                <option key={m} value={m}>
                  {MOBILITY_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Panel>

      <Panel title="03 · Visibility in the network">
        <p className="mb-4 text-sm text-muted">
          Matching respects your choice. Private profiles never appear to organizations; contact
          always requires your consent.
        </p>
        <div
          role="radiogroup"
          aria-label="Visibility"
          aria-describedby={errors.visibility ? "visibility-error" : undefined}
          className="grid gap-3 md:grid-cols-3"
        >
          {PROFILE_VISIBILITIES.map((value) => {
            const copy = VISIBILITY_COPY[value];
            const selected = visibility === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={pending}
                onClick={() => setVisibility(value)}
                className={`rounded-xl border p-4 text-left transition-colors hover:bg-canvas disabled:opacity-60 ${
                  selected ? "border-navy bg-info-bg ring-2 ring-navy" : "border-line bg-white"
                }`}
              >
                <span className="block font-semibold">{copy.label}</span>
                <span className="mt-1 block text-sm text-muted">{copy.detail}</span>
              </button>
            );
          })}
        </div>
        {errors.visibility && (
          <p id="visibility-error" className="mt-2 text-sm font-medium text-danger">
            {errors.visibility}
          </p>
        )}
      </Panel>

      {errors.form && <p className="text-sm font-medium text-danger">{errors.form}</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
