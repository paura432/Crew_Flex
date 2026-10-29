import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { ButtonLink } from "@/components/ui/Button";
import { controlClass, Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { ACTIVE_TRAINING_REQUEST_STATUSES } from "@/domain/training";
import { getCourse } from "@/features/training/api";
import { TrainingForm } from "@/features/training/components/TrainingForm";
import { EditionSummary, TrainingStatus } from "@/features/training/components/TrainingViews";
import { REQUESTS_PATH, TRAINING_PATH } from "@/features/training/view";
import type { TrainingEdition } from "@/types/api";
import { isTrainingEnabled } from "@/server/feature-flags";
import { requireSessionActor } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("training") };
}

/** V19-007 course file + V19-018 favourite + V19-019/020 inquiry or seat request (the server re-checks everything). */
export default async function TrainingCoursePage({
  params,
}: PageProps<"/app/training/[courseId]">) {
  if (!(await isTrainingEnabled())) notFound();
  const [{ courseId }, actor, t, tRoot] = await Promise.all([
    params,
    requireSessionActor(),
    getTranslations("training.course"),
    getTranslations("training"),
  ]);
  const result = await getCourse(courseId);
  if (!result.ok && result.error.code === "NOT_FOUND") notFound();
  if (!result.ok) return <ApiErrorState error={result.error} requestId={result.requestId} />;
  const c = result.data.course;
  const professional = actor.profile.account_type === "professional";
  const active = (editionId: string | null) =>
    c.myRequests.find(
      (r) => r.editionId === editionId && ACTIVE_TRAINING_REQUEST_STATUSES.includes(r.status),
    );

  const requestForm = (edition: TrainingEdition | null) => {
    const mine = active(edition?.id ?? null);
    if (mine)
      return (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <TrainingStatus status={mine.status} />
          <Link
            href={`${REQUESTS_PATH}/${mine.id}`}
            className="font-semibold text-blue hover:underline pointer-coarse:min-h-11"
          >
            {t("openRequest")}
          </Link>
        </p>
      );
    const kind = !edition || edition.provisional ? "inquiry" : "seat";
    const id = edition?.id ?? "general";
    return (
      <TrainingForm
        op="request"
        fixed={{ courseId: c.id, kind, ...(edition ? { editionId: edition.id } : {}) }}
        numbers={["units"]}
        submitLabel={t(kind === "seat" ? "requestSeat" : "sendInquiry")}
        successText={t("sent")}
        variant={kind === "seat" ? "primary" : "secondary"}
      >
        <Field id={`${id}-name`} label={t("applicantName")} hint={t("applicantHint")}>
          <input
            id={`${id}-name`}
            name="applicantName"
            defaultValue={actor.profile.display_name ?? ""}
            className={controlClass}
          />
        </Field>
        <Field id={`${id}-note`} label={t("note")}>
          <textarea id={`${id}-note`} name="note" rows={2} className={controlClass} />
        </Field>
        {edition && edition.priceUnit !== "person" && edition.priceUnit !== "quote" && (
          <Field
            id={`${id}-units`}
            label={t("units", { unit: tRoot(`priceUnit.${edition.priceUnit}`) })}
          >
            <input
              id={`${id}-units`}
              name="units"
              type="number"
              min={1}
              max={50}
              defaultValue={1}
              className={controlClass}
            />
          </Field>
        )}
      </TrainingForm>
    );
  };

  const facts: [string, ReactNode][] = [
    [t("language"), c.language],
    [t("aircraft"), c.aircraft],
    [t("engine"), c.engine],
    [t("category"), c.category],
    [t("issuer"), c.issuer],
    [t("certificateInfo"), c.certificateInfo],
    [
      t("scope"),
      c.scope === "general"
        ? tRoot("scope.general")
        : `${tRoot(`scope.${c.scope}`)} · ${c.approvalRef}`,
    ],
  ].filter(([, v]) => v) as [string, ReactNode][];

  return (
    <>
      <PageHeader
        eyebrow={tRoot(`family.${c.family}`)}
        title={c.title}
        description={c.providerName}
        actions={
          <>
            <ButtonLink href={TRAINING_PATH} variant="ghost">
              {t("back")}
            </ButtonLink>
            <TrainingForm
              op="favorite"
              fixed={{ courseId: c.id }}
              submitLabel={c.favorite ? t("unsave") : t("save")}
              successText={c.favorite ? t("unsaved") : t("saved")}
              className="inline"
            />
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Panel title={t("about")}>
            <p className="whitespace-pre-line text-sm">{c.description}</p>
            {c.prerequisites && (
              <>
                <h3 className="mt-4 text-sm font-semibold">{t("prerequisites")}</h3>
                <p className="whitespace-pre-line text-sm">{c.prerequisites}</p>
              </>
            )}
            {c.syllabus && (
              <>
                <h3 className="mt-4 text-sm font-semibold">{t("syllabus")}</h3>
                <p className="whitespace-pre-line text-sm">{c.syllabus}</p>
              </>
            )}
          </Panel>
          <Panel title={t("editions")}>
            {c.editions.length === 0 ? (
              <p className="text-sm text-muted">{t("noEditions")}</p>
            ) : (
              <div className="space-y-4">
                {c.editions.map((e) => (
                  <EditionSummary key={e.id} edition={e}>
                    {professional && requestForm(e)}
                  </EditionSummary>
                ))}
              </div>
            )}
          </Panel>
          {professional && <Panel title={t("generalInquiry")}>{requestForm(null)}</Panel>}
        </div>
        <Panel title={t("facts")}>
          <dl className="space-y-3 text-sm">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="font-semibold">{k}</dt>
                <dd className="whitespace-pre-line">{v}</dd>
              </div>
            ))}
          </dl>
          {/* V19-034: the provider issues the document; nothing here creates a verified qualification. */}
          <p className="mt-4 text-sm text-muted">{t("certificateNote")}</p>
          {c.provider && (
            <div className="mt-4 border-t border-line pt-4 text-sm">
              <p className="font-semibold">{c.provider.name}</p>
              <p className="whitespace-pre-line text-muted">{c.provider.description}</p>
              {c.provider.website && (
                <a
                  href={c.provider.website}
                  rel="noopener noreferrer"
                  target="_blank"
                  className="text-blue hover:underline"
                >
                  {c.provider.website}
                </a>
              )}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
