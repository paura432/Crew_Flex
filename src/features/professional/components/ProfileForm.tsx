"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { controlClass, describedBy, Field } from "@/components/ui/Field";
import { actionErrorCopy, callAction, Notice, type NoticeState } from "@/components/ui/Notice";
import { Panel } from "@/components/ui/Panel";
import { useRovingRadio } from "@/components/ui/radio-group";
import {
  AIRCRAFT,
  categoryKey,
  ENGINES,
  ENGLISH_LEVELS,
  EU_COUNTRIES,
  GENERAL_RESTRICTIONS_MAX,
  inCatalogOrder,
  LICENCE_CATEGORIES,
  PHONE_MAX,
  PROFESSIONAL_CATEGORIES,
  RATE_UNITS,
  RATING_RESTRICTIONS_MAX,
  SKILLS,
  TYPE_RATINGS_MAX,
  type Aircraft,
  type EuCountry,
  type LicenceCategory,
  type ProfessionalCategory,
} from "@/domain/passport";
import {
  MOBILITIES,
  PROFILE_VISIBILITIES,
  TECHNICIAN_STATUSES,
  type ProfileVisibility,
} from "@/domain/professional";
import { resolveFieldErrors } from "@/i18n/validation";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/errors";
import { updateProfessionalProfileInput } from "@/lib/validation/professional";
import type { OrganizationOption, ProfessionalPassport } from "@/types/api";
import { updateProfileAction } from "../actions";
import { emptyPassport, passportFromForm, withPrimary, type RatingDraft } from "../passport-form";
import { usePassportDraft } from "./PassportDraft";

const checkboxLabel =
  "flex min-h-10 items-center gap-2 text-sm pointer-coarse:min-h-11 has-disabled:opacity-70";

