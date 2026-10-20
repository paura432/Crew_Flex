import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { LoginForm } from "@/features/auth/components/LoginForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("signIn") };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const [{ next, reset }, t] = await Promise.all([searchParams, getTranslations("auth.signIn")]);
  return (
    <>
      <h1 className="mb-1 text-2xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mb-6 text-muted">{t("lead")}</p>
      {reset === "1" && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-ok/30 bg-ok-bg px-4 py-3 text-sm text-ok"
        >
          {t("passwordChanged")}
        </p>
      )}
      <LoginForm next={typeof next === "string" ? next : undefined} />
      <p className="mt-4 text-sm">
        <Link href="/forgot-password" className="font-semibold text-blue hover:underline">
          {t("forgot")}
        </Link>
      </p>
      <p className="mt-6 text-sm text-muted">
        {t("noAccount")}{" "}
        <Link href="/register" className="font-semibold text-blue hover:underline">
          {t("createOne")}
        </Link>
      </p>
    </>
  );
}
