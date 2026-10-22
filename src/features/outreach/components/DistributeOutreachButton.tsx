"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { actionErrorCopy, callAction, Notice, type NoticeState } from "@/components/ui/Notice";
import { OUTREACH_CONFLICTS, type OutreachConflict } from "@/domain/outreach";
import { distributeOutreachAction } from "../actions";

const isOutreachConflict = (reason: unknown): reason is OutreachConflict =>
  (OUTREACH_CONFLICTS as readonly unknown[]).includes(reason);

/**
 * v1.8 connected «Distribuir aviso Urgente / AOG» (`Account.jsx:69`) and its result line, with an ICU
 * plural («1 aviso interno creado», v1.8 said «1 avisos»). Stays mounted after success so the result is
 * still announced once the page re-renders without the button (`offered` turns false).
 */
export function DistributeOutreachButton({
  requirementId,
  offered,
}: {
  requirementId: string;
  offered: boolean;
}) {
  const t = useTranslations("outreach.distribution");
  const tRoot = useTranslations();
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [pending, startTransition] = useTransition();

  const distribute = () =>
    startTransition(async () => {
      setNotice(null);
      const result = await callAction(() => distributeOutreachAction(requirementId));
      if (result.ok) {
        setNotice({ tone: "ok", text: t("result", { count: result.distribution.notified }) });
      } else if (result.code === "CONFLICT" && isOutreachConflict(result.reason)) {
        setNotice({
          tone: "danger",
          text: t(`conflict.${result.reason}`),
          requestId: result.requestId,
        });
      } else {
        setNotice(actionErrorCopy(tRoot, result));
      }
    });

  return (
    <div className="space-y-3">
      {offered && (
        <Button variant="primary" disabled={pending} aria-busy={pending} onClick={distribute}>
          {t("button")}
        </Button>
      )}
      <Notice
        notice={notice}
        referenceLabel={tRoot("common.reference", { id: notice?.requestId ?? "" })}
      />
    </div>
  );
}
