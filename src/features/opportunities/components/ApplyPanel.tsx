"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { callAction, Notice, type NoticeState } from "@/components/ui/Notice";
import type { ApplicationStatus, ApplyBlocker } from "@/domain/applications";
import { applyAction } from "@/features/applications/actions";
import { applicationErrorCopy } from "@/features/applications/error-copy";
import { useIdempotencyKey } from "@/lib/idempotency";

/**
 * «Presentar candidatura» (D-06 ∅ → received). The technician authorises, explicitly and for this
 * requirement only, that its organization sees what the candidate pool shows (v1.8 consent; D-07
 * keeps contact and documents locked). The server re-checks every rule (T-08, Q5, Q6).
 */
export function ApplyPanel({
  requirementId,
  organizationName,
  blocker,
  myStatus,
}: {
  requirementId: string;
  organizationName: string;
  blocker: ApplyBlocker | null;
  myStatus: ApplicationStatus | null;
}) {
  const t = useTranslations("opportunities.apply");
  const tDomain = useTranslations("domain");
  const tRoot = useTranslations();
  const [consent, setConsent] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [pending, startTransition] = useTransition();
  const idempotency = useIdempotencyKey();

  if (blocker) {
    return (
      <div className="space-y-2 text-sm">
        <p>
          {t(`blocker.${blocker}`, {
            status: myStatus ? tDomain(`applicationStatus.${myStatus}`).toLowerCase() : "",
          })}
        </p>
        {myStatus && (
          <Link
            href="/app/professional/applications"
            className="inline-flex items-center font-semibold text-blue hover:underline pointer-coarse:min-h-11"
          >
            {t("toApplications")}
          </Link>
        )}
        <Notice
          notice={notice}
          referenceLabel={tRoot("common.reference", { id: notice?.requestId ?? "" })}
        />
      </div>
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = { requirementId, shareConsent: consent };
    setNotice(null);
    startTransition(async () => {
      const result = await callAction(() => applyAction(input, idempotency.keyFor(input)));
      if (result.ok) {
        idempotency.release();
        setNotice({ tone: "ok", text: t("sent") });
      } else {
        setNotice(applicationErrorCopy(tRoot, result));
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="rounded-lg border border-line bg-canvas px-4 py-3 text-sm">
        <p className="font-semibold">{t("sharedTitle", { organization: organizationName })}</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
          <li>{t("sharedQualifications")}</li>
          <li>{t("sharedAvailability")}</li>
          <li>{t("sharedIdentity")}</li>
          <li>{t("notShared")}</li>
        </ul>
      </div>
      <label className="flex items-start gap-2 text-sm pointer-coarse:min-h-11 pointer-coarse:items-center">
        <input
          type="checkbox"
          className="mt-0.5 size-4"
          checked={consent}
          disabled={pending}
          onChange={(e) => setConsent(e.target.checked)}
        />
        {t("consent", { organization: organizationName })}
      </label>
      <Button type="submit" variant="primary" disabled={pending || !consent} aria-busy={pending}>
        {pending ? t("sending") : t("submit")}
      </Button>
      <Notice
        notice={notice}
        referenceLabel={tRoot("common.reference", { id: notice?.requestId ?? "" })}
      />
    </form>
  );
}
