import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { loginNotice } from "@/features/auth/state";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("signIn") };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const [params, t] = await Promise.all([searchParams, getTranslations("auth.signIn")]);
  const { next } = params;
  const notice = loginNotice(params);
  return (
    <>
      <h1 className="mb-1 text-2xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mb-6 text-muted">{t("lead")}</p>
      {notice && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-ok/30 bg-ok-bg px-4 py-3 text-sm text-ok"
        >
          {t(notice)}
        </p>
      )}
      <LoginForm next={typeof next === "string" ? next : undefined} />
      <p className="mt-4 text-sm">
        <Link
          href="/forgot-password"
          className="inline-flex items-center font-semibold text-blue hover:underline pointer-coarse:min-h-11"
        >
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
