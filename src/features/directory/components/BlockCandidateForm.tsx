"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { actionErrorCopy, Notice, type NoticeState } from "@/components/ui/Notice";
import { DIRECTORY_CONFLICTS, type DirectoryConflict } from "@/domain/directory";
import { blockCandidateAction } from "../actions";

const isDirectoryConflict = (reason: unknown): reason is DirectoryConflict =>
  (DIRECTORY_CONFLICTS as readonly unknown[]).includes(reason);

/**
 * v2-16 «Bloquear» / «Desbloquear» on a directory card: a form action (works without JavaScript); the card
 * leaves the list when the page re-renders, so the notice only has to carry a refusal.
 */
export function BlockCandidateForm({
  candidateRef,
  blocked,
}: {
  candidateRef: string;
  blocked: boolean;
}) {
  const t = useTranslations("directory");
  const tRoot = useTranslations();
  const [state, action, pending] = useActionState(blockCandidateAction, null);
  const notice: NoticeState | null =
    state === null
      ? null
      : state.ok
        ? { tone: "ok", text: t(state.blocked ? "card.blocked" : "card.unblocked") }
        : state.code === "CONFLICT" && isDirectoryConflict(state.reason)
          ? { tone: "danger", text: t(`conflict.${state.reason}`), requestId: state.requestId }
          : actionErrorCopy(tRoot, state);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="candidateRef" value={candidateRef} />
      <input type="hidden" name="blocked" value={blocked ? "0" : "1"} />
      <Button
        type="submit"
        variant={blocked ? "primary" : "ghost"}
        disabled={pending}
        aria-busy={pending}
      >
        {blocked ? t("card.unblock") : t("card.block")}
      </Button>
      <Notice
        notice={notice}
        referenceLabel={tRoot("common.reference", { id: notice?.requestId ?? "" })}
      />
    </form>
  );
}
