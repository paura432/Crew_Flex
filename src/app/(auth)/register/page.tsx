import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { RegisterForm } from "@/features/auth/components/RegisterForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("register") };
}

export default async function RegisterPage() {
  const t = await getTranslations("auth.register");
  return (
    <>
      <h1 className="mb-1 text-2xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mb-6 text-muted">{t("lead")}</p>
      <RegisterForm />
      <p className="mt-6 text-sm text-muted">
        {t("already")}{" "}
        <Link href="/login" className="font-semibold text-blue hover:underline">
          {t("signIn")}
        </Link>
      </p>
    </>
  );
}
