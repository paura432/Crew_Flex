"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { actionErrorCopy, Notice, type NoticeState } from "@/components/ui/Notice";
import { closeRequirementAction } from "../actions";

/** V1.8 `job.status` → closed, with an explicit second step because it cannot be undone. */
export function CloseRequirement({ id }: { id: string }) {
  const t = useTranslations("organization.detail.close");
  const tRoot = useTranslations();
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [pending, startTransition] = useTransition();

  const close = () =>
    startTransition(async () => {
      const result = await closeRequirementAction(id);
      setConfirming(false);
      setNotice(result.ok ? { tone: "ok", text: t("done") } : actionErrorCopy(tRoot, result));
    });

  return (
    <div className="space-y-3">
      {confirming ? (
        <div className="space-y-3 rounded-lg border border-line p-4">
          <p className="text-sm">{t("explain")}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={pending} onClick={close}>
              {t("confirm")}
            </Button>
            <Button disabled={pending} onClick={() => setConfirming(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setConfirming(true)}>{t("action")}</Button>
      )}
      <Notice
        notice={notice}
        referenceLabel={tRoot("common.reference", { id: notice?.requestId ?? "" })}
      />
    </div>
  );
}
