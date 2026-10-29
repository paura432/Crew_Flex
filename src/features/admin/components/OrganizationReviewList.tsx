"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { controlClass, describedBy, Field } from "@/components/ui/Field";
import { actionErrorCopy, callAction, Notice, type NoticeState } from "@/components/ui/Notice";
import { StateMessage } from "@/components/ui/StateMessage";
import { StatusChip } from "@/components/ui/StatusChip";
import { ORGANIZATION_REVIEW_NOTE_MAX, reviewBlocker } from "@/domain/organization";
import { countryName } from "@/features/organizations/countries";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import { resolveFieldErrors } from "@/i18n/validation";
import type { FieldErrors } from "@/lib/validation/errors";
import type { OrganizationReviewItem } from "@/types/api";
import { reviewOrganizationAction } from "../actions";

/** One organization: the data under review and, when it can be reviewed, the evidence + action. */
function OrganizationCard({
  item,
  onReviewed,
}: {
  item: OrganizationReviewItem;
  onReviewed: (notice: NoticeState) => void;
}) {
  const t = useTranslations("admin.organizations");
  const tRoot = useTranslations();
  const locale = useLocale() as Locale;
  const [rawErrors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [pending, startTransition] = useTransition();
  const errors = resolveFieldErrors(tRoot, rawErrors);
  const blocker = reviewBlocker(item, item.ownOrganization);
  const noteId = `note-${item.id}`;
  const reviewed = item.reviewStatus === "reviewed";

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = String(new FormData(event.currentTarget).get("note") ?? "");
    setNotice(null);
    if (note.trim() === "") {
      setErrors({ note: "v.organizationReview.noteRequired" });
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await callAction(() =>
        reviewOrganizationAction({
          organizationId: item.id,
          expectedUpdatedAt: item.updatedAt,
          note,
        }),
      );
      if (result.ok) {
        onReviewed({ tone: "ok", text: t("reviewedDone", { name: item.name }) });
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
          <p className="text-sm text-muted">
            {tRoot(`auth.orgType.${item.type}`)}
            {item.country ? ` · ${countryName(locale, item.country)}` : ""}
          </p>
        </div>
        <StatusChip tone={reviewed ? "ok" : "warn"}>
          {t(reviewed ? "statusReviewed" : "statusPending")}
        </StatusChip>
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">{t("taxId")}</dt>
          <dd className="font-mono break-all">{item.taxId ?? t("notGiven")}</dd>
        </div>
        <div>
          <dt className="text-muted">{t("taxAddress")}</dt>
          <dd className="break-words">{item.taxAddress ?? t("notGiven")}</dd>
        </div>
      </dl>
      {blocker === "own" ? (
        <p className="mt-4 text-sm text-muted">{t("own")}</p>
      ) : blocker === "reviewed" ? (
        <p className="mt-4 text-sm text-muted">
          {item.reviewedAt ? t("reviewedOn", { date: formatDate(locale, item.reviewedAt) }) : null}
        </p>
      ) : blocker === "incomplete" ? (
        <p className="mt-4 text-sm text-muted">{t("incomplete")}</p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-4 space-y-3">
          <Field id={noteId} label={t("note")} hint={t("noteHint")} error={errors.note}>
            <textarea
              id={noteId}
              name="note"
              rows={3}
              required
              maxLength={ORGANIZATION_REVIEW_NOTE_MAX}
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
            {t("register")}
          </Button>
        </form>
      )}
    </li>
  );
}

/** Stays mounted after a review, so its confirmation remains visible when the card changes. */
export function OrganizationReviewList({ items }: { items: OrganizationReviewItem[] }) {
  const t = useTranslations("admin.organizations");
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
            <OrganizationCard key={item.id} item={item} onReviewed={setDone} />
          ))}
        </ul>
      )}
    </div>
  );
}
