"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { controlClass, Field } from "@/components/ui/Field";
import { describedBy } from "@/components/ui/field-ids";
import { Notice, type NoticeState } from "@/components/ui/Notice";
import { actionErrorCopy, callAction } from "@/components/ui/action-result";
import { StateMessage } from "@/components/ui/StateMessage";
import { StatusChip } from "@/components/ui/StatusChip";
import { activationBlocker, REPRESENTATION_NOTE_MAX } from "@/domain/recruiter";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import { resolveFieldErrors } from "@/i18n/validation";
import type { FieldErrors } from "@/lib/validation/errors";
import type { RepresentationReviewItem } from "@/types/api";
import { activateClientAction } from "../actions";
import { CLIENT_STATUS_TONE, clientSince } from "../view";

/** One representation: the agency, the client and, while it is pending and not the reviewer's own, the evidence. */
function RepresentationCard({
  item,
  onDone,
}: {
  item: RepresentationReviewItem;
  onDone: (notice: NoticeState) => void;
}) {
  const t = useTranslations("recruiter.review");
  const tClients = useTranslations("recruiter.clients");
  const tRoot = useTranslations();
  const locale = useLocale() as Locale;
  const [rawErrors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [pending, startTransition] = useTransition();
  const errors = resolveFieldErrors(tRoot, rawErrors);
  const blocker = activationBlocker(item, item.ownAgency);
  const noteId = `note-${item.id}`;
  const line = clientSince(item);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = String(new FormData(event.currentTarget).get("note") ?? "");
    setNotice(null);
    if (note.trim() === "") {
      setErrors({ note: "v.recruiter.noteRequired" });
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await callAction(() => activateClientAction(item.id, note));
      if (result.ok) {
        onDone({ tone: "ok", text: t("activated", { name: item.name }) });
      } else {
        setErrors(result.fieldErrors ?? {});
        setNotice(
          result.code === "CONFLICT"
            ? { tone: "danger", text: t("changed"), requestId: result.requestId }
            : actionErrorCopy(tRoot, result),
        );
      }
    });
  }

  return (
    <li className="rounded-xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold break-words">{item.name}</p>
          <p className="text-sm text-muted break-words">
            {t("agency")}: {item.agencyName}
          </p>
        </div>
        <StatusChip tone={CLIENT_STATUS_TONE[item.status]}>
          {tClients(`status.${item.status}`)}
        </StatusChip>
      </div>
      <p className="mt-3 text-sm break-all">
        <span className="text-muted">{t("email")}:</span> {item.contactEmail ?? tClients("noEmail")}
      </p>
      <p className="text-xs text-muted tabular-nums">
        {tClients(line.key, { date: formatDate(locale, line.date) })}
      </p>
      {blocker === "own" ? (
        <p className="mt-4 text-sm text-muted">{t("own")}</p>
      ) : blocker === null ? (
        <form onSubmit={onSubmit} noValidate className="mt-4 space-y-3">
          <Field id={noteId} label={t("note")} hint={t("noteHint")} error={errors.note}>
            <textarea
              id={noteId}
              name="note"
              rows={3}
              required
              maxLength={REPRESENTATION_NOTE_MAX}
              className={controlClass}
              aria-invalid={Boolean(errors.note)}
              aria-describedby={describedBy(noteId, errors.note, t("noteHint"))}
              disabled={pending}
            />
          </Field>
          <Notice
            notice={notice}
            referenceLabel={tRoot("common.reference", { id: notice?.requestId ?? "" })}
          />
          <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
            {pending ? t("activating") : t("activate")}
          </Button>
        </form>
      ) : null}
    </li>
  );
}

/** Stays mounted after an activation, so its confirmation remains visible when the card changes. */
export function RepresentationReviewList({ items }: { items: RepresentationReviewItem[] }) {
  const t = useTranslations("recruiter.review");
  const tRoot = useTranslations();
  const [done, setDone] = useState<NoticeState | null>(null);
  return (
    <div className="space-y-4">
      <Notice notice={done} referenceLabel={tRoot("common.reference", { id: "" })} />
      {items.length === 0 ? (
        <StateMessage title={t("emptyTitle")} />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <RepresentationCard key={item.id} item={item} onDone={setDone} />
          ))}
        </ul>
      )}
    </div>
  );
}
