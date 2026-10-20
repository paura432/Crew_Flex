import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ResetPasswordForm } from "@/features/auth/components/PasswordRecoveryForms";
import { hasRecentRecoverySession } from "@/features/auth/recovery";
import { createServerSupabase } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("recovery") };
}

/** Reached from the recovery e-mail through `/auth/confirm`, which opened the recovery session. */
export default async function ResetPasswordPage() {
  const [t, supabase] = await Promise.all([
    getTranslations("auth.recovery"),
    createServerSupabase(),
  ]);
  // Only a session opened by the recovery link (≤ 1 h) may set a password without the current one.
  const canReset = await hasRecentRecoverySession(supabase);
  return (
    <>
      <h1 className="mb-1 text-2xl font-bold tracking-tight">{t("resetTitle")}</h1>
      {canReset ? (
        <>
          <p className="mb-6 text-muted">{t("resetLead")}</p>
          <ResetPasswordForm />
        </>
      ) : (
        <p role="alert" className="mt-4 text-sm text-muted">
          {t("noSession")}{" "}
          <Link href="/forgot-password" className="font-semibold text-blue hover:underline">
            {t("requestAgain")}
          </Link>
        </p>
      )}
    </>
  );
}
