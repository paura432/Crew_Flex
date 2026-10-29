import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ForgotPasswordForm } from "@/features/auth/components/PasswordRecoveryForms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("recovery") };
}

export default async function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  const [{ expired }, t] = await Promise.all([searchParams, getTranslations("auth.recovery")]);
  return (
    <>
      <h1 className="mb-1 text-2xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mb-6 text-muted">{t("lead")}</p>
      {expired && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-warn/40 bg-warn-bg px-3 py-2 text-sm text-warn"
        >
          {t("expired")}
        </p>
      )}
      <ForgotPasswordForm />
      <p className="mt-6 text-sm text-muted">
        <Link
          href="/login"
          className="inline-flex items-center font-semibold text-blue hover:underline pointer-coarse:min-h-11"
        >
          {t("backToSignIn")}
        </Link>
      </p>
    </>
  );
}
