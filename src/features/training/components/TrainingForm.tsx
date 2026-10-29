"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { callAction, Notice, type NoticeState } from "@/components/ui/Notice";
import { decimalToCents } from "@/domain/training";
import { useIdempotencyKey } from "@/lib/idempotency";
import type { TrainingWrite } from "@/lib/validation/training";
import { trainingWriteAction } from "../actions";
import { trainingErrorCopy } from "../error-copy";
import { utcInputToIso } from "../view";

/**
 * Every training write except the edition editor: the server-rendered fields (children) are read from the form,
 * coerced by name (numbers, cents, checkboxes, UTC instants), merged over `fixed` and sent as `{ op, input }` to the
 * single server action. Empty fields are omitted (optional texts become null on the server).
 */
export function TrainingForm({
  op,
  fixed = {},
  numbers = [],
  cents = [],
  booleans = [],
  instants = [],
  submitLabel,
  successText,
  variant = "secondary",
  children,
  className = "space-y-3",
  redirectTo,
}: {
  op: TrainingWrite["op"];
  fixed?: Record<string, unknown>;
  numbers?: string[];
  cents?: string[];
  booleans?: string[];
  instants?: string[];
  submitLabel: string;
  successText: string;
  variant?: "primary" | "secondary" | "danger";
  children?: ReactNode;
  className?: string;
  /** After a create: go to the new record (`{id}` is replaced by the saved id). */
  redirectTo?: string;
}) {
  const tRoot = useTranslations();
  const router = useRouter();
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [pending, startTransition] = useTransition();
  const idempotency = useIdempotencyKey();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input: Record<string, unknown> = { ...fixed };
    const data = new FormData(event.currentTarget);
    for (const name of new Set(data.keys())) {
      const raw = String(data.get(name) ?? "").trim();
      if (booleans.includes(name)) input[name] = true;
      else if (raw === "") continue;
      else if (numbers.includes(name)) input[name] = Number(raw);
      else if (cents.includes(name)) input[name] = decimalToCents(raw) ?? Number.NaN;
      else if (instants.includes(name)) input[name] = utcInputToIso(raw);
      else input[name] = raw;
    }
    const body = { op, input } as TrainingWrite;
    setNotice(null);
    startTransition(async () => {
      const result = await callAction(() => trainingWriteAction(body, idempotency.keyFor(body)));
      if (result.ok) {
        idempotency.release();
        setNotice({ tone: "ok", text: successText });
        const id = (result.data as { id?: string; request?: { id: string } } | null)?.id;
        if (redirectTo && id) router.push(redirectTo.replace("{id}", id));
        else router.refresh();
      } else {
        setNotice(trainingErrorCopy(tRoot, result));
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className={className} noValidate>
      {children}
      <Button type="submit" variant={variant} disabled={pending} aria-busy={pending}>
        {submitLabel}
      </Button>
      <Notice
        notice={notice}
        referenceLabel={tRoot("common.reference", { id: notice?.requestId ?? "" })}
      />
    </form>
  );
}
