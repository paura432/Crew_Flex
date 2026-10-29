"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { actionErrorCopy, callAction, Notice, type NoticeState } from "@/components/ui/Notice";
import { revokeClientAction } from "../actions";

/**
 * «Revocar» with an explicit second step (final, T-130): the agency's requirements for this client stop being shown
 * and stop moving forward (BR-27.5). The server re-checks the role. The panel keeps this component mounted once the
 * client is revoked (`revocable` false: no button) so the confirmation survives the list refresh the action triggers.
 */
export function RevokeClientButton({
  id,
  name,
  revocable = true,
}: {
  id: string;
  name: string;
  revocable?: boolean;
}) {
  const t = useTranslations("recruiter.clients");
  const tRoot = useTranslations();
  const [confirming, setConfirming] = useState(false);
  // Revoked here: no «Revocar» again while the list refresh that follows the action is still on its way
  // (the stale `revocable` prop would otherwise offer a second revoke for a moment).
  const [revoked, setRevoked] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [pending, startTransition] = useTransition();

  function revoke() {
    setNotice(null);
    startTransition(async () => {
      const result = await callAction(() => revokeClientAction(id));
      if (result.ok) {
        setConfirming(false);
        setRevoked(true);
        setNotice({ tone: "ok", text: t("revoked", { name }) });
      } else {
        setNotice(actionErrorCopy(tRoot, result));
      }
    });
  }

  return (
    <div className="space-y-2">
      {confirming ? (
        <div role="group" aria-label={t("revokeAria", { name })} className="space-y-2">
          <p className="text-sm text-danger">{t("revokeConfirm", { name })}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="danger"
              onClick={revoke}
              disabled={pending}
              aria-busy={pending}
            >
              {pending ? t("revoking") : t("revokeConfirmButton")}
            </Button>
            <Button size="sm" onClick={() => setConfirming(false)} disabled={pending}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : revocable && !revoked ? (
        <Button
          size="sm"
          variant="ghost"
          aria-label={t("revokeAria", { name })}
          onClick={() => setConfirming(true)}
        >
          {t("revoke")}
        </Button>
      ) : null}
      <Notice
        notice={notice}
        referenceLabel={tRoot("common.reference", { id: notice?.requestId ?? "" })}
      />
    </div>
  );
}
