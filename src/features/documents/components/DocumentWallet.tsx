"use client";

// Document Wallet (D-10, docs/product/DOCUMENT_WALLET.md; V1.8 connected beta `Account.jsx`
// `Documents`). Owner only: upload, list, open through a 60-second signed link, edit the metadata,
// delete. Nothing here shares a document with anyone: there is no scanning mechanism yet, so every
// file stays "not scanned" and third-party access is impossible by construction.
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { controlClass, describedBy, Field } from "@/components/ui/Field";
import { actionErrorCopy, Notice, type NoticeState } from "@/components/ui/Notice";
import { Panel } from "@/components/ui/Panel";
import { StatusChip } from "@/components/ui/StatusChip";
import { DOCUMENT_KINDS, MAX_DOCUMENT_BYTES, type DocumentKind } from "@/domain/documents";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import { resolveFieldErrors } from "@/i18n/validation";
import { useIdempotencyKey } from "@/lib/idempotency";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/errors";
import { updateDocumentInput } from "@/lib/validation/documents";
import type { ProfessionalDocument } from "@/types/api";
import {
  deleteDocumentAction,
  documentUrlAction,
  refreshDocumentsAction,
  updateDocumentAction,
} from "../actions";
import { uploadDocument } from "../upload";

export interface QualificationOption {
  id: string;
  label: string;
}

const ACCEPT = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";

function formatBytes(locale: string, bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  return kb < 1024 ? `${fmt.format(kb)} KB` : `${fmt.format(kb / 1024)} MB`;
}

