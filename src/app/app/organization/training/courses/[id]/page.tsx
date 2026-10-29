import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { ButtonLink } from "@/components/ui/Button";
import { controlClass, Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { TRAINING_FAMILIES, TRAINING_SCOPES } from "@/domain/training";
import { getWorkspace } from "@/features/training/api";
import { TrainingForm } from "@/features/training/components/TrainingForm";
import { requireTrainingProvider } from "@/features/training/provider";
import { PROVIDER_PATH } from "@/features/training/view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("trainingProvider") };
}

/** V19-010: create («new») or edit a course; scope Part-147 / direct approval needs the provider's reference (N-7). */
export default async function TrainingCourseEditPage({
  params,
}: PageProps<"/app/organization/training/courses/[id]">) {
  const { organization } = await requireTrainingProvider();
  const [{ id }, t, tRoot] = await Promise.all([
    params,
    getTranslations("training.provider.course"),
    getTranslations("training"),
  ]);
  const result = await getWorkspace(organization.id);
  if (!result.ok) return <ApiErrorState error={result.error} requestId={result.requestId} />;
  const course = id === "new" ? undefined : result.data.courses.find((c) => c.id === id);
  if (id !== "new" && !course) notFound();
  const text = (name: string, value: string | null | undefined, rows = 0) => (
    <Field id={`c-${name}`} label={t(name as never)}>
      {rows ? (
        <textarea
          id={`c-${name}`}
          name={name}
          rows={rows}
          defaultValue={value ?? ""}
          className={controlClass}
        />
      ) : (
        <input id={`c-${name}`} name={name} defaultValue={value ?? ""} className={controlClass} />
      )}
    </Field>
  );

  return (
    <>
      <PageHeader
        eyebrow={organization.name}
        title={course ? t("titleEdit") : t("titleNew")}
        actions={
          <ButtonLink href={PROVIDER_PATH} variant="ghost">
            {t("back")}
          </ButtonLink>
        }
      />
      <Panel>
        <TrainingForm
          op="course"
          fixed={{
            organizationId: organization.id,
            ...(course ? { id: course.id, expectedUpdatedAt: course.updatedAt } : {}),
          }}
          submitLabel={t("save")}
          successText={t("saved")}
          variant="primary"
          redirectTo={PROVIDER_PATH}
          className="grid gap-4 sm:grid-cols-2 [&>button]:justify-self-start"
        >
          {text("title", course?.title)}
          <Field id="c-family" label={t("family")}>
            <select
              id="c-family"
              name="family"
              defaultValue={course?.family ?? "type"}
              className={controlClass}
            >
              {TRAINING_FAMILIES.map((f) => (
                <option key={f} value={f}>
                  {tRoot(`family.${f}`)}
                </option>
              ))}
            </select>
          </Field>
          {text("language", course?.language)}
          {text("aircraft", course?.aircraft)}
          {text("engine", course?.engine)}
          {text("category", course?.category)}
          <div className="sm:col-span-2">{text("description", course?.description, 4)}</div>
          <div className="sm:col-span-2">{text("prerequisites", course?.prerequisites, 3)}</div>
          <div className="sm:col-span-2">{text("syllabus", course?.syllabus, 5)}</div>
          {text("issuer", course?.issuer)}
          {text("certificateInfo", course?.certificateInfo, 2)}
          <Field id="c-scope" label={t("scope")} hint={t("scopeHint")}>
            <select
              id="c-scope"
              name="scope"
              defaultValue={course?.scope ?? "general"}
              className={controlClass}
            >
              {TRAINING_SCOPES.map((s) => (
                <option key={s} value={s}>
                  {tRoot(`scope.${s}`)}
                </option>
              ))}
            </select>
          </Field>
          {text("approvalRef", course?.approvalRef)}
        </TrainingForm>
      </Panel>
    </>
  );
}
