"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { controlClass, describedBy, Field } from "@/components/ui/Field";
import { actionErrorCopy, Notice, type NoticeState } from "@/components/ui/Notice";
import { Panel } from "@/components/ui/Panel";
import { StatusChip, type Tone } from "@/components/ui/StatusChip";
import type {
  QualificationCategory,
  QualificationType,
  VerificationStatus,
} from "@/domain/qualification";
import { formatDate } from "@/lib/format";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/errors";
import {
  createQualificationInput,
  expiryIssueFor,
  updateQualificationInput,
} from "@/lib/validation/professional";
import type { Qualification } from "@/types/api";
import type { ProfileActionResult } from "../../professional/action-result";
import {
  addQualificationAction,
  deleteQualificationAction,
  updateQualificationAction,
} from "../actions";

export const CATEGORY_LABEL: Record<QualificationCategory, string> = {
  LICENSE: "Licences",
  TYPE_RATING: "Type ratings",
  TRAINING: "Training and courses",
  APPROVAL: "Approvals",
  SKILL: "Skills",
};
const CATEGORY_ORDER = Object.keys(CATEGORY_LABEL) as QualificationCategory[];

export const VERIFICATION_TONE: Record<VerificationStatus, Tone> = {
  verified: "ok",
  pending: "warn",
  rejected: "danger",
  expired: "danger",
};
const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  verified: "Verified",
  pending: "Pending review",
  rejected: "Rejected",
  expired: "Expired",
};

const toNull = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").trim();
  return text === "" ? null : text;
};

/**
 * Declaration ≠ verification: here a professional declares, edits dates, withdraws or removes.
 * The review state is shown, never edited (BR-2.6). Hard requirements only accept `verified`.
 */
