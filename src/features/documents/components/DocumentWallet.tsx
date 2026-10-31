"use client";

// Document Wallet (D-10, docs/product/DOCUMENT_WALLET.md; V1.8 connected beta `Account.jsx`
// `Documents` + demo `Professional2.jsx:183-219`). Owner only: upload, list filtered by type (N-20), view
// in the app through a 60-second signed link (N-21) or in a new tab, edit the metadata, archive to the
// trash, restore, delete permanently from the trash (N-19). Nothing here shares a document with anyone:
// there is no scanning mechanism yet, so every file stays "not scanned" and third-party access is
// impossible by construction.
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { controlClass, Field } from "@/components/ui/Field";
import { describedBy } from "@/components/ui/field-ids";
import { Notice, type NoticeState } from "@/components/ui/Notice";
import { actionErrorCopy, callAction } from "@/components/ui/action-result";
import { Panel } from "@/components/ui/Panel";
import { StatusChip } from "@/components/ui/StatusChip";
import { EXPIRY_TONE } from "@/components/ui/tones";
import {
  DOCUMENT_KINDS,
  documentExpiryState,
  MAX_DOCUMENT_BYTES,
  type DocumentKind,
} from "@/domain/documents";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import { resolveFieldErrors } from "@/i18n/validation";
import { useIdempotencyKey } from "@/lib/idempotency";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/errors";
import { updateDocumentInput } from "@/lib/validation/documents";
import type { DocumentListResponse, ProfessionalDocument } from "@/types/api";
import {
  archiveDocumentAction,
  deleteDocumentAction,
  documentUrlAction,
  refreshDocumentsAction,
  updateDocumentAction,
} from "../actions";
import {
  trashPurgeDate,
  WALLET_FILTERS,
  walletList,
  type WalletFilter,
  type WalletView,
} from "../map";
import { uploadDocument } from "../upload";
import { DocumentViewer } from "./DocumentViewer";
import { loadForViewer, releaseViewer, type ViewerResult } from "../viewer";

export interface QualificationOption {
  id: string;
  label: string;
}

