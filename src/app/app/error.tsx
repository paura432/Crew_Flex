"use client";

import { Button } from "@/components/ui/Button";
import { StateMessage } from "@/components/ui/StateMessage";

// Unexpected rendering errors. Details are never shown (only the opaque digest).
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <StateMessage
      tone="danger"
      title="This page could not be displayed"
      description={error.digest ? `Reference: ${error.digest}` : "Try again in a moment."}
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