/** A group of checkboxes with a legend, hint and error (one Tab stop per box, native semantics). */
function CheckboxGroup({
  id,
  legend,
  hint,
  error,
  children,
}: {
  id: string;
  legend: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <fieldset id={id} aria-describedby={describedBy(id, error, hint)} className="min-w-0">
      <legend className="text-sm font-semibold">{legend}</legend>
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      <div className="mt-1 grid grid-cols-2 gap-x-4 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}

interface ProfileFormProps {
  profile: ProfessionalPassport & { updatedAt: string };
  organizations: OrganizationOption[];
  /** EU country names in the active locale, computed on the server (no hydration drift). */
  countryNames: Record<EuCountry, string>;
}

/**
 * "Mi pasaporte": the v1.8 passport in one form and one save (full replacement, I-3), in the order of
 * the v1.8 steps — identity, qualifications, experience and courses, rate and work permits, visibility
 * and blocks. Phone, employer, rate and blocks are private (owner only); the rest is matchable data.
 * «Empezar perfil vacío» (header, T-162) remounts the fields on an empty draft of the SAME version:
 * nothing is saved until «Guardar pasaporte».
 */
export function ProfileForm(props: ProfileFormProps) {
  const t = useTranslations("professional.passport");
  const { generation } = usePassportDraft();
  return (
    <PassportFields
      key={generation}
      {...props}
      profile={generation === 0 ? props.profile : emptyPassport(props.profile)}
      initialNotice={generation === 0 ? null : { tone: "ok", text: t("emptyDraft.prepared") }}
    />
  );
}

function PassportFields({
  profile,
  organizations,
  countryNames,
  initialNotice,
}: ProfileFormProps & { initialNotice: NoticeState | null }) {
  const t = useTranslations("professional.passport");
  const tCategory = useTranslations("passport.categories");
  const tSkill = useTranslations("passport.skills");
  const tUnit = useTranslations("passport.rateUnit");
  const tDomain = useTranslations("domain");
  const tRoot = useTranslations();
  const ratingIds = useId();
  const nextRatingKey = useRef(0);
  const [visibility, setVisibility] = useState<ProfileVisibility>(profile.visibility);
  const visibilityRadio = useRovingRadio(
    PROFILE_VISIBILITIES.length,
    PROFILE_VISIBILITIES.indexOf(visibility),
    (i) => setVisibility(PROFILE_VISIBILITIES[i]!),
  );
  const [primaryCategory, setPrimaryCategory] = useState(profile.primaryCategory);
  const [categories, setCategories] = useState<ProfessionalCategory[]>(profile.categories);
  const [aircraft, setAircraft] = useState<Aircraft[]>(profile.aircraft);
  const [ratings, setRatings] = useState<RatingDraft[]>(() =>
    profile.typeRatings.map((r, i) => ({
      key: `saved-${i}`,
      aircraft: r.aircraft,
      category: r.category,
      expiresAt: r.expiresAt ?? "",
      restrictions: r.restrictions ?? "",
    })),
  );
  const [rawErrors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<NoticeState | null>(initialNotice);
  const [pending, startTransition] = useTransition();
  const errors = resolveFieldErrors(tRoot, rawErrors);
  const licenceCategories = LICENCE_CATEGORIES.filter((c) => categories.includes(c));

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = passportFromForm(
      new FormData(event.currentTarget),
      { visibility, primaryCategory, categories, aircraft, ratings },
      profile.updatedAt,
    );
    const parsed = updateProfessionalProfileInput.safeParse(payload);
    setNotice(null);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await callAction(() => updateProfileAction(parsed.data));
      if (result.ok) {
        setNotice({ tone: "ok", text: t("saved") });
      } else {
        setErrors(result.fieldErrors ?? {});
        // Optimistic concurrency (I-3): nothing was saved; the form keeps the user's input.
        setNotice(
          result.code === "CONFLICT"
            ? { tone: "danger", text: t("conflict"), requestId: result.requestId }
            : actionErrorCopy(tRoot, result),
        );
      }
    });
  }

  const input = (id: string, hint?: string) => ({
    id,
    name: id,
    className: controlClass,
    "aria-invalid": Boolean(errors[id]),
    "aria-describedby": describedBy(id, errors[id], hint),
    disabled: pending,
  });

  const toggle = <T extends string>(list: T[], value: T, on: boolean, catalog: readonly T[]) =>
    inCatalogOrder(catalog, on ? [...list, value] : list.filter((v) => v !== value));

  function choosePrimary(value: string) {
    const primary = value as ProfessionalCategory;
    setPrimaryCategory(primary);
    setCategories((current) =>
      inCatalogOrder(PROFESSIONAL_CATEGORIES, withPrimary(current, primary)),
    );
  }

  function updateRating(key: string, patch: Partial<RatingDraft>) {
    setRatings((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRating() {
    nextRatingKey.current += 1;
    const row: RatingDraft = {
      key: `new-${nextRatingKey.current}`,
      aircraft: aircraft[0]!,
      category: licenceCategories[0]!,
      expiresAt: "",
      restrictions: "",
    };
    setRatings((rows) => [...rows, row]);
  }

  const canAddRating =
    aircraft.length > 0 && licenceCategories.length > 0 && ratings.length < TYPE_RATINGS_MAX;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Notice
        notice={notice}
        referenceLabel={tRoot("common.reference", { id: notice?.requestId ?? "" })}
      />

      <Panel title={t("identity")}>
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="displayName" label={t("name")} error={errors.displayName}>
            <input {...input("displayName")} defaultValue={profile.displayName} maxLength={120} />
          </Field>
          <Field id="phone" label={t("phone")} hint={t("phoneHint")} error={errors.phone}>
            <input
              {...input("phone", t("phoneHint"))}
              type="tel"
              autoComplete="tel"
              defaultValue={profile.phone ?? ""}
              maxLength={PHONE_MAX}
            />
          </Field>
          <Field
            id="baseLocation"
            label={t("base")}
            hint={t("baseHint")}
            error={errors.baseLocation}
          >
            <input
              {...input("baseLocation", t("baseHint"))}
              defaultValue={profile.baseLocation ?? ""}
              maxLength={80}
              placeholder={t("basePlaceholder")}
            />
          </Field>
          <Field id="baseCountry" label={t("baseCountry")} error={errors.baseCountry}>
            <select {...input("baseCountry")} defaultValue={profile.baseCountry ?? ""}>
              <option value="">{t("notSet")}</option>
              {EU_COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {countryNames[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            id="currentEmployerId"
            label={t("employer")}
            hint={t("employerHint")}
            error={errors.currentEmployerId}
          >
            <select
              {...input("currentEmployerId", t("employerHint"))}
              defaultValue={profile.currentEmployerId ?? ""}
            >
              <option value="">{t("employerNone")}</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Panel>

      <Panel title={t("qualificationsTitle")}>
        <div className="space-y-6">
          <div className="max-w-sm">
            <Field id="primaryCategory" label={t("primaryCategory")} error={errors.primaryCategory}>
              {/* The empty option is only a placeholder: it can never be chosen (v1.8 fix). */}
              <select
                {...input("primaryCategory")}
                value={primaryCategory ?? ""}
                onChange={(e) => choosePrimary(e.target.value)}
              >
                <option value="" disabled>
                  {t("primaryPlaceholder")}
                </option>
                {PROFESSIONAL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {tCategory(categoryKey(c))}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <CheckboxGroup
            id="categories"
            legend={t("categories")}
            hint={t("categoriesHint")}
            error={errors.categories}
          >
            {PROFESSIONAL_CATEGORIES.map((c) => (
              <label key={c} className={checkboxLabel}>
                <input
                  type="checkbox"
                  className="size-4"
                  checked={categories.includes(c)}
                  disabled={pending || c === primaryCategory}
                  onChange={(e) =>
                    setCategories((list) =>
                      toggle(list, c, e.target.checked, PROFESSIONAL_CATEGORIES),
                    )
                  }
                />
                {tCategory(categoryKey(c))}
              </label>
            ))}
          </CheckboxGroup>
          <CheckboxGroup id="aircraft" legend={t("aircraft")} error={errors.aircraft}>
            {AIRCRAFT.map((a) => (
              <label key={a} className={checkboxLabel}>
                <input
                  type="checkbox"
                  className="size-4"
                  checked={aircraft.includes(a)}
                  disabled={pending}
                  onChange={(e) =>
                    setAircraft((list) => toggle(list, a, e.target.checked, AIRCRAFT))
                  }
                />
                {a}
              </label>
            ))}
          </CheckboxGroup>

          <section aria-labelledby={`${ratingIds}-title`} className="space-y-3">
            <h3 id={`${ratingIds}-title`} className="text-sm font-semibold">
              {t("ratingsTitle")}
            </h3>
            <p className="text-sm text-muted">{t("ratingsIntro")}</p>
            {ratings.length === 0 && <p className="text-sm text-muted">{t("ratingsNone")}</p>}
            <ol className="space-y-4">
              {ratings.map((rating, index) => {
                const n = index + 1;
                const id = (field: string) => `rating-${n}-${field}`;
                // A value unticked since keeps its option, so the row shows what will be refused.
                const aircraftOptions = inCatalogOrder(AIRCRAFT, [...aircraft, rating.aircraft]);
                const categoryOptions = inCatalogOrder(LICENCE_CATEGORIES, [
                  ...licenceCategories,
                  rating.category,
                ]);
                return (
                  <li key={rating.key} className="rounded-lg border border-line p-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field id={id("aircraft")} label={t("ratingAircraft", { n })}>
                        <select
                          id={id("aircraft")}
                          className={controlClass}
                          disabled={pending}
                          value={rating.aircraft}
                          onChange={(e) =>
                            updateRating(rating.key, { aircraft: e.target.value as Aircraft })
                          }
                        >
                          {aircraftOptions.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field id={id("category")} label={t("ratingCategory", { n })}>
                        <select
                          id={id("category")}
                          className={controlClass}
                          disabled={pending}
                          value={rating.category}
                          onChange={(e) =>
                            updateRating(rating.key, {
                              category: e.target.value as LicenceCategory,
                            })
                          }
                        >
                          {categoryOptions.map((c) => (
                            <option key={c} value={c}>
                              {tCategory(categoryKey(c))}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field id={id("expiry")} label={t("ratingExpiry", { n })}>
                        <input
                          id={id("expiry")}
                          type="date"
                          className={controlClass}
                          disabled={pending}
                          value={rating.expiresAt}
                          onChange={(e) => updateRating(rating.key, { expiresAt: e.target.value })}
                        />
                      </Field>
                      <Field id={id("restrictions")} label={t("ratingRestrictions", { n })}>
                        <input
                          id={id("restrictions")}
                          className={controlClass}
                          disabled={pending}
                          maxLength={RATING_RESTRICTIONS_MAX}
                          placeholder={t("ratingRestrictionsPlaceholder")}
                          value={rating.restrictions}
                          onChange={(e) =>
                            updateRating(rating.key, { restrictions: e.target.value })
                          }
                        />
                      </Field>
                    </div>
                    <div className="mt-3">
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          setRatings((rows) => rows.filter((r) => r.key !== rating.key))
                        }
                      >
                        {t("removeRating", { n })}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ol>
            {errors.typeRatings && (
              <p id="typeRatings-error" className="text-sm font-medium text-danger">
                {errors.typeRatings}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                disabled={pending || !canAddRating}
                aria-describedby={canAddRating ? undefined : `${ratingIds}-need`}
                onClick={addRating}
              >
                {t("addRating")}
              </Button>
              {aircraft.length === 0 || licenceCategories.length === 0 ? (
                <p id={`${ratingIds}-need`} className="text-sm text-muted">
                  {t("ratingsNeedDeclared")}
                </p>
              ) : null}
            </div>
            <p className="text-xs text-muted">{t("ratingsHint")}</p>
          </section>

          <Field
            id="generalRestrictions"
            label={t("generalRestrictions")}
            hint={t("generalRestrictionsHint")}
            error={errors.generalRestrictions}
          >
            <textarea
              {...input("generalRestrictions", t("generalRestrictionsHint"))}
              rows={3}
              maxLength={GENERAL_RESTRICTIONS_MAX}
              defaultValue={profile.generalRestrictions ?? ""}
            />
          </Field>
        </div>
      </Panel>

      <Panel title={t("experience")}>
        <div className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <Field id="yearsExperience" label={t("years")} error={errors.yearsExperience}>
              <input
                {...input("yearsExperience")}
                type="number"
                min={0}
                max={60}
                step={1}
                inputMode="numeric"
                defaultValue={profile.yearsExperience ?? ""}
              />
            </Field>
            <Field id="currentStatus" label={t("status")} error={errors.currentStatus}>
              <select {...input("currentStatus")} defaultValue={profile.currentStatus}>
                {TECHNICIAN_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {tDomain(`technicianStatus.${s}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="mobility" label={t("mobility")} error={errors.mobility}>
              <select {...input("mobility")} defaultValue={profile.mobility}>
                {MOBILITIES.map((m) => (
                  <option key={m} value={m}>
                    {tDomain(`mobility.${m}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="englishLevel" label={t("english")} error={errors.englishLevel}>
              <select {...input("englishLevel")} defaultValue={profile.englishLevel ?? ""}>
                <option value="">{t("notSet")}</option>
                {ENGLISH_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <CheckboxGroup id="engines" legend={t("engines")} error={errors.engines}>
            {ENGINES.map((engine) => (
              <label key={engine} className={checkboxLabel}>
                <input
                  type="checkbox"
                  className="size-4"
                  name="engines"
                  value={engine}
                  defaultChecked={profile.engines.includes(engine)}
                  disabled={pending}
                />
                {engine}
              </label>
            ))}
          </CheckboxGroup>
          <CheckboxGroup id="skills" legend={t("skills")} error={errors.skills}>
            {SKILLS.map((skill) => (
              <label key={skill} className={checkboxLabel}>
                <input
                  type="checkbox"
                  className="size-4"
                  name="skills"
                  value={skill}
                  defaultChecked={profile.skills.includes(skill)}
                  disabled={pending}
                />
                {tSkill(skill)}
              </label>
            ))}
          </CheckboxGroup>
          <label className={checkboxLabel}>
            <input
              type="checkbox"
              className="size-4"
              id="ownTools"
              name="ownTools"
              defaultChecked={profile.ownTools}
              disabled={pending}
            />
            {t("ownTools")}
          </label>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
            <p>{t("coursesHint")}</p>
            <ButtonLink href="/app/professional/qualifications" size="sm">
              {t("openQualifications")}
            </ButtonLink>
          </div>
        </div>
      </Panel>

      <Panel title={t("rateTitle")}>
        <div className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2 lg:max-w-2xl">
            <Field id="minRate" label={t("minRate")} hint={t("minRateHint")} error={errors.minRate}>
              <input
                {...input("minRate", t("minRateHint"))}
                type="number"
                min={0.01}
                step={0.01}
                inputMode="decimal"
                defaultValue={profile.minRate ?? ""}
              />
            </Field>
            <Field id="rateUnit" label={t("rateUnit")} error={errors.rateUnit}>
              <select {...input("rateUnit")} defaultValue={profile.rateUnit}>
                {RATE_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {tUnit(unit)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <CheckboxGroup
            id="workPermits"
            legend={t("permits")}
            hint={t("permitsHint")}
            error={errors.workPermits}
          >
            {EU_COUNTRIES.map((c) => (
              <label key={c} className={checkboxLabel}>
                <input
                  type="checkbox"
                  className="size-4"
                  name="workPermits"
                  value={c}
                  defaultChecked={profile.workPermits.includes(c)}
                  disabled={pending}
                />
                {countryNames[c]}
              </label>
            ))}
          </CheckboxGroup>
        </div>
      </Panel>

      <Panel title={t("visibilityTitle")}>
        <p className="mb-4 text-sm text-muted">{t("visibilityIntro")}</p>
        <div
          role="radiogroup"
          aria-label={t("visibilityAria")}
          aria-describedby={errors.visibility ? "visibility-error" : undefined}
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {PROFILE_VISIBILITIES.map((value, i) => {
            const selected = visibility === value;
            return (
              <button
                key={value}
                {...visibilityRadio(i)}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={pending}
                onClick={() => setVisibility(value)}
                className={`rounded-xl border p-4 text-left transition-colors hover:bg-canvas disabled:opacity-60 ${
                  selected ? "border-navy bg-info-bg ring-2 ring-navy" : "border-line bg-white"
                }`}
              >
                <span className="block font-semibold">{tDomain(`visibility.${value}.label`)}</span>
                <span className="mt-1 block text-sm text-muted">
                  {tDomain(`visibility.${value}.detail`)}
                </span>
              </button>
            );
          })}
        </div>
        {errors.visibility && (
          <p id="visibility-error" className="mt-2 text-sm font-medium text-danger">
            {errors.visibility}
          </p>
        )}
        <div className="mt-6">
          <CheckboxGroup
            id="blockedOrganizationIds"
            legend={t("blocks")}
            hint={t("blocksHint")}
            error={errors.blockedOrganizationIds}
          >
            {organizations.length === 0 ? (
              <p className="col-span-full text-sm text-muted">{t("blocksNone")}</p>
            ) : (
              organizations.map((o) => (
                <label key={o.id} className={checkboxLabel}>
                  <input
                    type="checkbox"
                    className="size-4"
                    name="blockedOrganizationIds"
                    value={o.id}
                    defaultChecked={profile.blockedOrganizationIds.includes(o.id)}
                    disabled={pending}
                  />
                  <span className="min-w-0 break-words">{o.name}</span>
                </label>
              ))
            )}
          </CheckboxGroup>
        </div>
      </Panel>

      {errors.form && <p className="text-sm font-medium text-danger">{errors.form}</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
          {pending ? tRoot("common.saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}
