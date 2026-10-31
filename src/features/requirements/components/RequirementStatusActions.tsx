"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Notice, type NoticeState } from "@/components/ui/Notice";
import { actionErrorCopy, callAction } from "@/components/ui/action-result";
import {
  canArchive,
  canChangeRequirementStatus,
  type RequirementStatus,
} from "@/domain/work-requirement";
import type { ChangeRequirementStatusInput } from "@/lib/validation/work-requirement";
import { translateKey } from "@/i18n/validation";
import { archiveRequirementAction, changeRequirementStatusAction } from "../actions";

type Step = "close" | "archive" | null;

type StatusT = ReturnType<typeof useTranslations<"organization.detail.status">>;
type DraftT = ReturnType<typeof useTranslations<"organization.detail.draft">>;
type RootT = ReturnType<typeof useTranslations>;

/** The outcome of a status change: done, an active-commitments conflict, an incomplete draft, or the error. */
function changeNotice(
  result: Awaited<
    ReturnType<typeof callAction<Awaited<ReturnType<typeof changeRequirementStatusAction>>>>
  >,
  next: ChangeRequirementStatusInput["status"],
  status: RequirementStatus,
  { tStatus, tDraft, tRoot }: { tStatus: StatusT; tDraft: DraftT; tRoot: RootT },
): NoticeState {
  if (result.ok) {
    const done =
      next === "paused" ? "pausedDone" : status === "draft" ? "publishedDone" : "resumedDone";
    return { tone: "ok", text: tStatus(done) };
  }
  if (result.code === "CONFLICT") {
    return {
      tone: "danger",
      // v2 diff ORG-05: closing with active commitments showed the qualifications copy.
      text:
        "reason" in result && result.reason
          ? translateKey(tRoot, `applications.conflict.${result.reason}`)
          : tStatus("conflict"),
      requestId: result.requestId,
    };
  }
  if (result.code === "VALIDATION_ERROR" && status === "draft") {
    return { tone: "danger", text: tDraft("incomplete"), requestId: result.requestId };
  }
  return actionErrorCopy(tRoot, result);
}

/** The explicit second step of «Cerrar necesidad» or «Archivar» (neither can be undone). */
function ConfirmStep({
  step,
  status,
  pending,
  onConfirm,
  onBack,
}: {
  step: Exclude<Step, null>;
  status: RequirementStatus;
  pending: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("organization.detail.close");
  const tArchive = useTranslations("organization.detail.archive");
  const closing = step === "close";
  return (
    <div
      role="group"
      onKeyDown={(e) => e.key === "Escape" && onBack()}
      aria-label={closing ? t("action") : tArchive("action")}
      className="space-y-3 rounded-lg border border-line p-4"
    >
      <p className="text-sm">
        {closing ? t("explain") : tArchive(status === "draft" ? "explainDraft" : "explainClosed")}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="danger" disabled={pending} onClick={onConfirm}>
          {closing ? t("confirm") : tArchive("confirm")}
        </Button>
        {/* Focus lands on the safe choice when the irreversible step opens. */}
        <Button autoFocus disabled={pending} onClick={onBack}>
          {closing ? t("cancel") : tArchive("cancel")}
        </Button>
      </div>
    </div>
  );
}

/**
 * V1.8 `job.status` actions (M05): «Pausar» / «Reanudar» (reversible, one click, as v1.8), «Publicar» for a draft
 * (v2-14: the server applies the creation rules first), «Cerrar necesidad» and «Archivar» (v1.8, one way; T-64)
 * with an explicit second step because neither can be undone. Which buttons show comes from the domain
 * lifecycle; the server re-checks it.
 */
export function RequirementStatusActions({
  id,
  status,
  expired,
  archivedAt = null,
}: {
  id: string;
  status: RequirementStatus;
  /** V1.8 «Vencida»: pausing a need whose period ended means nothing (D30 ORG-05 flags the v1.8 button). */
  expired: boolean;
  archivedAt?: string | null;
}) {
  const t = useTranslations("organization.detail.close");
  const tStatus = useTranslations("organization.detail.status");
  const tArchive = useTranslations("organization.detail.archive");
  const tDraft = useTranslations("organization.detail.draft");
  const tRoot = useTranslations();
  const [step, setStep] = useState<Step>(null);
  // Backing out of a confirmation gives focus back to the button that opened it (v2 diff: it fell to <body>).
  const closeTrigger = useRef<HTMLButtonElement>(null);
  const archiveTrigger = useRef<HTMLButtonElement>(null);
  const refocus = useRef<Step>(null);
  useEffect(() => {
    if (step || !refocus.current) return;
    (refocus.current === "close" ? closeTrigger : archiveTrigger).current?.focus();
    refocus.current = null;
  }, [step]);
  const backOut = () => {
    refocus.current = step;
    setStep(null);
  };
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [pending, startTransition] = useTransition();

  const change = (next: ChangeRequirementStatusInput["status"]) =>
    startTransition(async () => {
      setNotice(null);
      const result = await callAction(() => changeRequirementStatusAction(id, next));
      setStep(null);
      // Success re-renders the page with the new status (closed: its note replaces this component).
      setNotice(changeNotice(result, next, status, { tStatus, tDraft, tRoot }));
    });

  const archive = () =>
    startTransition(async () => {
      setNotice(null);
      // Success redirects to the archived page (this component unmounts there): only failures land here.
      const result = await callAction(() => archiveRequirementAction(id));
      setStep(null);
      if (result.ok) return;
      setNotice(
        result.code === "CONFLICT"
          ? { tone: "danger", text: tStatus("conflict"), requestId: result.requestId }
          : actionErrorCopy(tRoot, result),
      );
    });

  const archivable = canArchive({ status, archivedAt });
  return (
    <div className="space-y-3">
      {step ? (
        <ConfirmStep
          step={step}
          status={status}
          pending={pending}
          onConfirm={() => (step === "close" ? change("closed") : archive())}
          onBack={backOut}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {!expired && canChangeRequirementStatus(status, "paused") && (
            <Button disabled={pending} onClick={() => change("paused")}>
              {tStatus("pause")}
            </Button>
          )}
          {canChangeRequirementStatus(status, "open") && (
            <Button variant="primary" disabled={pending} onClick={() => change("open")}>
              {tStatus(status === "draft" ? "publish" : "resume")}
            </Button>
          )}
          {canChangeRequirementStatus(status, "closed") && status !== "draft" && (
            <Button ref={closeTrigger} disabled={pending} onClick={() => setStep("close")}>
              {t("action")}
            </Button>
          )}
          {archivable && (
            <Button ref={archiveTrigger} disabled={pending} onClick={() => setStep("archive")}>
              {tArchive("action")}
            </Button>
          )}
        </div>
      )}
      <Notice
        notice={notice}
        referenceLabel={tRoot("common.reference", { id: notice?.requestId ?? "" })}
      />
    </div>
  );
}
