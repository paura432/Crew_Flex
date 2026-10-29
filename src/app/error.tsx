"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { StateMessage } from "@/components/ui/StateMessage";
import { signOutAction } from "@/features/auth/actions";

// Errors outside /app's own boundary, such as its layout failing to read the signed-in profile
// (SessionProfileUnavailableError). There is no shell here, so signing out is the way out.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common");
  return (
    <main className="mx-auto max-w-xl px-4 py-24">
      <StateMessage
        tone="danger"
        title={t("errorTitle")}
        description={
          <>
            <p>{error.digest ? t("reference", { id: error.digest }) : t("errorHint")}</p>
            <p className="mt-1">{t("signOutHint")}</p>
          </>
        }
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={reset}>{t("retry")}</Button>
            <form action={signOutAction}>
              <Button type="submit" variant="ghost">
                {t("signOut")}
              </Button>
            </form>
          </div>
        }
      />
    </main>
  );
}
