"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { controlClass, describedBy, Field } from "@/components/ui/Field";
import { actionErrorCopy, Notice, type NoticeState } from "@/components/ui/Notice";
import { StateMessage } from "@/components/ui/StateMessage";
import { StatusChip } from "@/components/ui/StatusChip";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import { resolveFieldErrors } from "@/i18n/validation";
import type { FieldErrors } from "@/lib/validation/errors";
import { REVIEW_NOTE_MAX, type ReviewDecision } from "@/lib/validation/review";
import type { ReviewQueueItem } from "@/types/api";
import { reviewQualificationAction } from "../actions";

/** One pending declaration: what was declared, by whom, and the two decisions (reason required to reject). */
function ReviewCard({
  item,
  onDecided,
}: {
  item: ReviewQueueItem;
  /** The card leaves the queue once decided, so the success message lives in the parent. */
  onDecided: (notice: NoticeState) => void;
}) {
  const t = useTranslations("admin.reviews");
  const tDomain = useTranslations("domain");
  const tRoot = useTranslations();
  const locale = useLocale() as Locale;
  const [rawErrors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [pending, startTransition] = useTransition();
  const errors = resolveFieldErrors(tRoot, rawErrors);
  const noteId = `note-${item.id}`;

  function decide(decision: ReviewDecision, form: HTMLFormElement) {
    const note = String(new FormData(form).get("note") ?? "");
    setNotice(null);
    if (decision === "rejected" && note.trim() === "") {
      setErrors({ note: "v.review.reasonRequired" });
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await reviewQualificationAction({
        qualificationId: item.id,
        decision,
        note,
        expectedUpdatedAt: item.updatedAt,
      });
      if (result.ok) {
        onDecided({
          tone: "ok",
          text: `${item.type.code} · ${item.professional.displayName}: ${t(
            decision === "verified" ? "verifiedDone" : "rejectedDone",
          )}`,
        });
      } else {
        setErrors(result.fieldErrors ?? {});
        setNotice(
          result.code === "CONFLICT"
            ? { tone: "danger", text: t("alreadyDecided"), requestId: result.requestId }
            : actionErrorCopy(tRoot, result),
        );
      }
    });
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    decide(submitter?.value === "rejected" ? "rejected" : "verified", event.currentTarget);
  };

  return (
    <li className="rounded-xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-semibold">{item.type.code}</p>
          <p className="text-sm text-muted">
            {item.type.name} · {tDomain(`category.${item.type.category}`)}
          </p>
        </div>
        <StatusChip tone="warn">{tDomain("verification.pending")}</StatusChip>
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">{t("professional")}</dt>
          <dd className="font-medium">
            {item.professional.displayName}
            {item.professional.baseLocation ? ` · ${item.professional.baseLocation}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-muted">{t("declared")}</dt>
          <dd>{formatDate(locale, item.declaredAt)}</dd>
        </div>
        <div>
          <dt className="text-muted">{t("issued")}</dt>
          <dd>{item.issuedAt ? formatDate(locale, item.issuedAt) : t("notGiven")}</dd>
        </div>
        <div>
          <dt className="text-muted">{t("expires")}</dt>
          <dd>{item.expiresAt ? formatDate(locale, item.expiresAt) : t("noExpiry")}</dd>
        </div>
      </dl>
      <form onSubmit={onSubmit} noValidate className="mt-4 space-y-3">
        <Field id={noteId} label={t("note")} hint={t("noteHint")} error={errors.note}>
          <textarea
            id={noteId}
            name="note"
            rows={2}
            maxLength={REVIEW_NOTE_MAX}
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
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            value="verified"
            variant="primary"
            disabled={pending}
            aria-busy={pending}
          >
            {t("verify")}
          </Button>
          <Button type="submit" value="rejected" disabled={pending}>
            {t("reject")}
          </Button>
        </div>
      </form>
    </li>
  );
}

/** Stays mounted when the queue empties, so the last decision's confirmation remains visible. */
export function ReviewQueue({ items }: { items: ReviewQueueItem[] }) {
  const t = useTranslations("admin.reviews");
  const tRoot = useTranslations();
  const [decided, setDecided] = useState<NoticeState | null>(null);
  return (
    <div className="space-y-4">
      <Notice notice={decided} referenceLabel={tRoot("common.reference", { id: "" })} />
      {items.length === 0 ? (
        <StateMessage title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <ReviewCard key={item.id} item={item} onDecided={setDecided} />
          ))}
        </ul>
      )}
    </div>
  );
}
