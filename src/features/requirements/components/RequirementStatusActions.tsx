"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { actionErrorCopy, callAction, Notice, type NoticeState } from "@/components/ui/Notice";
import { canChangeRequirementStatus, type RequirementStatus } from "@/domain/work-requirement";
import type { ChangeRequirementStatusInput } from "@/lib/validation/work-requirement";
import { changeRequirementStatusAction } from "../actions";

/**
 * V1.8 `job.status` actions (M05): «Pausar» / «Reanudar» (reversible, one click, as v1.8) and «Cerrar
 * necesidad» with an explicit second step because it cannot be undone. Which buttons show comes from
 * the domain lifecycle; the server re-checks it.
 */
export function RequirementStatusActions({
  id,
  status,
  expired,
}: {
  id: string;
  status: RequirementStatus;
  /** V1.8 «Vencida»: pausing a need whose period ended means nothing (D30 ORG-05 flags the v1.8 button). */
  expired: boolean;
}) {
  const t = useTranslations("organization.detail.close");
  const tStatus = useTranslations("organization.detail.status");
  const tRoot = useTranslations();
  const [confirming, setConfirming] = useState(false);
  // Backing out of the close step gives focus back to «Cerrar necesidad» (v2 diff: it fell to <body>).
  const closeTrigger = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  useEffect(() => {
    if (confirming || !refocus.current) return;
    refocus.current = false;
    closeTrigger.current?.focus();
  }, [confirming]);
  const backOut = () => {
    refocus.current = true;
    setConfirming(false);
  };
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [pending, startTransition] = useTransition();

  const change = (next: ChangeRequirementStatusInput["status"]) =>
    startTransition(async () => {
      setNotice(null);
      const result = await callAction(() => changeRequirementStatusAction(id, next));
      setConfirming(false);
      // Success re-renders the page with the new status (closed: its note replaces this component).
      setNotice(
        result.ok
          ? { tone: "ok", text: tStatus(next === "paused" ? "pausedDone" : "resumedDone") }
          : actionErrorCopy(tRoot, result),
      );
    });

  return (
    <div className="space-y-3">
      {confirming ? (
        <div
          role="group"
          onKeyDown={(e) => e.key === "Escape" && backOut()}
          aria-label={t("action")}
          className="space-y-3 rounded-lg border border-line p-4"
        >
          <p className="text-sm">{t("explain")}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" disabled={pending} onClick={() => change("closed")}>
              {t("confirm")}
            </Button>
            {/* Focus lands on the safe choice when the irreversible step opens. */}
            <Button autoFocus disabled={pending} onClick={backOut}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {!expired && canChangeRequirementStatus(status, "paused") && (
            <Button disabled={pending} onClick={() => change("paused")}>
              {tStatus("pause")}
            </Button>
          )}
          {canChangeRequirementStatus(status, "open") && (
            <Button variant="primary" disabled={pending} onClick={() => change("open")}>
              {tStatus("resume")}
            </Button>
          )}
          {canChangeRequirementStatus(status, "closed") && (
            <Button ref={closeTrigger} disabled={pending} onClick={() => setConfirming(true)}>
              {t("action")}
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
