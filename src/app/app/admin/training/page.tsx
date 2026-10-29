import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { controlClass, Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pager } from "@/components/ui/Pager";
import { StateMessage } from "@/components/ui/StateMessage";
import { StatusChip } from "@/components/ui/StatusChip";
import { TRAINING_LISTING_DECISIONS, TRAINING_PROVIDER_DECISIONS } from "@/domain/training";
import { getReviewQueue } from "@/features/training/api";
import { TrainingForm } from "@/features/training/components/TrainingForm";
import { ADMIN_TRAINING_PATH } from "@/features/training/view";
import { isTrainingEnabled } from "@/server/feature-flags";
import { requireSessionActor } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("trainingAdmin") };
}

const PAGE = 20;

/**
 * V19-009/011/015: platform admins review providers, courses and editions (N-1: who may verify stays with the owner;
 * the flag keeps it off in production). The API never lists items of an organization the admin belongs to (S-16).
 */
export default async function TrainingReviewPage({
  searchParams,
}: PageProps<"/app/admin/training">) {
  if (!(await isTrainingEnabled())) notFound();
  const [actor, search, t] = await Promise.all([
    requireSessionActor(),
    searchParams,
    getTranslations("training.admin"),
  ]);
  if (actor.profile.platform_role !== "platform_admin") notFound();
  const page = Math.max(1, Number.parseInt(String(search.page ?? "1"), 10) || 1);
  const result = await getReviewQueue({ offset: (page - 1) * PAGE, limit: PAGE });
  const pages = result.ok ? Math.max(1, Math.ceil(result.data.total / PAGE)) : 1;
  const href = (p: number) => (p > 1 ? `${ADMIN_TRAINING_PATH}?page=${p}` : ADMIN_TRAINING_PATH);

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <p className="mb-4 text-sm text-muted">{t("notEasa")}</p>
      {!result.ok ? (
        <ApiErrorState error={result.error} requestId={result.requestId} />
      ) : result.data.items.length === 0 ? (
        <StateMessage title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <>
          <ul className="space-y-4">
            {result.data.items.map((it) => {
              const fields = Object.entries(it.item).filter(
                ([k, v]) =>
                  !/id$/i.test(k) &&
                  (typeof v === "string" || typeof v === "number" || typeof v === "boolean"),
              );
              const title = String(
                it.item.title ?? it.item.name ?? it.item.courseTitle ?? it.organizationName,
              );
              const decisions =
                it.kind === "provider" ? TRAINING_PROVIDER_DECISIONS : TRAINING_LISTING_DECISIONS;
              return (
                <li
                  key={`${it.kind}-${it.id}`}
                  className="space-y-3 rounded-lg border border-line bg-white p-4 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip tone="info">{t(`kind.${it.kind}`)}</StatusChip>
                    <span className="text-muted">{it.organizationName}</span>
                  </div>
                  <h2 className="text-base font-semibold">{title}</h2>
                  <details>
                    <summary className="cursor-pointer font-semibold pointer-coarse:min-h-11">
                      {t("details")}
                    </summary>
                    <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                      {fields.map(([k, v]) => (
                        <div key={k}>
                          <dt className="font-semibold">{k}</dt>
                          <dd className="whitespace-pre-line break-words">{String(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                  <TrainingForm
                    op="review"
                    fixed={{ kind: it.kind, id: it.id, expectedUpdatedAt: it.updatedAt }}
                    submitLabel={t("decide")}
                    successText={t("decided")}
                    variant="primary"
                  >
                    <Field id={`d-${it.id}`} label={t("decision")}>
                      <select id={`d-${it.id}`} name="decision" className={controlClass}>
                        {decisions.map((d) => (
                          <option key={d} value={d}>
                            {t(`decisions.${d}`)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field id={`n-${it.id}`} label={t("note")} hint={t("noteHint")}>
                      <textarea id={`n-${it.id}`} name="note" rows={2} className={controlClass} />
                    </Field>
                  </TrainingForm>
                </li>
              );
            })}
          </ul>
          <Pager
            label={t("pagerLabel")}
            info={t("pageInfo", { page, pages })}
            previous={page > 1 ? { href: href(page - 1), label: t("previous") } : null}
            next={page < pages ? { href: href(page + 1), label: t("next") } : null}
          />
        </>
      )}
    </>
  );
}
