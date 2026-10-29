"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { actionErrorCopy, callAction, Notice, type NoticeState } from "@/components/ui/Notice";
import { markAllNoticesReadAction, openNoticeAction } from "../actions";

/**
 * «Ver candidatura(s)» (v1.8 «Ver oportunidades»): one click marks the notice read and navigates to
 * where the server says it leads. A failure stays on the page with its reference.
 */
export function OpenNoticeButton({ id, label }: { id: string; label: string }) {
  const tRoot = useTranslations();
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setNotice(null);
            const result = await callAction(() => openNoticeAction(id));
            // Success redirects; only failures come back.
            if (!result.ok) setNotice(actionErrorCopy(tRoot, result));
          })
        }
      >
        {label}
      </Button>
      <Notice
        notice={notice}
        referenceLabel={tRoot("common.reference", { id: notice?.requestId ?? "" })}
      />
    </div>
  );
}

/**
 * v1.8 demo «Marcar todas como leídas»: the list and the shell's count re-render read. Stays mounted
 * (disabled at 0 unread) so its outcome is announced and can take the focus (X-08).
 */
export function MarkAllReadButton({ unread }: { unread: number }) {
  const t = useTranslations("notices");
  const tRoot = useTranslations();
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-2">
      <Button
        disabled={pending || unread === 0}
        onClick={() =>
          startTransition(async () => {
            setNotice(null);
            const result = await callAction(() => markAllNoticesReadAction());
            setNotice(
              result.ok ? { tone: "ok", text: t("markAllDone") } : actionErrorCopy(tRoot, result),
            );
          })
        }
      >
        {t("markAll")}
      </Button>
      <Notice
        notice={notice}
        referenceLabel={tRoot("common.reference", { id: notice?.requestId ?? "" })}
      />
    </div>
  );
}
