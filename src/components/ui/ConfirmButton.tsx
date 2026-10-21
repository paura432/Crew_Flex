"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";

/**
 * Two-step destructive row action (V1.8 asks before removing): the first click only reveals
 * «confirm» and «cancel», nothing is sent until confirm. Focus lands on cancel, the safe choice,
 * and returns to the trigger when the user backs out.
 */
export function ConfirmButton({
  label,
  confirmLabel,
  cancelLabel,
  onConfirm,
  disabled = false,
  className = "",
}: {
  label: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const [asking, setAsking] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);

  useEffect(() => {
    if (asking || !refocus.current) return;
    refocus.current = false;
    trigger.current?.focus();
  }, [asking]);

  if (!asking) {
    return (
      <Button
        ref={trigger}
        className={`${className} text-danger`}
        disabled={disabled}
        onClick={() => setAsking(true)}
      >
        {label}
      </Button>
    );
  }
  return (
    <>
      <Button
        className={`${className} text-danger`}
        disabled={disabled}
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </Button>
      <Button
        autoFocus
        className={className}
        disabled={disabled}
        onClick={() => {
          refocus.current = true;
          setAsking(false);
        }}
      >
        {cancelLabel}
      </Button>
    </>
  );
}