const ACCEPT = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";
const PATH = "/app/professional/documents";

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
  view,
  trashRetentionDays,
  counts,
}: {
  /** Wallet and trash together (the list endpoint returns both). */
  documents: ProfessionalDocument[];
  qualifications: QualificationOption[];
  /** `YYYY-MM-DD` (UTC) from the server render, for the expired badge. */
  today: string;
  /** v1.8 «Papelera» / «Ver wallet» (`?view=trash`). */
  view: WalletView;
  /** T-100: how long an archived document stays restorable (database setting). */
  trashRetentionDays: number;
  /** Both views in full (server counts): the trash size and whether the list was cut at 200. */
  counts: DocumentListResponse["counts"] | undefined;
}) {
  const t = useTranslations("documents");
  const tRoot = useTranslations();
  const router = useRouter();
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [rawErrors, setErrors] = useState<FieldErrors>({});
  const errors = resolveFieldErrors(tRoot, rawErrors);
  const [pending, startTransition] = useTransition();
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const idempotency = useIdempotencyKey();
  const qualificationLabel = new Map(qualifications.map((q) => [q.id, q.label]));
  const [filter, setFilter] = useState<WalletFilter>("all");
  const [viewing, setViewing] = useState<{
    doc: ProfessionalDocument;
    request: Promise<ViewerResult>;
    attempt: number;
  } | null>(null);
  const viewTrigger = useRef<HTMLButtonElement | null>(null);
  const trash = view === "trash";
  const list = walletList(documents, view, filter, counts);

  function onUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const read = readUpload(new FormData(event.currentTarget));
    if ("error" in read) {
      setErrors({ file: read.error });
      return;
    }
    const { fields } = read;
    // Same file + same metadata → same key, so a retry after a lost response replays (I-1).
    const key = idempotency.keyFor({
      name: fields.file.name,
      size: fields.file.size,
      lastModified: fields.file.lastModified,
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
        await callAction(refreshDocumentsAction);
        router.refresh();
        return;
      }
      setErrors(issueErrors(result.error.issues));
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
      const result = await callAction(() => documentUrlAction(id));
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
      const result = await callAction(() => updateDocumentAction(document.id, parsed.data));
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
      const result = await callAction(() => deleteDocumentAction(id));
      setNotice(result.ok ? { tone: "ok", text: t("deleted") } : actionErrorCopy(tRoot, result));
    });
  }

  /** N-19: to the trash or back. The row leaves this list; the notice then takes the focus (X-08). */
  function onArchive(id: string, archived: boolean) {
    startTransition(async () => {
      const result = await callAction(() => archiveDocumentAction(id, archived));
      setNotice(
        result.ok
          ? { tone: "ok", text: t(archived ? "archived" : "restored") }
          : actionErrorCopy(tRoot, result),
      );
    });
  }

  /** N-21: the request starts here, from the click, and the dialog shows it (Suspense). */
  function onView(doc: ProfessionalDocument, attempt = 0) {
    setViewing({ doc, request: loadForViewer(doc), attempt });
  }

  function onRetryViewer() {
    if (!viewing) return;
    releaseViewer(viewing.request);
    onView(viewing.doc, viewing.attempt + 1);
  }

  function onCloseViewer() {
    if (viewing) releaseViewer(viewing.request);
    setViewing(null);
    viewTrigger.current?.focus();
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

      {!trash && (
        <UploadPanel
          formKey={formKey}
          errors={errors}
          pending={pending}
          onSubmit={onUpload}
          kindOptions={kindOptions}
          qualificationOptions={qualificationOptions}
        />
      )}

      <Panel
        title={t(trash ? "trashTitle" : "listTitle", { count: list.shown.length })}
        actions={
          <ButtonLink size="sm" href={trash ? PATH : `${PATH}?view=trash`}>
            {trash ? t("showWallet") : t("showTrash", { count: list.inTrash })}
          </ButtonLink>
        }
      >
        <WalletFilters value={filter} onChange={setFilter} />
        <ListNotes trash={trash} trashRetentionDays={trashRetentionDays} list={list} />
        {list.shown.length === 0 ? (
          <p className="text-sm text-muted">{t(emptyKey(list.inView > 0, trash))}</p>
        ) : (
          <ul className="divide-y divide-line">
            {list.shown.map((d) => {
              const expiry = documentExpiryState(d.expiresAt, today);
              return (
                <li key={d.id} className="py-4">
                  {editing === d.id ? (
                    <DocumentEditForm
                      document={d}
                      errors={errors}
                      pending={pending}
                      onSubmit={(e) => onSave(d, e)}
                      onCancel={() => {
                        setEditing(null);
                        setErrors({});
                      }}
                      kindOptions={kindOptions}
                      qualificationOptions={qualificationOptions}
                    />
                  ) : (
                    <div className="grid gap-3 sm:flex sm:items-start sm:justify-between">
                      <DocumentSummary
                        document={d}
                        expiry={expiry}
                        qualification={
                          d.qualificationId
                            ? (qualificationLabel.get(d.qualificationId) ?? "—")
                            : null
                        }
                        trashRetentionDays={trashRetentionDays}
                      />
                      {trash ? (
                        <TrashActions
                          document={d}
                          pending={pending}
                          onRestore={() => onArchive(d.id, false)}
                          onDelete={() => onDelete(d.id)}
                        />
                      ) : (
                        <WalletActions
                          document={d}
                          pending={pending}
                          onOpen={(event) => {
                            viewTrigger.current = event.currentTarget;
                            onView(d);
                          }}
                          onEdit={() => {
                            setEditing(d.id);
                            setErrors({});
                          }}
                          onArchive={() => onArchive(d.id, true)}
                        />
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {viewing && (
        <DocumentViewer
          key={viewing.doc.id}
          target={viewing.doc}
          request={viewing.request}
          attempt={viewing.attempt}
          onRetry={onRetryViewer}
          onClose={onCloseViewer}
          onOpenInTab={() => onOpen(viewing.doc.id)}
        />
      )}
    </div>
  );
}

type Errors = Record<string, string | undefined>;

const mimeKey = (mime: string) =>
  mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : "jpeg";

/** Upload a file with its kind, title, expiry and linked qualification. */
function UploadPanel({
  formKey,
  errors,
  pending,
  onSubmit,
  kindOptions,
  qualificationOptions,
}: {
  /** Bumped after an upload: a fresh, empty form. */
  formKey: number;
  errors: Errors;
  pending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  kindOptions: ReactNode;
  qualificationOptions: ReactNode;
}) {
  const t = useTranslations("documents");
  const tRoot = useTranslations();
  const onUpload = onSubmit;
  return (
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
            className="block w-full text-sm file:mr-3 file:min-h-10 pointer-coarse:file:min-h-11 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:font-semibold"
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
  );
}

/** A document's title, kind, expiry and linked qualification, edited in place. */
function DocumentEditForm({
  document: d,
  errors,
  pending,
  onSubmit,
  onCancel,
  kindOptions,
  qualificationOptions,
}: {
  document: ProfessionalDocument;
  errors: Errors;
  pending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  kindOptions: ReactNode;
  qualificationOptions: ReactNode;
}) {
  const t = useTranslations("documents");
  const tRoot = useTranslations();
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3 md:grid-cols-2">
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
        <select id={`kind-${d.id}`} name="kind" className={controlClass} defaultValue={d.kind}>
          {kindOptions}
        </select>
      </Field>
      <Field id={`expires-${d.id}`} label={t("expiresLabel")} error={errors.expiresAt}>
        <input
          id={`expires-${d.id}`}
          name="expiresAt"
          type="date"
          className={controlClass}
          defaultValue={d.expiresAt ?? ""}
        />
      </Field>
      <Field id={`qual-${d.id}`} label={t("qualificationLabel")} error={errors.qualificationId}>
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
        <Button disabled={pending} onClick={onCancel}>
          {tRoot("common.cancel")}
        </Button>
      </div>
    </form>
  );
}

/** Title, chips (kind, scan, expiry), type, size, expiry, linked qualification and the trash dates. */
function DocumentSummary({
  document: d,
  expiry,
  qualification,
  trashRetentionDays,
}: {
  document: ProfessionalDocument;
  expiry: ReturnType<typeof documentExpiryState>;
  /** The linked qualification's label («—» when it is gone), or null when none is linked. */
  qualification: string | null;
  trashRetentionDays: number;
}) {
  const t = useTranslations("documents");
  const locale = useLocale() as Locale;
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="font-semibold [overflow-wrap:anywhere]">{d.title}</p>
      <div className="flex flex-wrap gap-1.5">
        <StatusChip tone="info">{t(`kind.${d.kind as DocumentKind}`)}</StatusChip>
        <StatusChip tone="neutral">{t(`scan.${d.scanStatus}`)}</StatusChip>
        {expiry !== "none" && (
          <StatusChip tone={EXPIRY_TONE[expiry]}>{t(`expiry.${expiry}`)}</StatusChip>
        )}
      </div>
      <p className="text-xs text-muted">
        {t(`mime.${mimeKey(d.mimeType)}`)} · {formatBytes(locale, d.sizeBytes)}
        {d.expiresAt && <> · {t("expiresOn", { date: formatDate(locale, d.expiresAt) })}</>}
        {qualification !== null && <> · {t("linkedTo", { qualification })}</>}
      </p>
      {d.archivedAt && (
        <p className="text-xs text-muted">
          {t("archivedOn", { date: formatDate(locale, d.archivedAt) })} ·{" "}
          {t("purgeFrom", {
            date: formatDate(locale, trashPurgeDate(d.archivedAt, trashRetentionDays)),
          })}
        </p>
      )}
    </div>
  );
}

function TrashActions({
  document: d,
  pending,
  onRestore,
  onDelete,
}: {
  document: ProfessionalDocument;
  pending: boolean;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("documents");
  const tRoot = useTranslations();
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        disabled={pending}
        aria-label={t("restoreNamed", { title: d.title })}
        onClick={onRestore}
      >
        {t("restore")}
      </Button>
      <ConfirmButton
        size="sm"
        disabled={pending}
        label={t("deleteForever")}
        confirmLabel={t("confirmDelete")}
        cancelLabel={tRoot("common.cancel")}
        onConfirm={onDelete}
      />
    </div>
  );
}

function WalletActions({
  document: d,
  pending,
  onOpen,
  onEdit,
  onArchive,
}: {
  document: ProfessionalDocument;
  pending: boolean;
  onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const t = useTranslations("documents");
  const tRoot = useTranslations();
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={onOpen}>
        {t("open")}
      </Button>
      <Button size="sm" disabled={pending} onClick={onEdit}>
        {tRoot("common.edit")}
      </Button>
      <Button
        size="sm"
        disabled={pending}
        aria-label={t("archiveNamed", { title: d.title })}
        onClick={onArchive}
      >
        {t("archive")}
      </Button>
    </div>
  );
}

/** The upload form's fields, or the file error (missing, empty or over the size limit). */
interface UploadFields {
  file: File;
  kind: string;
  title: string;
  expiresAt: string;
  qualificationId: string;
}

/** The upload form's fields, or the file error that stops it before the request. */
function readUpload(form: FormData): { error: string } | { fields: UploadFields } {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "v.document.file.required" };
  if (file.size > MAX_DOCUMENT_BYTES) return { error: "v.document.file.tooLarge" };
  return {
    fields: {
      file,
      kind: String(form.get("kind") ?? ""),
      title: String(form.get("title") ?? "").trim() || file.name,
      expiresAt: String(form.get("expiresAt") ?? ""),
      qualificationId: String(form.get("qualificationId") ?? ""),
    },
  };
}

/** The function's validation issues as field errors (first path segment, else the form). */
const issueErrors = (issues: { path: string; message: string }[] | undefined): FieldErrors =>
  Object.fromEntries((issues ?? []).map((i) => [i.path.split(".")[0] ?? "form", i.message]));

const emptyKey = (filtered: boolean, trash: boolean) =>
  filtered ? "emptyFiltered" : trash ? "emptyTrash" : "empty";

function WalletFilters({
  value,
  onChange,
}: {
  value: WalletFilter;
  onChange: (filter: WalletFilter) => void;
}) {
  const t = useTranslations("documents");
  return (
    <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={t("filterLabel")}>
      {WALLET_FILTERS.map((f) => (
        <button
          key={f}
          type="button"
          aria-pressed={value === f}
          onClick={() => onChange(f)}
          className="min-h-9 rounded-full border border-line bg-white px-3 text-sm font-semibold text-ink pointer-coarse:min-h-11 hover:border-navy aria-[pressed=true]:border-navy aria-[pressed=true]:bg-navy aria-[pressed=true]:text-white"
        >
          {t(`filter.${f}`)}
        </button>
      ))}
    </div>
  );
}

/** The sharing (or retention) note and «showing {n} of {total}» when the list was cut. */
function ListNotes({
  trash,
  trashRetentionDays,
  list,
}: {
  trash: boolean;
  trashRetentionDays: number;
  list: { total: number; inView: number };
}) {
  const t = useTranslations("documents");
  return (
    <>
      {/* A function older than N-19 sends no retention: then the trash (always empty) says nothing of it. */}
      {(!trash || Number.isInteger(trashRetentionDays)) && (
        <p className="mb-4 rounded-lg border border-info-bg bg-info-bg p-3 text-sm text-ink">
          {trash ? t("trashNote", { days: trashRetentionDays }) : t("sharingNote")}
        </p>
      )}
      {list.total > list.inView && (
        <p className="mb-2 text-sm text-muted">
          {t("truncated", { shown: list.inView, total: list.total })}
        </p>
      )}
    </>
  );
}
