"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { controlClass, describedBy, Field } from "@/components/ui/Field";
import { actionErrorCopy, callAction, Notice, type NoticeState } from "@/components/ui/Notice";
import { Panel } from "@/components/ui/Panel";
import { EXPIRY_TONE, StatusChip, type Tone } from "@/components/ui/StatusChip";
import { documentExpiryState } from "@/domain/documents";
import {
  QUALIFICATION_CATEGORIES,
  type QualificationType,
  type VerificationStatus,
} from "@/domain/qualification";
import { formatDate } from "@/i18n/format";
import { resolveFieldErrors } from "@/i18n/validation";
import { useIdempotencyKey } from "@/lib/idempotency";
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
import { EvidenceLine } from "./EvidenceLine";

export const VERIFICATION_TONE: Record<VerificationStatus, Tone> = {
  verified: "ok",
  pending: "warn",
  rejected: "danger",
  expired: "danger",
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
  today,
  evidence,
}: {
  qualifications: Qualification[];
  catalog: QualificationType[];
  /** `YYYY-MM-DD` (UTC) from the server render, for the BR-12 expiry chip. */
  today: string;
  /** Linked wallet documents per qualification id; undefined when the wallet is off. */
  evidence?: Record<string, string[]>;
}) {
  const t = useTranslations("qualifications");
  const tDocuments = useTranslations("documents");
  const tDomain = useTranslations("domain");
  const tRoot = useTranslations();
  const locale = useLocale();
  const [editing, setEditing] = useState<Qualification | null>(null);
  const [typeId, setTypeId] = useState("");
  const [rawErrors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [pending, startTransition] = useTransition();
  const idempotency = useIdempotencyKey();
  const errors = resolveFieldErrors(tRoot, rawErrors);

  const heldTypeIds = new Set(qualifications.map((q) => q.type.id));
  const available = catalog.filter((type) => !heldTypeIds.has(type.id));
  const selectedType = catalog.find((type) => type.id === typeId) ?? null;
  const byCategory = Object.groupBy(qualifications, (q) => q.type.category);

  function run(label: string, task: () => Promise<ProfileActionResult>) {
    setNotice(null);
    startTransition(async () => {
      const result = await callAction(task);
      if (result.ok) {
        idempotency.release();
        setNotice({ tone: "ok", text: label });
        setEditing(null);
        setErrors({});
      } else {
        setErrors(result.fieldErrors ?? {});
        // The only 409 here: the qualification is already declared (the generic copy is neutral).
        setNotice(
          result.code === "CONFLICT"
            ? { tone: "danger", text: t("alreadyDeclared"), requestId: result.requestId }
            : actionErrorCopy(tRoot, result),
        );
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
    const code = selectedType?.code ?? "";
    run(t("declared", { code }), () =>
      addQualificationAction(parsed.data, idempotency.keyFor(parsed.data)),
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
        ? t("updatedReset", { code: current.type.code })
        : t("updated", { code: current.type.code });
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
    type?.requiresExpiry ? t("expiryRequiredHint", { code: type.code }) : t("expiryOptionalHint");

  return (
    <div className="space-y-6">
      <Notice
        notice={notice}
        referenceLabel={tRoot("common.reference", { id: notice?.requestId ?? "" })}
      />

      <Panel title={editing ? t("editTitle", { code: editing.type.code }) : t("declareTitle")}>
        {editing ? (
          <form key={editing.id} onSubmit={onEdit} noValidate className="space-y-4">
            <p className="text-sm text-muted">
              {t("reviewState", { name: editing.type.name })}{" "}
              <StatusChip tone={VERIFICATION_TONE[editing.verificationStatus]}>
                {tDomain(`verification.${editing.verificationStatus}`)}
              </StatusChip>
              {editing.verificationStatus !== "pending" && (
                <span className="mt-1 block">{t("datesResetHint")}</span>
              )}
            </p>
            <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
              <Field id="issuedAt" label={t("issued")} error={errors.issuedAt}>
                <input {...input("issuedAt")} type="date" defaultValue={editing.issuedAt ?? ""} />
              </Field>
              <Field
                id="expiresAt"
                label={t("expires")}
                hint={expiryHint(editing.type)}
                error={errors.expiresAt}
              >
                <input
                  {...input("expiresAt", expiryHint(editing.type))}
                  type="date"
                  defaultValue={editing.expiresAt ?? ""}
                />
              </Field>
              <Field id="status" label={t("held")} error={errors.status}>
                <select {...input("status")} defaultValue={editing.status}>
                  <option value="active">{t("active")}</option>
                  <option value="withdrawn">{t("withdrawn")}</option>
                </select>
              </Field>
              <div className="flex gap-2">
                <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
                  {pending ? tRoot("common.saving") : tRoot("common.save")}
                </Button>
                <Button
                  onClick={() => {
                    setEditing(null);
                    setErrors({});
                  }}
                  disabled={pending}
                >
                  {tRoot("common.cancel")}
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={onAdd} noValidate className="space-y-4">
            <p className="text-sm text-muted">
              {t.rich("intro", { b: (chunks) => <strong className="text-ink">{chunks}</strong> })}
            </p>
            <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
              <Field
                id="qualificationTypeId"
                label={t("qualification")}
                error={errors.qualificationTypeId}
              >
                <select
                  {...input("qualificationTypeId")}
                  value={typeId}
                  onChange={(e) => setTypeId(e.target.value)}
                >
                  <option value="">{t("select")}</option>
                  {QUALIFICATION_CATEGORIES.map((category) => {
                    const items = available.filter((type) => type.category === category);
                    if (items.length === 0) return null;
                    return (
                      <optgroup key={category} label={tDomain(`category.${category}`)}>
                        {items.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.code} · {type.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </Field>
              <Field id="issuedAt" label={t("issued")} error={errors.issuedAt}>
                <input {...input("issuedAt")} type="date" />
              </Field>
              <Field
                id="expiresAt"
                label={t("expires")}
                hint={expiryHint(selectedType)}
                error={errors.expiresAt}
              >
                <input {...input("expiresAt", expiryHint(selectedType))} type="date" />
              </Field>
              <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
                {pending ? tRoot("common.saving") : t("declare")}
              </Button>
            </div>
            {available.length === 0 && <p className="text-sm text-muted">{t("allDeclared")}</p>}
          </form>
        )}
        {errors.form && <p className="mt-2 text-sm font-medium text-danger">{errors.form}</p>}
      </Panel>

      {qualifications.length === 0 ? (
        <Panel>
          <p className="text-sm text-muted">{t("empty")}</p>
        </Panel>
      ) : (
        QUALIFICATION_CATEGORIES.map((category) => {
          const items = byCategory[category];
          if (!items?.length) return null;
          return (
            <Panel
              key={category}
              title={t("group", {
                category: tDomain(`category.${category}`),
                count: items.length,
              })}
            >
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
                        {q.issuedAt
                          ? `${t("issuedOn", { date: formatDate(locale, q.issuedAt) })} · `
                          : ""}
                        {q.expiresAt
                          ? t("validUntil", { date: formatDate(locale, q.expiresAt) })
                          : t("noExpiry")}
                        {/* BR-12: same «expires soon» / «expired» chip as the wallet; held rows only. */}
                        {(() => {
                          const expiry = documentExpiryState(q.expiresAt, today);
                          return q.status === "active" &&
                            (expiry === "soon" || expiry === "expired") ? (
                            <span className="ml-2">
                              <StatusChip tone={EXPIRY_TONE[expiry]}>
                                {tDocuments(`expiry.${expiry}`)}
                              </StatusChip>
                            </span>
                          ) : null;
                        })()}
                      </span>
                      {evidence && <EvidenceLine titles={evidence[q.id] ?? []} />}
                      {q.verificationStatus === "rejected" && q.reviewNote && (
                        <span className="mt-1 block text-xs text-danger">
                          {t("reviewReason", { reason: q.reviewNote })}
                        </span>
                      )}
                    </span>
                    <StatusChip tone={q.status === "withdrawn" ? "neutral" : "info"}>
                      {tDomain(`held.${q.status}`)}
                    </StatusChip>
                    <StatusChip tone={VERIFICATION_TONE[q.verificationStatus]}>
                      {tDomain(`verification.${q.verificationStatus}`)}
                    </StatusChip>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                          setEditing(q);
                          setErrors({});
                          setNotice(null);
                        }}
                      >
                        {tRoot("common.edit")}
                      </Button>
                      <ConfirmButton
                        size="sm"
                        disabled={pending}
                        label={tRoot("common.remove")}
                        confirmLabel={t("confirmRemove")}
                        cancelLabel={tRoot("common.cancel")}
                        onConfirm={() =>
                          run(t("removed", { code: q.type.code }), () =>
                            deleteQualificationAction(q.id),
                          )
                        }
                      />
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
