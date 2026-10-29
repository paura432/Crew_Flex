import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { getWorkspace } from "@/features/training/api";
import { EditionForm } from "@/features/training/components/EditionForm";
import { requireTrainingProvider } from "@/features/training/provider";
import { PROVIDER_PATH } from "@/features/training/view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("trainingProvider") };
}

/** V19-012…017: create («new», `?courseId=`) or edit an edition of one of the organization's courses. */
export default async function TrainingEditionEditPage({
  params,
  searchParams,
}: PageProps<"/app/organization/training/editions/[id]">) {
  const { organization } = await requireTrainingProvider();
  const [{ id }, search, t] = await Promise.all([
    params,
    searchParams,
    getTranslations("training.provider.edition"),
  ]);
  const result = await getWorkspace(organization.id);
  if (!result.ok) return <ApiErrorState error={result.error} requestId={result.requestId} />;
  const courseId = typeof search.courseId === "string" ? search.courseId : "";
  const course = result.data.courses.find((c) => c.id === courseId);
  const edition = id === "new" ? undefined : course?.editions.find((e) => e.id === id);
  if (!course || (id !== "new" && !edition)) notFound();

  return (
    <>
      <PageHeader
        eyebrow={course.title}
        title={edition ? t("titleEdit") : t("titleNew")}
        actions={
          <ButtonLink href={PROVIDER_PATH} variant="ghost">
            {t("back")}
          </ButtonLink>
        }
      />
      <Panel>
        <EditionForm courseId={course.id} edition={edition} />
      </Panel>
    </>
  );
}
