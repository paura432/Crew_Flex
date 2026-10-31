import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button-class";
import { controlClass } from "@/components/ui/Field";
import { Pager } from "@/components/ui/Pager";
import { DIRECTORY_PAGE_SIZE } from "@/domain/directory";
import { AIRCRAFT, categoryKey, ENGLISH_LEVELS, PROFESSIONAL_CATEGORIES } from "@/domain/passport";
import type { WorkRequirement } from "@/domain/work-requirement";
import { euCountryOptions } from "@/features/organizations/countries";
import type { Locale } from "@/i18n/config";
import {
  DIRECTORY_PATH,
  directoryHref,
  hasDirectoryFilters,
  type DirectoryQuery,
  type DirectoryQueryErrors,
} from "../query";

/**
 * v1.8 «Buscar candidato» + `<details>` «Más filtros» (MKT-01 #10–#17) as a native GET form (works without
 * JavaScript, like the matches page). Seven filters: base (the search field), category, aircraft, minimum
 * English, minimum years, work permit, availability window; v1.8's errors under the form (`role=status`).
 */
export async function DirectoryFilters({
  query,
  errors,
}: {
  query: DirectoryQuery;
  errors: DirectoryQueryErrors;
}) {
  const t = await getTranslations("directory.filters");
  const hasError = errors.window || errors.minYears;
  return (
    <form
      method="get"
      action={DIRECTORY_PATH}
      role="search"
      aria-label={t("legend")}
      className="mb-4 rounded-xl border border-line bg-white p-4"
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
        <label className={field}>
          {t("base")}
          <input
            name="base"
            type="search"
            defaultValue={query.base}
            placeholder={t("basePlaceholder")}
            maxLength={80}
            className={control}
          />
        </label>
        <button type="submit" className={buttonClass("primary")}>
          {t("apply")}
        </button>
        <Link href={directoryHref({ ...query, ...CLEARED })} className={buttonClass()}>
          {t("clear")}
        </Link>
      </div>
      <details className="mt-3" open={hasDirectoryFilters(query) || hasError}>
        <summary className="cursor-pointer text-sm font-semibold text-blue pointer-coarse:min-h-11 pointer-coarse:leading-11">
          {t("more")}
        </summary>
        <MoreFilters query={query} errors={errors} />
        <p className="mt-3 text-sm text-muted">{t("help")}</p>
      </details>
      {hasError && <FilterErrors errors={errors} />}
    </form>
  );
}

const field = "text-sm font-semibold";
const control = `${controlClass} mt-1 font-normal`;

/** The ARIA of a control whose value failed: invalid and described by its error line. */
const invalid = (failed: boolean, errorId: string) =>
  failed ? { "aria-invalid": true, "aria-describedby": errorId } : {};

/** «Más filtros»: category, aircraft, English, years, work permit and the availability window. */
async function MoreFilters({
  query,
  errors,
}: {
  query: DirectoryQuery;
  errors: DirectoryQueryErrors;
}) {
  const [t, tCategory, locale] = await Promise.all([
    getTranslations("directory.filters"),
    getTranslations("passport.categories"),
    getLocale() as Promise<Locale>,
  ]);
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className={field}>
        {t("category")}
        <select name="category" defaultValue={query.category ?? ""} className={control}>
          <option value="">{t("all")}</option>
          {PROFESSIONAL_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {tCategory(categoryKey(c))}
            </option>
          ))}
        </select>
      </label>
      <label className={field}>
        {t("aircraft")}
        <select name="aircraft" defaultValue={query.aircraft ?? ""} className={control}>
          <option value="">{t("all")}</option>
          {AIRCRAFT.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
      <label className={field}>
        {t("english")}
        <select name="englishLevel" defaultValue={query.englishLevel ?? ""} className={control}>
          <option value="">{t("any")}</option>
          {ENGLISH_LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className={field}>
        {t("minYears")}
        <input
          name="minYears"
          type="text"
          inputMode="numeric"
          defaultValue={query.minYears ?? ""}
          {...invalid(errors.minYears, "directory-years-error")}
          className={control}
        />
      </label>
      <label className={field}>
        {t("country")}
        <select name="country" defaultValue={query.country ?? ""} className={control}>
          <option value="">{t("anyCountry")}</option>
          {euCountryOptions(locale).map(({ code, name }) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className={field}>
        {t("from")}
        <input
          name="from"
          type="date"
          defaultValue={query.from}
          {...invalid(errors.window, "directory-window-error")}
          className={control}
        />
      </label>
      <label className={field}>
        {t("to")}
        <input
          name="to"
          type="date"
          defaultValue={query.to}
          {...invalid(errors.window, "directory-window-error")}
          className={control}
        />
      </label>
    </div>
  );
}

/** v1.8's errors under the form (`role=status`). */
async function FilterErrors({ errors }: { errors: DirectoryQueryErrors }) {
  const tV = await getTranslations("v.directory");
  return (
    <div role="status" className="mt-3 space-y-1 text-sm font-medium text-danger">
      {errors.window && <p id="directory-window-error">{tV("window")}</p>}
      {errors.minYears && <p id="directory-years-error">{tV("minYears")}</p>}
    </div>
  );
}

/** v1.8 «Limpiar filtros»: every filter and the page. */
const CLEARED: Partial<DirectoryQuery> = {
  category: null,
  aircraft: null,
  englishLevel: null,
  minYears: null,
  country: null,
  base: "",
  from: "",
  to: "",
  page: 1,
};

/**
 * v1.8 «Evaluar para la oferta» (MKT-01 #6): choosing a published need opens its «Profesionales elegibles»
 * (the one place eligibility is computed — the directory never evaluates anyone, T-155).
 */
export async function EvaluateForm({ requirements }: { requirements: WorkRequirement[] }) {
  if (requirements.length === 0) return null;
  const t = await getTranslations("directory.evaluate");
  return (
    <form
      method="get"
      action={DIRECTORY_PATH}
      className="mb-4 flex flex-wrap items-end gap-2"
      aria-describedby="directory-evaluate-hint"
    >
      <label className="min-w-0 flex-1 basis-64 text-sm font-semibold">
        {t("label")}
        <select name="requirement" defaultValue="" className={`${controlClass} mt-1 font-normal`}>
          <option value="">{t("placeholder")}</option>
          {requirements.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className={buttonClass()}>
        {t("submit")}
      </button>
      <p id="directory-evaluate-hint" className="basis-full text-xs text-muted">
        {t("hint")}
      </p>
    </form>
  );
}

/** «Anterior» · «{p} / {P} · 20 perfiles por página» · «Siguiente» (MKT-01 #24). */
export async function DirectoryPager({
  query,
  page,
  pages,
}: {
  query: DirectoryQuery;
  page: number;
  pages: number;
}) {
  const t = await getTranslations("directory.pager");
  return (
    <Pager
      label={t("label")}
      info={t("info", { page, pages, size: DIRECTORY_PAGE_SIZE })}
      previous={
        page > 1 ? { href: directoryHref(query, { page: page - 1 }), label: t("previous") } : null
      }
      next={
        page < pages ? { href: directoryHref(query, { page: page + 1 }), label: t("next") } : null
      }
    />
  );
}
