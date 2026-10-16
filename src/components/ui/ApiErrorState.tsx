import { getTranslations } from "next-intl/server";
import type { ApiErrorBody } from "@/types/api";
import { ButtonLink } from "./Button";
import { StateMessage } from "./StateMessage";

/** Distinguishes auth, permission, validation, network, not-found and server errors (Server Component). */
export async function ApiErrorState({
  error,
  requestId,
}: {
  error: ApiErrorBody;
  requestId?: string;
}) {
  const t = await getTranslations();
  return (
    <StateMessage
      tone="danger"
      title={t(`api.${error.code}.title`)}
      description={
        <>
          {t(`api.${error.code}.description`)}
          {requestId && (
            <span className="mt-2 block font-mono text-xs">
              {t("common.reference", { id: requestId })}
            </span>
          )}
        </>
      }
      action={
        error.code === "UNAUTHORIZED" ? (
          <ButtonLink href="/login" variant="primary">
            {t("api.signInAgain")}
          </ButtonLink>
        ) : undefined
      }
    />
  );
}
