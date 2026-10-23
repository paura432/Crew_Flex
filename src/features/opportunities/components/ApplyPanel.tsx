"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { callAction, Notice, type NoticeState } from "@/components/ui/Notice";
import type { ApplicationStatus, ApplyBlocker } from "@/domain/applications";
import { applyAction } from "@/features/applications/actions";
import { applicationErrorCopy } from "@/features/applications/error-copy";
import { useIdempotencyKey } from "@/lib/idempotency";

/**
 * «Presentar candidatura» (D-06 ∅ → received). The technician authorises, explicitly and for this
 * requirement only, that its organization sees what the candidate pool shows plus the dated Candidate Pack
 * copy previewed above the consent (v1.8 consent; D-07 keeps identity, contact and documents locked). The
 * server re-checks every rule (T-08, Q5, Q6). For a staffing agency's requirement the consent names the agency
 * AND its represented client (RECRUITER_MODEL §2, v1.8 «Alcance y destinatario: {org} para {cliente}», BR-27).
 */
export function ApplyPanel({
  requirementId,
  organizationName,
  clientName = null,
  blocker,
  myStatus,
  packPreview,
}: {
  requirementId: string;
  organizationName: string;
  clientName?: string | null;
  blocker: ApplyBlocker | null;
  myStatus: ApplicationStatus | null;
  /**
   * v2-15/v2-04 «Qué compartes»: the server-rendered preview of the Candidate Pack copy the organization will
   * receive (same database builder as the copy). Null = it could not be loaded: then nothing can be sent,
   * because the professional must see the copy's content before consenting (T-111).
   */
  packPreview: ReactNode | null;
}) {
  const t = useTranslations("opportunities.apply");
  const tRecruiter = useTranslations("recruiter.opportunity");
  const recipients = { organization: organizationName, client: clientName ?? "" };
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
        <p className="font-semibold">
          {clientName
            ? tRecruiter("sharedTitle", recipients)
            : t("sharedTitle", { organization: organizationName })}
        </p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
          <li>{t("sharedQualifications")}</li>
          <li>{t("sharedAvailability")}</li>
          <li>{t("sharedIdentity")}</li>
          <li>{tRoot("candidatePack.sharedCopy")}</li>
          <li>{t("notShared")}</li>
        </ul>
      </div>
      {packPreview ?? <p className="text-sm text-danger">{tRoot("candidatePack.previewError")}</p>}
      <label className="flex items-start gap-2 text-sm pointer-coarse:min-h-11 pointer-coarse:items-center">
        <input
          type="checkbox"
          className="mt-0.5 size-4"
          checked={consent}
          disabled={pending || !packPreview}
          onChange={(e) => setConsent(e.target.checked)}
        />
        {clientName
          ? tRecruiter("consent", recipients)
          : t("consent", { organization: organizationName })}
      </label>
      <Button
        type="submit"
        variant="primary"
        disabled={pending || !consent || !packPreview}
        aria-busy={pending}
      >
        {pending ? t("sending") : t("submit")}
      </Button>
      <Notice
        notice={notice}
        referenceLabel={tRoot("common.reference", { id: notice?.requestId ?? "" })}
      />
    </form>
  );
}
