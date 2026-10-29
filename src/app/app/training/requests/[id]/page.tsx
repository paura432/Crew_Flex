import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { ButtonLink } from "@/components/ui/Button";
import { controlClass, Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { getMessages, getMyRequests } from "@/features/training/api";
import { TrainingForm } from "@/features/training/components/TrainingForm";
import { RequestSummary } from "@/features/training/components/TrainingViews";
import { formatSessionRange, INBOX_PATH, REQUESTS_PATH } from "@/features/training/view";
import type { Locale } from "@/i18n/config";
import { isTrainingEnabled } from "@/server/feature-flags";
import { requireSessionActor } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("trainingThread") };
}

/**
 * V19-027: the private conversation of one request, for its two parties only (the professional and the provider's
 * admin/manager). Anyone else, platform admins included (ADR-003 N-6), gets a 404 from the server.
 */
export default async function TrainingThreadPage({
  params,
}: PageProps<"/app/training/requests/[id]">) {
  if (!(await isTrainingEnabled())) notFound();
  const [{ id }, actor, t, locale] = await Promise.all([
    params,
    requireSessionActor(),
    getTranslations("training.thread"),
    getLocale() as Promise<Locale>,
  ]);
  const messages = await getMessages(id);
  if (!messages.ok && messages.error.code === "NOT_FOUND") notFound();
  const mine = actor.profile.account_type === "professional" ? await getMyRequests() : null;
  const request = mine?.ok ? mine.data.requests.find((r) => r.id === id) : undefined;

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={request?.courseTitle ?? t("title")}
        actions={
          <ButtonLink href={request ? REQUESTS_PATH : INBOX_PATH} variant="ghost">
            {t("back")}
          </ButtonLink>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        {request && <RequestSummary request={request} side="professional" />}
        <Panel title={t("title")}>
          {!messages.ok ? (
            <ApiErrorState error={messages.error} requestId={messages.requestId} />
          ) : (
            <>
              {messages.data.messages.length === 0 ? (
                <p className="text-sm text-muted">{t("empty")}</p>
              ) : (
                <ol className="mb-4 space-y-3" aria-label={t("title")}>
                  {messages.data.messages.map((m) => (
                    <li
                      key={m.id}
                      className={`rounded-lg p-3 text-sm ${m.mine ? "bg-info-bg" : "bg-canvas"}`}
                    >
                      <p className="text-xs font-semibold text-muted">
                        {m.mine ? t("you") : t(m.senderSide)} ·{" "}
                        {formatSessionRange(locale, m.createdAt, m.createdAt, "UTC").split("–")[0]}{" "}
                        UTC
                      </p>
                      <p className="whitespace-pre-line">{m.body}</p>
                    </li>
                  ))}
                </ol>
              )}
              <TrainingForm
                op="message"
                fixed={{ requestId: id }}
                submitLabel={t("send")}
                successText={t("sent")}
                variant="primary"
              >
                <Field id="message-body" label={t("body")} hint={t("privacy")}>
                  <textarea id="message-body" name="body" rows={3} className={controlClass} />
                </Field>
              </TrainingForm>
            </>
          )}
        </Panel>
      </div>
    </>
  );
}
