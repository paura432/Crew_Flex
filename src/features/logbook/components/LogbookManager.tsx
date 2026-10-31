"use client";

// Personal logbook (M14, N-12; v1.8 `src/components/v11/Logbook2.jsx` + connected `Account.jsx`
// `Logbook`). Owner only: new entry, history with edit, «Seleccionable para expediente», archive,
// restore and (archived only) delete. Nothing here shares an entry with anyone: only applying copies the
// entries marked «Seleccionable para expediente» into that application's Candidate Pack copy (BR-25).
import { useLocale, useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { controlClass, Field } from "@/components/ui/Field";
import { describedBy } from "@/components/ui/field-ids";
import { Notice, type NoticeState } from "@/components/ui/Notice";
import { actionErrorCopy, callAction } from "@/components/ui/action-result";
import { Panel } from "@/components/ui/Panel";
import { StatusChip } from "@/components/ui/StatusChip";
import {
  LOGBOOK_AIRCRAFT_SUGGESTIONS,
  LOGBOOK_CATEGORIES,
  LOGBOOK_ENVIRONMENTS,
  LOGBOOK_LIMITS,
} from "@/domain/logbook";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import { resolveFieldErrors, translateKey } from "@/i18n/validation";
import { useIdempotencyKey } from "@/lib/idempotency";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/errors";
import { createLogbookEntryInput, type LogbookView } from "@/lib/validation/logbook";
import type { LogbookEntry } from "@/types/api";
import {
  createLogbookEntryAction,
  deleteLogbookEntryAction,
  updateLogbookEntryAction,
} from "../actions";
import { logbookInvalidCopyKey, readLogbookForm } from "../form";

const PATH = "/app/professional/logbook";

function EntryFields({
  prefix,
  entry,
  today,
  errors,
  disabled,
}: {
  prefix: string;
  entry?: LogbookEntry;
  /** `YYYY-MM-DD` in Madrid (BR-17.2): the latest date allowed and the new entry's default. */
  today: string;
  errors: FieldErrors;
  disabled: boolean;
}) {
  const t = useTranslations("logbook");
  const id = (name: string) => `${prefix}${name}`;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field id={id("entryDate")} label={t("date")} error={errors.entryDate}>
        <input
          id={id("entryDate")}
          name="entryDate"
          type="date"
          max={today}
          required
          defaultValue={entry?.entryDate ?? today}
          disabled={disabled}
          aria-invalid={Boolean(errors.entryDate)}
          aria-describedby={describedBy(id("entryDate"), errors.entryDate)}
          className={controlClass}
        />
      </Field>
      <Field
        id={id("aircraft")}
        label={t("aircraft")}
        hint={t("aircraftHint")}
        error={errors.aircraft}
      >
        <input
          id={id("aircraft")}
          name="aircraft"
          list={id("aircraft-options")}
          required
          maxLength={LOGBOOK_LIMITS.aircraft}
          defaultValue={entry?.aircraft ?? ""}
          disabled={disabled}
          aria-invalid={Boolean(errors.aircraft)}
          aria-describedby={describedBy(id("aircraft"), errors.aircraft, t("aircraftHint"))}
          className={controlClass}
        />
        <datalist id={id("aircraft-options")}>
          {LOGBOOK_AIRCRAFT_SUGGESTIONS.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </Field>
      <Field id={id("category")} label={t("categoryLabel")} error={errors.category}>
        <select
          id={id("category")}
          name="category"
          defaultValue={entry?.category ?? LOGBOOK_CATEGORIES[0]}
          disabled={disabled}
          className={controlClass}
        >
          {LOGBOOK_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`category.${c}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field id={id("environment")} label={t("environmentLabel")} error={errors.environment}>
        <select
          id={id("environment")}
          name="environment"
          defaultValue={entry?.environment ?? LOGBOOK_ENVIRONMENTS[0]}
          disabled={disabled}
          className={controlClass}
        >
          {LOGBOOK_ENVIRONMENTS.map((e) => (
            <option key={e} value={e}>
              {t(`environment.${e}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field id={id("ata")} label={t("ata")} error={errors.ata}>
        <input
          id={id("ata")}
          name="ata"
          maxLength={LOGBOOK_LIMITS.ata}
          defaultValue={entry?.ata ?? ""}
          disabled={disabled}
          aria-invalid={Boolean(errors.ata)}
          aria-describedby={describedBy(id("ata"), errors.ata)}
          className={controlClass}
        />
      </Field>
      <Field id={id("hours")} label={t("hours")} hint={t("hoursHint")} error={errors.hours}>
        <input
          id={id("hours")}
          name="hours"
          type="number"
          inputMode="decimal"
          min={0}
          max={LOGBOOK_LIMITS.hoursMax}
          step={0.1}
          required
          defaultValue={entry?.hours ?? ""}
          disabled={disabled}
          aria-invalid={Boolean(errors.hours)}
          aria-describedby={describedBy(id("hours"), errors.hours, t("hoursHint"))}
          className={controlClass}
        />
      </Field>
      <div className="md:col-span-2">
        <Field id={id("description")} label={t("descriptionLabel")} error={errors.description}>
          <textarea
            id={id("description")}
            name="description"
            rows={4}
            required
            maxLength={LOGBOOK_LIMITS.description}
            defaultValue={entry?.description ?? ""}
            disabled={disabled}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={describedBy(id("description"), errors.description)}
            className={controlClass}
          />
        </Field>
      </div>
      <div className="md:col-span-2">
        <label className="flex items-start gap-2 text-sm pointer-coarse:min-h-11 pointer-coarse:items-center">
          <input
            type="checkbox"
            name="cvRelevant"
            className="mt-0.5 size-4"
            defaultChecked={entry?.cvRelevant ?? false}
            disabled={disabled}
            aria-describedby={id("cvRelevant-hint")}
          />
          {t("cvRelevant")}
        </label>
        <p id={id("cvRelevant-hint")} className="mt-1 text-sm text-muted">
          {t("cvRelevantHint")}
        </p>
      </div>
    </div>
  );
}

export function LogbookManager({
  entries,
  total,
  view,
  today,
}: {
  entries: LogbookEntry[];
  total: number;
  view: LogbookView;
  today: string;
}) {
  const t = useTranslations("logbook");
  const tRoot = useTranslations();
  const locale = useLocale() as Locale;
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [rawErrors, setErrors] = useState<FieldErrors>({});
  const [rawEditErrors, setEditErrors] = useState<FieldErrors>({});
  const errors = resolveFieldErrors(tRoot, rawErrors);
  const editErrors = resolveFieldErrors(tRoot, rawEditErrors);
  const [editing, setEditing] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const idempotency = useIdempotencyKey();
  const [shown, setSelectable] = useOptimistic(
    entries,
    (state, change: { id: string; cvRelevant: boolean }) =>
      state.map((e) => (e.id === change.id ? { ...e, cvRelevant: change.cvRelevant } : e)),
  );
  const archived = view === "archived";

  function refused(fieldErrors: FieldErrors): NoticeState {
    return { tone: "danger", text: translateKey(tRoot, logbookInvalidCopyKey(fieldErrors)) };
  }

  function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = createLogbookEntryInput.safeParse(
      readLogbookForm(new FormData(event.currentTarget)),
    );
    if (!parsed.success) {
      const fieldErrors = toFieldErrors(parsed.error);
      setErrors(fieldErrors);
      setNotice(refused(fieldErrors));
      return;
    }
    // Same entry → same key, so a retry after a lost response replays instead of duplicating (I-1).
    const key = idempotency.keyFor(parsed.data);
    setErrors({});
    setNotice(null);
    startTransition(async () => {
      const result = await callAction(() => createLogbookEntryAction(parsed.data, key));
      // Updates after an `await` are not part of the transition unless wrapped again: this way the
      // outcome commits together with the refreshed list instead of a moment before it.
      startTransition(() => {
        if (result.ok) {
          idempotency.release();
          setFormKey((k) => k + 1); // v1.8 demo empties the form (the connected beta did not: ✗ row 16)
          setNotice({ tone: "ok", text: t("saved") });
          return;
        }
        setErrors(result.fieldErrors ?? {});
        setNotice(actionErrorCopy(tRoot, result));
      });
    });
  }

  function onSave(entry: LogbookEntry, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = createLogbookEntryInput.safeParse(
      readLogbookForm(new FormData(event.currentTarget)),
    );
    if (!parsed.success) {
      const fieldErrors = toFieldErrors(parsed.error);
      setEditErrors(fieldErrors);
      setNotice(refused(fieldErrors));
      return;
    }
    setEditErrors({});
    startTransition(async () => {
      const result = await callAction(() =>
        updateLogbookEntryAction(entry.id, { ...parsed.data, ata: parsed.data.ata ?? null }),
      );
      startTransition(() => {
        if (result.ok) {
          setEditing(null);
          setNotice({ tone: "ok", text: t("updated") });
          return;
        }
        setEditErrors(result.fieldErrors ?? {});
        setNotice(actionErrorCopy(tRoot, result));
      });
    });
  }

  function patch(id: string, change: { archived: boolean } | { cvRelevant: boolean }) {
    startTransition(async () => {
      if ("cvRelevant" in change) setSelectable({ id, cvRelevant: change.cvRelevant });
      const result = await callAction(() => updateLogbookEntryAction(id, change));
      startTransition(() =>
        setNotice(result.ok ? { tone: "ok", text: t("updated") } : actionErrorCopy(tRoot, result)),
      );
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      const result = await callAction(() => deleteLogbookEntryAction(id));
      startTransition(() =>
        setNotice(result.ok ? { tone: "ok", text: t("deleted") } : actionErrorCopy(tRoot, result)),
      );
    });
  }

  return (
    <div className="space-y-6">
      <Notice
        notice={notice}
        referenceLabel={tRoot("common.reference", { id: notice?.requestId ?? "" })}
      />

      <Panel title={t("newTitle")}>
        <p className="mb-4 rounded-lg border border-info-bg bg-info-bg p-3 text-sm text-ink">
          {t("disclaimer")}
        </p>
        <form
          key={formKey}
          onSubmit={onCreate}
          noValidate
          aria-busy={pending}
          className="space-y-4"
        >
          <EntryFields prefix="" today={today} errors={errors} disabled={pending} />
          <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
            {pending ? tRoot("common.saving") : t("save")}
          </Button>
        </form>
      </Panel>

      <Panel
        title={archived ? t("archiveTitle") : t("historyTitle")}
        actions={
          <ButtonLink size="sm" href={archived ? PATH : `${PATH}?view=archived`}>
            {archived ? t("showActive") : t("showArchive")}
          </ButtonLink>
        }
      >
        {shown.length === 0 ? (
          <p className="text-sm text-muted">{archived ? t("emptyArchive") : t("empty")}</p>
        ) : (
          <>
            {total > shown.length && (
              <p className="mb-2 text-sm text-muted">
                {t("truncated", { shown: shown.length, total })}
              </p>
            )}
            <ul className="divide-y divide-line">
              {shown.map((e) => (
                <li key={e.id} className="py-4">
                  {editing === e.id ? (
                    <form onSubmit={(ev) => onSave(e, ev)} noValidate className="space-y-4">
                      <h3 className="font-semibold">{t("editTitle")}</h3>
                      <EntryFields
                        prefix="edit-"
                        entry={e}
                        today={today}
                        errors={editErrors}
                        disabled={pending}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button type="submit" variant="primary" disabled={pending}>
                          {tRoot("common.saveChanges")}
                        </Button>
                        <Button
                          disabled={pending}
                          onClick={() => {
                            setEditing(null);
                            setEditErrors({});
                          }}
                        >
                          {tRoot("common.cancel")}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <article className="space-y-1.5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h3 className="font-semibold [overflow-wrap:anywhere]">
                          {e.aircraft} · {t(`category.${e.category}`)}
                        </h3>
                        <StatusChip tone="info">{formatDate(locale, e.entryDate)}</StatusChip>
                      </div>
                      <p className="text-sm text-muted">
                        {[
                          e.ata ? t("ataValue", { ata: e.ata }) : null,
                          t("hoursValue", { hours: e.hours }),
                          t(`environment.${e.environment}`),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="whitespace-pre-line [overflow-wrap:anywhere]">
                        {e.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <StatusChip tone="neutral">{t("selfDeclared")}</StatusChip>
                        {archived ? (
                          <>
                            <Button
                              size="sm"
                              disabled={pending}
                              onClick={() => patch(e.id, { archived: false })}
                            >
                              {t("restore")}
                            </Button>
                            <ConfirmButton
                              size="sm"
                              disabled={pending}
                              label={tRoot("common.delete")}
                              confirmLabel={t("confirmDelete")}
                              cancelLabel={tRoot("common.cancel")}
                              onConfirm={() => onDelete(e.id)}
                            />
                          </>
                        ) : (
                          <>
                            <label className="flex items-center gap-2 text-sm pointer-coarse:min-h-11">
                              <input
                                type="checkbox"
                                className="size-4"
                                checked={e.cvRelevant}
                                disabled={pending}
                                onChange={(ev) => patch(e.id, { cvRelevant: ev.target.checked })}
                              />
                              {t("selectable")}
                            </label>
                            <Button
                              size="sm"
                              disabled={pending}
                              onClick={() => {
                                setEditing(e.id);
                                setEditErrors({});
                              }}
                            >
                              {tRoot("common.edit")}
                            </Button>
                            <Button
                              size="sm"
                              disabled={pending}
                              onClick={() => patch(e.id, { archived: true })}
                            >
                              {t("archive")}
                            </Button>
                          </>
                        )}
                      </div>
                    </article>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </div>
  );
}
