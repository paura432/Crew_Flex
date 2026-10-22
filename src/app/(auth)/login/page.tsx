import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { loginNotice } from "@/features/auth/state";
import { isInvitationSignupRequired } from "@/server/feature-flags";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("signIn") };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const [params, t, invitationOnly] = await Promise.all([
    searchParams,
    getTranslations("auth.signIn"),
    isInvitationSignupRequired(),
  ]);
  const { next } = params;
  const notice = loginNotice(params);
  return (
    <>
      <h1 className="mb-1 text-2xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mb-6 text-muted">{t("lead")}</p>
      {notice && (
        <p
          role={notice === "confirmLinkInvalid" ? "alert" : "status"}
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            notice === "confirmLinkInvalid"
              ? "border-danger/30 bg-danger-bg text-danger"
              : "border-ok/30 bg-ok-bg text-ok"
          }`}
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
        {/* AUTH-01 #10: with sign-up by invitation (T-40) the way in is v1.8's «Tengo una invitación». */}
        {invitationOnly ? null : `${t("noAccount")} `}
        <Link href="/register" className="font-semibold text-blue hover:underline">
          {invitationOnly ? t("haveInvitation") : t("createOne")}
        </Link>
      </p>
    </>
  );
}
