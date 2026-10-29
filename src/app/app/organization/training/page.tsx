import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { ButtonLink } from "@/components/ui/Button";
import { controlClass, Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StateMessage } from "@/components/ui/StateMessage";
import { getWorkspace } from "@/features/training/api";
import { TrainingForm } from "@/features/training/components/TrainingForm";
import { EditionSummary, TrainingStatus } from "@/features/training/components/TrainingViews";
import { requireTrainingProvider } from "@/features/training/provider";
import { INBOX_PATH, PROVIDER_PATH } from "@/features/training/view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("trainingProvider") };
}

const EDITABLE = ["draft", "changes", "rejected"];

/** V19-008/010/011/012/015: provider profile, courses and editions of the acting organization (admin/manager). */
export default async function TrainingProviderPage() {
  const { organization } = await requireTrainingProvider();
  const [t, result] = await Promise.all([
    getTranslations("training.provider"),
    getWorkspace(organization.id),
  ]);
  if (!result.ok) return <ApiErrorState error={result.error} requestId={result.requestId} />;
  const { provider, courses } = result.data;

  return (
    <>
      <PageHeader
        eyebrow={organization.name}
        title={t("title")}
        description={t("description")}
        actions={
          <>
            <ButtonLink href={INBOX_PATH}>{t("inboxLink")}</ButtonLink>
            {provider && (
              <ButtonLink href={`${PROVIDER_PATH}/courses/new`} variant="primary">
                {t("courses.new")}
              </ButtonLink>
            )}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Panel title={t("profile.title")}>
          {provider && (
            <div className="mb-3 space-y-1 text-sm">
              <TrainingStatus status={provider.status} />
              {provider.reviewNote && (
                <p>{t("profile.reviewNote", { note: provider.reviewNote })}</p>
              )}
            </div>
          )}
          <TrainingForm
            op="provider"
            fixed={{
              organizationId: organization.id,
              ...(provider ? { expectedUpdatedAt: provider.updatedAt } : {}),
            }}
            submitLabel={provider ? t("profile.save") : t("profile.create")}
            successText={t("profile.saved")}
            variant="primary"
          >
            <Field id="pv-name" label={t("profile.name")}>
              <input
                id="pv-name"
                name="name"
                defaultValue={provider?.name ?? organization.name}
                className={controlClass}
              />
            </Field>
            <Field id="pv-desc" label={t("profile.description")}>
              <textarea
                id="pv-desc"
                name="description"
                rows={4}
                defaultValue={provider?.description ?? ""}
                className={controlClass}
              />
            </Field>
            <Field id="pv-web" label={t("profile.website")} hint={t("profile.websiteHint")}>
              <input
                id="pv-web"
                name="website"
                type="url"
                defaultValue={provider?.website ?? ""}
                className={controlClass}
              />
            </Field>
            <p className="text-sm text-muted">{t("profile.reviewHint")}</p>
          </TrainingForm>
        </Panel>

        <section className="space-y-4" aria-label={t("courses.title")}>
          {courses.length === 0 ? (
            <StateMessage
              title={t("courses.emptyTitle")}
              description={t("courses.emptyDescription")}
            />
          ) : (
            courses.map((c) => (
              <Panel
                key={c.id}
                title={c.title}
                actions={
                  <ButtonLink href={`${PROVIDER_PATH}/courses/${c.id}`} size="sm">
                    {t("courses.edit")}
                  </ButtonLink>
                }
              >
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                  <TrainingStatus status={c.status} />
                  {c.reviewNote && <span>{t("profile.reviewNote", { note: c.reviewNote })}</span>}
                </div>
                {EDITABLE.includes(c.status) && (
                  <TrainingForm
                    op="listing"
                    fixed={{
                      kind: "course",
                      id: c.id,
                      action: "submit",
                      expectedUpdatedAt: c.updatedAt,
                    }}
                    submitLabel={t("courses.submit")}
                    successText={t("courses.submitted")}
                    className="mb-3"
                  />
                )}
                <div className="space-y-3">
                  {c.editions.map((e) => (
                    <EditionSummary key={e.id} edition={e}>
                      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                        <TrainingStatus status={e.status} />
                        {e.reviewNote && (
                          <span>{t("profile.reviewNote", { note: e.reviewNote })}</span>
                        )}
                        {e.status !== "cancelled" && (
                          <ButtonLink
                            href={`${PROVIDER_PATH}/editions/${e.id}?courseId=${c.id}`}
                            size="sm"
                          >
                            {t("courses.edit")}
                          </ButtonLink>
                        )}
                        {EDITABLE.includes(e.status) && (
                          <TrainingForm
                            op="listing"
                            fixed={{
                              kind: "edition",
                              id: e.id,
                              action: "submit",
                              expectedUpdatedAt: e.updatedAt,
                            }}
                            submitLabel={t("courses.submit")}
                            successText={t("courses.submitted")}
                            className="inline"
                          />
                        )}
                      </div>
                      {e.status !== "cancelled" && e.status !== "draft" && (
                        <TrainingForm
                          op="listing"
                          fixed={{
                            kind: "edition",
                            id: e.id,
                            action: "cancel",
                            expectedUpdatedAt: e.updatedAt,
                          }}
                          submitLabel={t("courses.cancelEdition")}
                          successText={t("courses.cancelled")}
                          variant="danger"
                        >
                          <Field id={`cancel-${e.id}`} label={t("courses.cancelReason")}>
                            <textarea
                              id={`cancel-${e.id}`}
                              name="reason"
                              rows={2}
                              className={controlClass}
                            />
                          </Field>
                        </TrainingForm>
                      )}
                    </EditionSummary>
                  ))}
                  <ButtonLink href={`${PROVIDER_PATH}/editions/new?courseId=${c.id}`} size="sm">
                    {t("courses.newEdition")}
                  </ButtonLink>
                </div>
              </Panel>
            ))
          )}
        </section>
      </div>
    </>
  );
}
