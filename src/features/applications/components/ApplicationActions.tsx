"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Field";
import { Notice, type NoticeState } from "@/components/ui/Notice";
import { callAction } from "@/components/ui/action-result";
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
/** Shortlist, propose and confirm need an open requirement. */
const NEEDS_OPEN = new Set<ApplicationStatus>(["shortlisted", "proposed", "confirmed"]);
const needsOpen = (to: ApplicationStatus) => NEEDS_OPEN.has(to);

const variantOf = (tr: ApplicationTransition) =>
  tr.reason || tr.to === "withdrawn"
    ? "danger"
    : tr.to === "confirmed" || tr.to === "accepted"
      ? "primary"
      : "secondary";

/** The explanation shown before a step, or null (v2-26: what cancelling a confirmed seat does). */
function hintKey(tr: ApplicationTransition) {
  if (tr.to === "confirmed") return "confirmHint" as const;
  if (tr.to === "withdrawn") return "withdrawHint" as const;
  if (tr.to === "proposed") return "proposeHint" as const;
  // v1.8 «Cancelar asignación» modal (Workflow.jsx:85, v2-26): what cancelling a seat does.
  if (tr.to === "cancelled" && tr.from === "confirmed") return "cancelAssignmentHint" as const;
  return null;
}

/** The confirmation of one step: its hint, the reason or the explicit tick, then go or back. */
function ConfirmStep({
  asking,
  applicationId,
  proposalVersion,
  reason,
  onReason,
  acceptTerms,
  onAcceptTerms,
  pending,
  onSend,
  onBack,
}: {
  asking: ApplicationTransition;
  applicationId: string;
  proposalVersion: number | null;
  reason: string;
  onReason: (value: string) => void;
  acceptTerms: boolean;
  onAcceptTerms: (value: boolean) => void;
  pending: boolean;
  onSend: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("applications.action");
  const hint = hintKey(asking);
  const accepting = asking.to === "accepted";
  const blocked = (asking.reason === true && reason.trim() === "") || (accepting && !acceptTerms);
  return (
    <div
      role="group"
      onKeyDown={(e) => e.key === "Escape" && onBack()}
      aria-label={t(transitionLabelKey(asking))}
      className="space-y-3 rounded-lg border border-line p-4"
    >
      {hint && <p className="text-sm">{t(hint)}</p>}
      {asking.reason && (
        <label className="block text-sm font-semibold">
          {t("reasonLabel")}
          <textarea
            autoFocus
            required
            maxLength={REASON_MAX}
            value={reason}
            onChange={(e) => onReason(e.target.value)}
            className={`${controlClass} mt-1 min-h-20`}
            aria-describedby={`${applicationId}-reason-hint`}
          />
          <span id={`${applicationId}-reason-hint`} className="mt-1 block font-normal text-muted">
            {t("reasonHint")}
          </span>
        </label>
      )}
      {accepting && proposalVersion !== null && (
        <label className="flex items-start gap-2 text-sm pointer-coarse:min-h-11 pointer-coarse:items-center">
          <input
            autoFocus
            type="checkbox"
            className="mt-0.5 size-4"
            checked={acceptTerms}
            onChange={(e) => onAcceptTerms(e.target.checked)}
          />
          {t("acceptTerms", { version: proposalVersion })}
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={asking.reason || asking.to === "withdrawn" ? "danger" : "primary"}
          disabled={pending || blocked}
          aria-busy={pending}
          onClick={onSend}
        >
          {t(transitionLabelKey(asking))}
        </Button>
        <Button autoFocus={!asking.reason && !accepting} disabled={pending} onClick={onBack}>
          {t("back")}
        </Button>
      </div>
    </div>
  );
}

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

  return (
    <div className="space-y-3">
      {asking ? (
        <ConfirmStep
          asking={asking}
          applicationId={applicationId}
          proposalVersion={proposal?.version ?? null}
          reason={reason}
          onReason={setReason}
          acceptTerms={acceptTerms}
          onAcceptTerms={setAcceptTerms}
          pending={pending}
          onSend={() => send(asking)}
          onBack={backOut}
        />
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
                variant={variantOf(tr)}
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
