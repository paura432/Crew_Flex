"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Field";
import { callAction, Notice, type NoticeState } from "@/components/ui/Notice";
import {
  availableTransitions,
  REASON_MAX,
  type ApplicationActor,
  type ApplicationStatus,
  type ApplicationTransition,
} from "@/domain/applications";
import { useIdempotencyKey } from "@/lib/idempotency";
import { transitionApplicationAction } from "../actions";
import { applicationErrorCopy } from "../error-copy";
import { transitionLabelKey } from "../view";

/**
 * The buttons of one application for one side (D-06): which ones come from the domain table, the
 * server re-checks everything. Every step that creates, changes or ends a commitment asks first;
 * rejecting and cancelling need a reason (shown to the other party, T-10); accepting names the
 * proposal version and needs an explicit tick (R-08). Only «Preseleccionar» is one click.
 */
export function ApplicationActions({
  applicationId,
  status,
  updatedAt,
  actor,
  proposal,
  periodEnded,
  requirementOpen,
}: {
  applicationId: string;
  status: ApplicationStatus;
  updatedAt: string;
  actor: ApplicationActor;
  proposal: { id: string; version: number } | null;
  /** Q4: finishing waits for the last day. */
  periodEnded: boolean;
  /** Shortlist, propose and confirm need an open requirement (the server says so anyway). */
  requirementOpen: boolean;
}) {
  const t = useTranslations("applications.action");
  const tDomain = useTranslations("domain");
  const tRoot = useTranslations();
  const [asking, setAsking] = useState<ApplicationTransition | null>(null);
  // Backing out of a step (button or Escape) gives focus back to the button that opened it.
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const returnTo = useRef<string | null>(null);
  const keyOf = (tr: ApplicationTransition) => `${tr.to}-${tr.actor}`;
  useEffect(() => {
    if (asking || !returnTo.current) return;
    triggers.current.get(returnTo.current)?.focus();
    returnTo.current = null;
  }, [asking]);
  const backOut = () => {
    if (asking) returnTo.current = keyOf(asking);
    setAsking(null);
  };
  const [reason, setReason] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [pending, startTransition] = useTransition();
  const idempotency = useIdempotencyKey();

  const needsOpen = (to: ApplicationStatus) =>
    to === "shortlisted" || to === "proposed" || to === "confirmed";
  const transitions = availableTransitions(status, actor).filter(
    (tr) => requirementOpen || !needsOpen(tr.to),
  );
  if (transitions.length === 0 && !notice) return null;

  function send(tr: ApplicationTransition) {
    const input = {
      applicationId,
      to: tr.to,
      expectedUpdatedAt: updatedAt,
      ...(tr.reason ? { reason } : {}),
      ...(tr.to === "accepted" ? { proposalId: proposal?.id, acceptTerms } : {}),
    };
    setNotice(null);
    startTransition(async () => {
      const result = await callAction(() =>
        transitionApplicationAction(input, idempotency.keyFor(input)),
      );
      if (result.ok) {
        idempotency.release();
        setAsking(null);
        setReason("");
        setAcceptTerms(false);
        setNotice({
          tone: "ok",
          text: t("done", { status: tDomain(`applicationStatus.${tr.to}`) }),
        });
      } else {
        setNotice(applicationErrorCopy(tRoot, result));
      }
    });
  }

  const hint = (tr: ApplicationTransition) =>
    tr.to === "confirmed"
      ? t("confirmHint")
      : tr.to === "withdrawn"
        ? t("withdrawHint")
        : tr.to === "proposed"
          ? t("proposeHint")
          : // v1.8 «Cancelar asignación» modal (Workflow.jsx:85, v2-26): what cancelling a seat does.
            tr.to === "cancelled" && tr.from === "confirmed"
            ? t("cancelAssignmentHint")
            : null;

  return (
    <div className="space-y-3">
      {asking ? (
        <div
          role="group"
          onKeyDown={(e) => e.key === "Escape" && backOut()}
          aria-label={t(transitionLabelKey(asking))}
          className="space-y-3 rounded-lg border border-line p-4"
        >
          {hint(asking) && <p className="text-sm">{hint(asking)}</p>}
          {asking.reason && (
            <label className="block text-sm font-semibold">
              {t("reasonLabel")}
              <textarea
                autoFocus
                required
                maxLength={REASON_MAX}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={`${controlClass} mt-1 min-h-20`}
                aria-describedby={`${applicationId}-reason-hint`}
              />
              <span
                id={`${applicationId}-reason-hint`}
                className="mt-1 block font-normal text-muted"
              >
                {t("reasonHint")}
              </span>
            </label>
          )}
          {asking.to === "accepted" && proposal && (
            <label className="flex items-start gap-2 text-sm pointer-coarse:min-h-11 pointer-coarse:items-center">
              <input
                autoFocus
                type="checkbox"
                className="mt-0.5 size-4"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
              />
              {t("acceptTerms", { version: proposal.version })}
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={asking.reason || asking.to === "withdrawn" ? "danger" : "primary"}
              disabled={
                pending ||
                (asking.reason === true && reason.trim() === "") ||
                (asking.to === "accepted" && !acceptTerms)
              }
              aria-busy={pending}
              onClick={() => send(asking)}
            >
              {t(transitionLabelKey(asking))}
            </Button>
            <Button
              autoFocus={!asking.reason && asking.to !== "accepted"}
              disabled={pending}
              onClick={backOut}
            >
              {t("back")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {transitions.map((tr) =>
            tr.to === "finished" && !periodEnded ? (
              <Button
                key={tr.to}
                disabled
                title={t("finishHint")}
                aria-describedby={`${applicationId}-finish`}
              >
                {t("finished")}
                <span id={`${applicationId}-finish`} className="sr-only">
                  {t("finishHint")}
                </span>
              </Button>
            ) : (
              <Button
                key={keyOf(tr)}
                ref={(el) => {
                  if (el) triggers.current.set(keyOf(tr), el);
                  else triggers.current.delete(keyOf(tr));
                }}
                variant={
                  tr.reason || tr.to === "withdrawn"
                    ? "danger"
                    : tr.to === "confirmed" || tr.to === "accepted"
                      ? "primary"
                      : "secondary"
                }
                disabled={pending}
                onClick={() => (tr.to === "shortlisted" ? send(tr) : setAsking(tr))}
              >
                {t(transitionLabelKey(tr))}
              </Button>
            ),
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
