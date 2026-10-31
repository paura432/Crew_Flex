import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { controlClass, Field } from "@/components/ui/Field";
import { readInvitation } from "@/features/auth/invitation";
import { RegisterForm } from "@/features/auth/components/RegisterForm";
import { normalizeInvitationCode } from "@/lib/validation/account";
import { isInvitationSignupRequired } from "@/server/feature-flags";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("register") };
}

/** The invitation a `?invite=` code stands for, or null when it is missing, invalid or used. */
async function invitationFor(given: string) {
  const code = normalizeInvitationCode(given);
  if (!code) return null;
  const invitation = await readInvitation(code, null);
  return invitation?.status === "valid" && invitation.accountType
    ? { code, accountType: invitation.accountType }
    : null;
}

/** Sign-up by invitation without a valid code: only the code is asked for (a plain GET form, no script). */
async function InvitationCodeForm({ given }: { given: string }) {
  const t = await getTranslations("auth.register");
  return (
    <div className="flex flex-col gap-4">
      <p
        role={given ? "alert" : "status"}
        className={`rounded-lg border px-4 py-3 text-sm ${
          given ? "border-danger/30 bg-danger-bg text-danger" : "border-line bg-canvas text-ink"
        }`}
      >
        {given ? t("invitationInvalid") : t("invitationOnly")}
      </p>
      <form method="get" action="/register" className="flex flex-col gap-4">
        <Field id="invite" label={t("invitationCode")} hint={t("invitationCodeAsk")}>
          <input
            id="invite"
            name="invite"
            type="text"
            required
            defaultValue={given}
            autoComplete="off"
            spellCheck={false}
            className={`${controlClass} font-mono text-sm`}
            aria-describedby="invite-hint"
          />
        </Field>
        <Button type="submit" variant="primary">
          {t("invitationContinue")}
        </Button>
      </form>
    </div>
  );
}

/**
 * Open sign-up, or — with the owner flag `invitation_signup` (T-40) — sign-up by invitation: the link
 * of the invitation e-mail is `/register?invite=<code>`; without a valid code only the code is asked
 * for (a plain GET form, no script), with one the invitation's own form.
 */
export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const [params, t, invitationOnly] = await Promise.all([
    searchParams,
    getTranslations("auth.register"),
    isInvitationSignupRequired(),
  ]);
  const given = typeof params.invite === "string" ? params.invite : "";
  const invited = invitationOnly ? await invitationFor(given) : null;

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mb-6 text-muted">{t("lead")}</p>
      {!invitationOnly ? (
        <RegisterForm />
      ) : invited ? (
        <RegisterForm invitation={invited} />
      ) : (
        <InvitationCodeForm given={given} />
      )}
      <p className="mt-6 text-sm text-muted">
        {t("already")}{" "}
        <Link href="/login" className="font-semibold text-blue hover:underline">
          {t("signIn")}
        </Link>
      </p>
    </>
  );
}
