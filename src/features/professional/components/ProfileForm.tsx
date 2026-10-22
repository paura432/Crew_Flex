"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { controlClass, describedBy, Field } from "@/components/ui/Field";
import { actionErrorCopy, callAction, Notice, type NoticeState } from "@/components/ui/Notice";
import { Panel } from "@/components/ui/Panel";
import { useRovingRadio } from "@/components/ui/radio-group";
import {
  MOBILITIES,
  PROFILE_VISIBILITIES,
  TECHNICIAN_STATUSES,
  type ProfessionalProfile,
  type ProfileVisibility,
} from "@/domain/professional";
import { resolveFieldErrors } from "@/i18n/validation";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/errors";
import { updateProfessionalProfileInput } from "@/lib/validation/professional";
import { updateProfileAction } from "../actions";

/**
 * "Mi pasaporte" (prototype S1): identity, experience & mobility, network visibility — the fields
 * the data model justifies. One form, one save, full replacement (no partial updates).
 */
export function ProfileForm({ profile }: { profile: ProfessionalProfile & { updatedAt: string } }) {
  const t = useTranslations("professional.passport");
  const tDomain = useTranslations("domain");
  const tRoot = useTranslations();
  const [visibility, setVisibility] = useState<ProfileVisibility>(profile.visibility);
  const visibilityRadio = useRovingRadio(
    PROFILE_VISIBILITIES.length,
    PROFILE_VISIBILITIES.indexOf(visibility),
    (i) => setVisibility(PROFILE_VISIBILITIES[i]!),
  );
  const [rawErrors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [pending, startTransition] = useTransition();
  const errors = resolveFieldErrors(tRoot, rawErrors);

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
      expectedUpdatedAt: profile.updatedAt,
    };
    const parsed = updateProfessionalProfileInput.safeParse(payload);
    setNotice(null);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await callAction(() => updateProfileAction(parsed.data));
      if (result.ok) {
        setNotice({ tone: "ok", text: t("saved") });
      } else {
        setErrors(result.fieldErrors ?? {});
        // Optimistic concurrency (I-3): nothing was saved; the form keeps the user's input.
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
    "aria-invalid": Boolean(errors[id]),
    "aria-describedby": describedBy(id, errors[id], hint),
    disabled: pending,
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Notice
        notice={notice}
        referenceLabel={tRoot("common.reference", { id: notice?.requestId ?? "" })}
      />

      <Panel title={t("identity")}>
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="displayName" label={t("name")} error={errors.displayName}>
            <input {...input("displayName")} defaultValue={profile.displayName} maxLength={120} />
          </Field>
          <Field
            id="baseLocation"
            label={t("base")}
            hint={t("baseHint")}
            error={errors.baseLocation}
          >
            <input
              {...input("baseLocation", t("baseHint"))}
              defaultValue={profile.baseLocation ?? ""}
              maxLength={80}
              placeholder={t("basePlaceholder")}
            />
          </Field>
        </div>
      </Panel>

      <Panel title={t("experience")}>
        <div className="grid gap-5 md:grid-cols-3">
          <Field id="yearsExperience" label={t("years")} error={errors.yearsExperience}>
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
          <Field id="currentStatus" label={t("status")} error={errors.currentStatus}>
            <select {...input("currentStatus")} defaultValue={profile.currentStatus}>
              {TECHNICIAN_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {tDomain(`technicianStatus.${s}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field id="mobility" label={t("mobility")} error={errors.mobility}>
            <select {...input("mobility")} defaultValue={profile.mobility}>
              {MOBILITIES.map((m) => (
                <option key={m} value={m}>
                  {tDomain(`mobility.${m}`)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Panel>

      <Panel title={t("visibilityTitle")}>
        <p className="mb-4 text-sm text-muted">{t("visibilityIntro")}</p>
        <div
          role="radiogroup"
          aria-label={t("visibilityAria")}
          aria-describedby={errors.visibility ? "visibility-error" : undefined}
          className="grid gap-3 md:grid-cols-3"
        >
          {PROFILE_VISIBILITIES.map((value, i) => {
            const selected = visibility === value;
            return (
              <button
                key={value}
                {...visibilityRadio(i)}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={pending}
                onClick={() => setVisibility(value)}
                className={`rounded-xl border p-4 text-left transition-colors hover:bg-canvas disabled:opacity-60 ${
                  selected ? "border-navy bg-info-bg ring-2 ring-navy" : "border-line bg-white"
                }`}
              >
                <span className="block font-semibold">{tDomain(`visibility.${value}.label`)}</span>
                <span className="mt-1 block text-sm text-muted">
                  {tDomain(`visibility.${value}.detail`)}
                </span>
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
          {pending ? tRoot("common.saving") : tRoot("common.saveChanges")}
        </Button>
      </div>
    </form>
  );
}