export function DocumentWallet({
  documents,
  qualifications,
  today,
}: {
  documents: ProfessionalDocument[];
  qualifications: QualificationOption[];
  /** `YYYY-MM-DD` (UTC) from the server render, for the expired badge. */
  today: string;
}) {
  const t = useTranslations("documents");
  const tRoot = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [rawErrors, setErrors] = useState<FieldErrors>({});
  const errors = resolveFieldErrors(tRoot, rawErrors);
  const [pending, startTransition] = useTransition();
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const idempotency = useIdempotencyKey();
  const qualificationLabel = new Map(qualifications.map((q) => [q.id, q.label]));

  function onUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setErrors({ file: "v.document.file.required" });
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      setErrors({ file: "v.document.file.tooLarge" });
      return;
    }
    const fields = {
      file,
      kind: String(form.get("kind") ?? ""),
      title: String(form.get("title") ?? "").trim() || file.name,
      expiresAt: String(form.get("expiresAt") ?? ""),
      qualificationId: String(form.get("qualificationId") ?? ""),
    };
    // Same file + same metadata → same key, so a retry after a lost response replays (I-1).
    const key = idempotency.keyFor({
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      kind: fields.kind,
      title: fields.title,
      expiresAt: fields.expiresAt,
      qualificationId: fields.qualificationId,
    });
    setErrors({});
    setNotice(null);
    startTransition(async () => {
      const result = await uploadDocument(fields, key);
      if (result.ok) {
        idempotency.release();
        setFormKey((k) => k + 1);
        setNotice({ tone: "ok", text: t("uploaded") });
        await refreshDocumentsAction();
        router.refresh();
        return;
      }
      setErrors(
        Object.fromEntries(
          (result.error.issues ?? []).map((i) => [i.path.split(".")[0] ?? "form", i.message]),
        ),
      );
      setNotice(
        result.error.code === "PAYLOAD_TOO_LARGE"
          ? { tone: "danger", text: tRoot("v.document.file.tooLarge"), requestId: result.requestId }
          : actionErrorCopy(tRoot, { ...result.error, requestId: result.requestId }),
      );
    });
  }

  function onOpen(id: string) {
    // Opened before the await so popup blockers allow it; the link is valid for 60 seconds.
    const tab = window.open("", "_blank");
    startTransition(async () => {
      const result = await documentUrlAction(id);
      if (result.ok && result.data && tab) {
        tab.opener = null;
        tab.location.href = result.data;
        return;
      }
      tab?.close();
      if (!result.ok) setNotice(actionErrorCopy(tRoot, result));
    });
  }

  function onSave(document: ProfessionalDocument, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = updateDocumentInput.safeParse({
      kind: form.get("kind"),
      title: form.get("title"),
      expiresAt: String(form.get("expiresAt") ?? "") || null,
      qualificationId: String(form.get("qualificationId") ?? "") || null,
    });
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await updateDocumentAction(document.id, parsed.data);
      if (result.ok) {
        setEditing(null);
        setNotice({ tone: "ok", text: t("updated") });
      } else {
        setErrors(result.fieldErrors ?? {});
        setNotice(actionErrorCopy(tRoot, result));
      }
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      const result = await deleteDocumentAction(id);
      setConfirmDelete(null);
      setNotice(result.ok ? { tone: "ok", text: t("deleted") } : actionErrorCopy(tRoot, result));
    });
  }

  const kindOptions = DOCUMENT_KINDS.map((k) => (
    <option key={k} value={k}>
      {t(`kind.${k}`)}
    </option>
  ));
  const qualificationOptions = [
    <option key="" value="">
      {t("noQualification")}
    </option>,
    ...qualifications.map((q) => (
      <option key={q.id} value={q.id}>
        {q.label}
      </option>
    )),
  ];

  return (
    <div className="space-y-6">
      <Notice
        notice={notice}
        referenceLabel={tRoot("common.reference", { id: notice?.requestId ?? "" })}
      />

      <Panel title={t("uploadTitle")}>
        <p className="mb-4 text-sm text-muted">{t("uploadIntro")}</p>
        <form
          key={formKey}
          onSubmit={onUpload}
          noValidate
          className="grid gap-4 md:grid-cols-2"
          aria-busy={pending}
        >
          <Field id="file" label={t("file")} hint={t("fileHint")} error={errors.file}>
            <input
              id="file"
              name="file"
              type="file"
              accept={ACCEPT}
              required
              disabled={pending}
              aria-invalid={Boolean(errors.file)}
              aria-describedby={describedBy("file", errors.file, t("fileHint"))}
              className="block w-full text-sm file:mr-3 file:min-h-10 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:font-semibold"
            />
          </Field>
          <Field id="kind" label={t("kindLabel")} error={errors.kind}>
            <select
              id="kind"
              name="kind"
              className={controlClass}
              defaultValue="license"
              disabled={pending}
            >
              {kindOptions}
            </select>
          </Field>
          <Field id="title" label={t("titleLabel")} hint={t("titleHint")} error={errors.title}>
            <input
              id="title"
              name="title"
              className={controlClass}
              maxLength={180}
              disabled={pending}
              aria-describedby={describedBy("title", errors.title, t("titleHint"))}
            />
          </Field>
          <Field id="expiresAt" label={t("expiresLabel")} error={errors.expiresAt}>
            <input
              id="expiresAt"
              name="expiresAt"
              type="date"
              className={controlClass}
              disabled={pending}
            />
          </Field>
          <Field
            id="qualificationId"
            label={t("qualificationLabel")}
            hint={t("qualificationHint")}
            error={errors.qualificationId}
          >
            <select
              id="qualificationId"
              name="qualificationId"
              className={controlClass}
              defaultValue=""
              disabled={pending}
              aria-describedby={describedBy(
                "qualificationId",
                errors.qualificationId,
                t("qualificationHint"),
              )}
            >
              {qualificationOptions}
            </select>
          </Field>
          <div className="flex items-end">
            <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
              {pending ? tRoot("common.saving") : t("upload")}
            </Button>
          </div>
        </form>
        {errors.form && <p className="mt-2 text-sm font-medium text-danger">{errors.form}</p>}
      </Panel>

      <Panel title={t("listTitle", { count: documents.length })}>
        <p className="mb-4 rounded-lg border border-info-bg bg-info-bg p-3 text-sm text-ink">
          {t("sharingNote")}
        </p>
        {documents.length === 0 ? (
          <p className="text-sm text-muted">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {documents.map((d) => {
              const expired = d.expiresAt !== null && d.expiresAt < today;
              return (
                <li key={d.id} className="py-4">
                  {editing === d.id ? (
                    <form
                      onSubmit={(e) => onSave(d, e)}
                      noValidate
                      className="grid gap-3 md:grid-cols-2"
                    >
                      <Field id={`title-${d.id}`} label={t("titleLabel")} error={errors.title}>
                        <input
                          id={`title-${d.id}`}
                          name="title"
                          className={controlClass}
                          defaultValue={d.title}
                          maxLength={180}
                        />
                      </Field>
                      <Field id={`kind-${d.id}`} label={t("kindLabel")}>
                        <select
                          id={`kind-${d.id}`}
                          name="kind"
                          className={controlClass}
                          defaultValue={d.kind}
                        >
                          {kindOptions}
                        </select>
                      </Field>
                      <Field
                        id={`expires-${d.id}`}
                        label={t("expiresLabel")}
                        error={errors.expiresAt}
                      >
                        <input
                          id={`expires-${d.id}`}
                          name="expiresAt"
                          type="date"
                          className={controlClass}
                          defaultValue={d.expiresAt ?? ""}
                        />
                      </Field>
                      <Field
                        id={`qual-${d.id}`}
                        label={t("qualificationLabel")}
                        error={errors.qualificationId}
                      >
                        <select
                          id={`qual-${d.id}`}
                          name="qualificationId"
                          className={controlClass}
                          defaultValue={d.qualificationId ?? ""}
                        >
                          {qualificationOptions}
                        </select>
                      </Field>
                      <div className="flex gap-2 md:col-span-2">
                        <Button type="submit" variant="primary" disabled={pending}>
                          {tRoot("common.save")}
                        </Button>
                        <Button
                          disabled={pending}
                          onClick={() => {
                            setEditing(null);
                            setErrors({});
                          }}
                        >
                          {tRoot("common.cancel")}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="grid gap-3 sm:flex sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1.5">
                        <p className="font-semibold [overflow-wrap:anywhere]">{d.title}</p>
                        <div className="flex flex-wrap gap-1.5">
                          <StatusChip tone="info">{t(`kind.${d.kind as DocumentKind}`)}</StatusChip>
                          <StatusChip tone="neutral">{t(`scan.${d.scanStatus}`)}</StatusChip>
                          {expired && <StatusChip tone="danger">{t("expired")}</StatusChip>}
                        </div>
                        <p className="text-xs text-muted">
                          {t(
                            `mime.${d.mimeType === "application/pdf" ? "pdf" : d.mimeType === "image/png" ? "png" : "jpeg"}`,
                          )}{" "}
                          · {formatBytes(locale, d.sizeBytes)}
                          {d.expiresAt && (
                            <> · {t("expiresOn", { date: formatDate(locale, d.expiresAt) })}</>
                          )}
                          {d.qualificationId && (
                            <>
                              {" "}
                              ·{" "}
                              {t("linkedTo", {
                                qualification: qualificationLabel.get(d.qualificationId) ?? "—",
                              })}
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          className="min-h-8 px-3 text-xs"
                          disabled={pending}
                          onClick={() => onOpen(d.id)}
                        >
                          {t("open")}
                        </Button>
                        <Button
                          className="min-h-8 px-3 text-xs"
                          disabled={pending}
                          onClick={() => {
                            setEditing(d.id);
                            setConfirmDelete(null);
                            setErrors({});
                          }}
                        >
                          {tRoot("common.edit")}
                        </Button>
                        {confirmDelete === d.id ? (
                          <>
                            <Button
                              className="min-h-8 px-3 text-xs text-danger"
                              disabled={pending}
                              onClick={() => onDelete(d.id)}
                            >
                              {t("confirmDelete")}
                            </Button>
                            <Button
                              className="min-h-8 px-3 text-xs"
                              disabled={pending}
                              onClick={() => setConfirmDelete(null)}
                            >
                              {tRoot("common.cancel")}
                            </Button>
                          </>
                        ) : (
                          <Button
                            className="min-h-8 px-3 text-xs text-danger"
                            disabled={pending}
                            onClick={() => setConfirmDelete(d.id)}
                          >
                            {tRoot("common.delete")}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
