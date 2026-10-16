"use client";

import { useTranslations } from "next-intl";
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
  const t = useTranslations("common");
  return (
    <StateMessage
      tone="danger"
      title={t("errorTitle")}
      description={error.digest ? t("reference", { id: error.digest }) : t("errorHint")}
      action={<Button onClick={reset}>{t("retry")}</Button>}
    />
  );
}