export function QualificationsManager({
  qualifications,
  catalog,
}: {
  qualifications: Qualification[];
  catalog: QualificationType[];
}) {
  const [editing, setEditing] = useState<Qualification | null>(null);
  const [typeId, setTypeId] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [pending, startTransition] = useTransition();

  const heldTypeIds = new Set(qualifications.map((q) => q.type.id));
  const available = catalog.filter((t) => !heldTypeIds.has(t.id));
  const selectedType = catalog.find((t) => t.id === typeId) ?? null;
  const byCategory = Object.groupBy(qualifications, (q) => q.type.category);

  function run(label: string, task: () => Promise<ProfileActionResult>) {
    setNotice(null);
    startTransition(async () => {
      const result = await task();
      if (result.ok) {
        setNotice({ tone: "ok", text: label });
        setEditing(null);
        setErrors({});
      } else {
        setErrors(result.fieldErrors ?? {});
        setNotice(actionErrorCopy(result));
      }
    });
  }

  function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      qualificationTypeId: String(form.get("qualificationTypeId") ?? ""),
      issuedAt: toNull(form.get("issuedAt")),
      expiresAt: toNull(form.get("expiresAt")),
    };
    const parsed = createQualificationInput.safeParse(payload);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    const expiry = selectedType ? expiryIssueFor(selectedType, parsed.data.expiresAt) : null;
    if (expiry) {
      setErrors({ [expiry.path]: expiry.message });
      return;
    }
    setErrors({});
    const code = selectedType?.code ?? "Qualification";
    run(`${code} declared — pending review until verified.`, () =>
      addQualificationAction(parsed.data),
    );
  }

  function onEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const payload = {
      issuedAt: toNull(form.get("issuedAt")),
      expiresAt: toNull(form.get("expiresAt")),
      status: String(form.get("status") ?? ""),
    };
    const parsed = updateQualificationInput.safeParse(payload);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    const expiry =
      parsed.data.status === "active" ? expiryIssueFor(editing.type, parsed.data.expiresAt) : null;
    if (expiry) {
      setErrors({ [expiry.path]: expiry.message });
      return;
    }
    setErrors({});
    const current = editing;
    const changedDates =
      current.issuedAt !== parsed.data.issuedAt || current.expiresAt !== parsed.data.expiresAt;
    const label =
      changedDates && current.verificationStatus !== "pending"
        ? `${current.type.code} updated — back to pending review because its dates changed.`
        : `${current.type.code} updated.`;
    run(label, () => updateQualificationAction(current.id, parsed.data));
  }

  const input = (id: string, hint?: string) => ({
    id,
    name: id,
    className: controlClass,
    "aria-invalid": Boolean(errors[id]),
    "aria-describedby": describedBy(id, errors[id], hint),
    disabled: pending,
  });

  const expiryHint = (type: QualificationType | null) =>
    type?.requiresExpiry
      ? `${type.code} requires an expiry date`
      : "Leave empty when the qualification does not expire";

  return (
    <div className="space-y-6">
      <Notice notice={notice} />

      <Panel title={editing ? `Edit ${editing.type.code}` : "Declare a qualification"}>
        {editing ? (
          <form key={editing.id} onSubmit={onEdit} noValidate className="space-y-4">
            <p className="text-sm text-muted">
              {editing.type.name}. Review state:{" "}
              <StatusChip tone={VERIFICATION_TONE[editing.verificationStatus]}>
                {VERIFICATION_LABEL[editing.verificationStatus]}
              </StatusChip>
              {editing.verificationStatus !== "pending" && (
                <span className="mt-1 block">
                  Changing the dates sends it back to pending review.
                </span>
              )}
            </p>
            <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
              <Field id="issuedAt" label="Issued" error={errors.issuedAt}>
                <input {...input("issuedAt")} type="date" defaultValue={editing.issuedAt ?? ""} />
              </Field>
              <Field
                id="expiresAt"
                label="Expires"
                hint={expiryHint(editing.type)}
                error={errors.expiresAt}
              >
                <input
                  {...input("expiresAt", expiryHint(editing.type))}
                  type="date"
                  defaultValue={editing.expiresAt ?? ""}
                />
              </Field>
              <Field id="status" label="Held" error={errors.status}>
                <select {...input("status")} defaultValue={editing.status}>
                  <option value="active">Active</option>
                  <option value="withdrawn">Withdrawn (not held)</option>
                </select>
              </Field>
              <div className="flex gap-2">
                <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
                  {pending ? "Saving…" : "Save"}
                </Button>
                <Button
                  onClick={() => {
                    setEditing(null);
                    setErrors({});
                  }}
                  disabled={pending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={onAdd} noValidate className="space-y-4">
            <p className="text-sm text-muted">
              Self-declared qualifications stay <strong className="text-ink">pending</strong> until
              an authorized reviewer verifies them. Only verified ones satisfy hard requirements.
            </p>
            <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
              <Field
                id="qualificationTypeId"
                label="Qualification"
                error={errors.qualificationTypeId}
              >
                <select
                  {...input("qualificationTypeId")}
                  value={typeId}
                  onChange={(e) => setTypeId(e.target.value)}
                >
                  <option value="">Select from the catalog…</option>
                  {CATEGORY_ORDER.map((category) => {
                    const items = available.filter((t) => t.category === category);
                    if (items.length === 0) return null;
                    return (
                      <optgroup key={category} label={CATEGORY_LABEL[category]}>
                        {items.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.code} · {t.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </Field>
              <Field id="issuedAt" label="Issued" error={errors.issuedAt}>
                <input {...input("issuedAt")} type="date" />
              </Field>
              <Field
                id="expiresAt"
                label="Expires"
                hint={expiryHint(selectedType)}
                error={errors.expiresAt}
              >
                <input {...input("expiresAt", expiryHint(selectedType))} type="date" />
              </Field>
              <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
                {pending ? "Saving…" : "Declare"}
              </Button>
            </div>
            {available.length === 0 && (
              <p className="text-sm text-muted">You have declared every type in the catalog.</p>
            )}
          </form>
        )}
        {errors.form && <p className="mt-2 text-sm font-medium text-danger">{errors.form}</p>}
      </Panel>

      {qualifications.length === 0 ? (
        <Panel>
          <p className="text-sm text-muted">
            No qualifications yet. Declare your licence and type ratings above — they enter matching
            once verified.
          </p>
        </Panel>
      ) : (
        CATEGORY_ORDER.map((category) => {
          const items = byCategory[category];
          if (!items?.length) return null;
          return (
            <Panel key={category} title={`${CATEGORY_LABEL[category]} (${items.length})`}>
              <ul className="divide-y divide-line">
                {items.map((q) => (
                  <li
                    key={q.id}
                    className="grid gap-2 py-3 text-sm sm:grid-cols-[6rem_1fr_auto_auto_auto] sm:items-center sm:gap-3"
                  >
                    <span className="font-mono font-semibold">{q.type.code}</span>
                    <span className="min-w-0 text-muted">
                      {q.type.name}
                      <span className="mt-0.5 block text-xs tabular-nums">
                        {q.issuedAt ? `Issued ${formatDate(q.issuedAt)} · ` : ""}
                        {q.expiresAt ? `Valid until ${formatDate(q.expiresAt)}` : "No expiry"}
                      </span>
                    </span>
                    <StatusChip tone={q.status === "withdrawn" ? "neutral" : "info"}>
                      {q.status === "withdrawn" ? "Withdrawn" : "Held"}
                    </StatusChip>
                    <StatusChip tone={VERIFICATION_TONE[q.verificationStatus]}>
                      {VERIFICATION_LABEL[q.verificationStatus]}
                    </StatusChip>
                    <div className="flex gap-2">
                      <Button
                        className="min-h-8 px-3 text-xs"
                        disabled={pending}
                        onClick={() => {
                          setEditing(q);
                          setErrors({});
                          setNotice(null);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        className="min-h-8 px-3 text-xs text-danger"
                        disabled={pending}
                        onClick={() =>
                          run(`${q.type.code} removed.`, () => deleteQualificationAction(q.id))
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          );
        })
      )}
    </div>
  );
}
