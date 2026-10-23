"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
} from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { controlClass, describedBy, Field } from "@/components/ui/Field";
import { callAction } from "@/components/ui/Notice";
import { QUALIFICATION_CATEGORIES, type QualificationType } from "@/domain/qualification";
import {
  CONTRACT_TYPES,
  dayRate,
  EU_COUNTRIES,
  type RequirementLevel,
  REQUIREMENT_TIME_ZONES,
  requiredShiftDays,
  SHIFTS,
  shiftIssues,
  sortShifts,
  totalBaseHours,
  URGENCIES,
  type WorkRequirement,
} from "@/domain/work-requirement";
import type { Locale } from "@/i18n/config";
import { formatCountry, formatEuro, formatNumber, formatShiftSpan } from "@/i18n/format";
import { resolveFieldErrors, translateKey } from "@/i18n/validation";
import { useIdempotencyKey } from "@/lib/idempotency";
import { toLocalInput } from "@/lib/format";
import type { FieldErrors } from "@/lib/validation/errors";
import {
  createWorkRequirementInput,
  updateWorkRequirementInput,
  viableCandidatesInput,
} from "@/lib/validation/work-requirement";
import {
  countViableCandidatesAction,
  createRequirementAction,
  updateRequirementAction,
} from "../actions";
import {
  autosaveKey,
  clientIssue,
  type ConditionsDraft,
  draftFromRequirement,
  draftPeriod,
  draftToFields,
  emptyDraft,
  keepSelectableClient,
  mobilizationFor,
  nextDayInputs,
  readAutosave,
  type RequirementDraft,
  shiftFromInputs,
  toBuilderErrors,
} from "../form";
import { UrgencyBadge } from "./RequirementChips";
import { RequirementPreview } from "./RequirementPreview";

type Intent = "draft" | "publish" | undefined;

const noSubscription = () => () => {};
function writeAutosave(key: string, draft: RequirementDraft) {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), draft }));
  } catch {
    // storage full or blocked: nothing to do, the form keeps its state
  }
}
const readStorage = (key: string) => () => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // private mode / blocked storage: autosave is a convenience only
  }
};

/**
 * The requirement builder (v1.8 `CreateJob`, Company2.jsx:10-125, and the connected ShiftEditor, Account.jsx:77):
 * need, period and shifts, qualifications, conditions and logistics, with «Revisar antes de publicar» (live summary,
 * viable-candidate count, preview) and the actions «Guardar borrador» / «Publicar necesidad». Every rule lives in
 * the shared schema and the domain; the form only holds the inputs. Autosaved in this browser (v1.8 `useDraft`).
 */
export function RequirementForm({
  organizationId,
  qualificationTypes,
  initial,
  copyOf,
  recruiter,
}: {
  organizationId: string;
  qualificationTypes: QualificationType[];
  /** Edit mode (M05): the requirement as loaded, `updatedAt` included (optimistic check). */
  initial?: WorkRequirement;
  /** Duplicate (v2-14): a new requirement prefilled with this copy (already moved by `duplicateSchedule`). */
  copyOf?: WorkRequirement;
  /**
   * A staffing agency's builder (v1.8 «NECESIDAD PARA CLIENTE», BR-27): the active clients it may publish for;
   * publishing needs one («Selecciona un cliente.»). Absent for any other organization.
   */
  recruiter?: { clients: { id: string; name: string }[] };
}) {
  const tRecruiter = useTranslations("recruiter.builder");
  const t = useTranslations("organization.new");
  const tDomain = useTranslations("domain");
  const tRoot = useTranslations();
  const locale = useLocale() as Locale;
  const [draft, setDraft] = useState<RequirementDraft>(() =>
    keepSelectableClient(
      initial
        ? draftFromRequirement(initial)
        : copyOf
          ? draftFromRequirement(copyOf)
          : emptyDraft(t("defaults.arrival")),
      recruiter?.clients,
    ),
  );
  const [dirty, setDirty] = useState(false);
  const [rawErrors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<{ message: string; requestId?: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const [lastIntent, setLastIntent] = useState<Intent | "none">("none");
  const idempotency = useIdempotencyKey();
  const errors = resolveFieldErrors(tRoot, rawErrors);
  const isDraft = !initial || initial.status === "draft";

  const update = (change: (d: RequirementDraft) => RequirementDraft) => {
    setDraft(change);
    setDirty(true);
  };
  const set = <K extends keyof RequirementDraft>(key: K, value: RequirementDraft[K]) =>
    update((d) => ({ ...d, [key]: value }));
  const setCondition = <K extends keyof ConditionsDraft>(key: K, value: ConditionsDraft[K]) =>
    update((d) => ({ ...d, conditions: { ...d.conditions, [key]: value } }));

  // --- Autosave (v1.8 `useDraft`: every 350 ms, per organization and requirement) -----------------------
  const storageKey = autosaveKey(organizationId, initial?.id);
  const storedRaw = useSyncExternalStore(noSubscription, readStorage(storageKey), () => null);
  const [restoreResolved, setRestoreResolved] = useState(false);
  const restorable = !dirty && !restoreResolved ? readAutosave(storedRaw) : null;

  const forgetAutosave = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // blocked storage
    }
  };
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => writeAutosave(storageKey, draft), 350);
    return () => clearTimeout(timer);
  }, [dirty, draft, storageKey]);
  const restore = () => {
    if (!restorable) return;
    const base = emptyDraft(t("defaults.arrival"));
    const saved = restorable.draft;
    update(() =>
      keepSelectableClient(
        {
          ...base,
          ...saved,
          nextShift: { ...base.nextShift, ...saved.nextShift },
          conditions: { ...base.conditions, ...saved.conditions },
        },
        recruiter?.clients,
      ),
    );
    setRestoreResolved(true);
  };

  // --- Shifts (v2-09) ------------------------------------------------------------------------------------
  const shifts = sortShifts(draft.shifts);
  const period = draftPeriod(draft);
  const liveShiftIssues = [
    ...new Set(shiftIssues(shifts, draft.timeZone || null).map((i) => i.issue)),
  ];
  const nextShift = shiftFromInputs(draft.nextShift);
  const addShift = () => {
    if (!nextShift) return;
    update((d) => ({
      ...d,
      shifts: sortShifts([...d.shifts, nextShift]),
      nextShift: nextDayInputs(nextShift, d.nextShift.baseHours),
    }));
  };
  const removeShift = (startsAt: string) =>
    update((d) => ({ ...d, shifts: d.shifts.filter((s) => s.startsAt !== startsAt) }));

  // --- Live count of viable candidates (v2-13) -----------------------------------------------------------
  const hardIds = draft.qualifications.filter(([, level]) => level === "hard").map(([id]) => id);
  // The job's country counts too (matching-v18: a work permit for it, BR-3.7); "" = not stated.
  const country = draft.country || undefined;
  const countKey = JSON.stringify([
    period.startsAt,
    period.endsAt,
    draft.urgency,
    hardIds,
    country,
  ]);
  const countable = viableCandidatesInput.safeParse({
    organizationId,
    startsAt: period.startsAt,
    endsAt: period.endsAt,
    urgency: draft.urgency,
    hardQualificationTypeIds: hardIds,
    country,
  }).success;
  const [viable, setViable] = useState<{ key: string; value: number | null } | null>(null);
  useEffect(() => {
    const [startsAt, endsAt, urgency, hardQualificationTypeIds, countryOfKey] = JSON.parse(
      countKey,
    ) as [string, string, string, string[], string | null]; // JSON turns undefined into null
    const input = viableCandidatesInput.safeParse({
      organizationId,
      startsAt,
      endsAt,
      urgency,
      hardQualificationTypeIds,
      country: countryOfKey ?? undefined,
    });
    if (!input.success) return;
    let current = true;
    const timer = setTimeout(async () => {
      const result = await callAction(() => countViableCandidatesAction(input.data));
      if (current)
        setViable({ key: countKey, value: "viable" in result && result.ok ? result.viable : null });
    }, 600);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [countKey, organizationId]);
  const viableNow = viable?.key === countKey ? viable : null;

  // --- Submit ----------------------------------------------------------------------------------------------
  function submit(intent: Intent) {
    const fields = draftToFields(draft);
    const parsed = initial
      ? updateWorkRequirementInput.safeParse({
          id: initial.id,
          expectedUpdatedAt: initial.updatedAt,
          ...fields,
          ...(intent ? { intent } : {}),
        })
      : createWorkRequirementInput.safeParse({
          organizationId,
          ...fields,
          ...(intent === "draft" ? { intent } : {}),
        });
    setServerError(null);
    const missingClient = clientIssue(Boolean(recruiter), intent, draft.clientId);
    if (!parsed.success || missingClient) {
      setErrors({
        ...(parsed.success ? {} : toBuilderErrors(parsed.error)),
        ...(missingClient ? { onBehalfOfClientId: missingClient } : {}),
      });
      return;
    }
    setErrors({});
    setLastIntent(intent);
    const data = parsed.data;
    startTransition(async () => {
      // The action redirects on success; the autosave goes first and comes back if the save fails.
      forgetAutosave();
      const result = await callAction(() =>
        "id" in data
          ? updateRequirementAction(data)
          : createRequirementAction(data, idempotency.keyFor(data)),
      );
      if (result.status !== "error") return;
      writeAutosave(storageKey, draft);
      setErrors(result.fieldErrors ?? {});
      setServerError({
        message:
          "reason" in result && result.reason === "HAS_APPLICATIONS"
            ? t("hasApplications")
            : result.code === "CONFLICT" && initial
              ? t("stale")
              : result.code === "FORBIDDEN"
                ? t("forbidden")
                : result.code === "NETWORK_ERROR"
                  ? t("unreachable")
                  : result.code === "UNAUTHORIZED"
                    ? t("sessionExpired")
                    : result.code === "VALIDATION_ERROR"
                      ? tRoot("common.checkFields")
                      : tRoot(`api.${result.code}.description`),
        requestId: result.requestId,
      });
    });
  }
  const primaryIntent: Intent = initial && isDraft ? "publish" : undefined;
  // BR-27.4: the client a professional reads on a published requirement is the one who receives the data.
  const clientFixed = Boolean(initial && !isDraft);
  const clientHint = clientFixed
    ? tRecruiter("fixed")
    : recruiter?.clients.length
      ? tRecruiter("hint")
      : tRecruiter("noActive");
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(primaryIntent);
  }

  // --- Render helpers -----------------------------------------------------------------------------------
  const byCategory = Object.groupBy(qualificationTypes, (q) => q.category);
  const selected = new Map(draft.qualifications);
  const toggle = (id: string, include: boolean) =>
    update((d) => ({
      ...d,
      qualifications: include
        ? [...d.qualifications.filter(([q]) => q !== id), [id, "hard"]]
        : d.qualifications.filter(([q]) => q !== id),
    }));
  const setLevel = (id: string, level: RequirementLevel) =>
    update((d) => ({
      ...d,
      qualifications: d.qualifications.map(([q, l]) => [q, q === id ? level : l]),
    }));
  const control = (id: string) => ({
    id,
    name: id,
    className: controlClass,
    "aria-invalid": Boolean(errors[id]),
    "aria-describedby": describedBy(id, errors[id]),
  });
  const countries = useMemo(
    () =>
      EU_COUNTRIES.map((code) => ({ code, name: formatCountry(locale, code) })).sort((a, b) =>
        a.name.localeCompare(b.name, locale),
      ),
    [locale],
  );
  const conditions = draftToFields(draft).conditions as {
    hourlyRate?: number;
    shiftHours?: number;
  };
  const daily =
    Number.isFinite(conditions.hourlyRate) && Number.isFinite(conditions.shiftHours)
      ? dayRate(conditions)
      : null;
  const periodValid =
    !Number.isNaN(Date.parse(period.startsAt)) &&
    !Number.isNaN(Date.parse(period.endsAt)) &&
    Date.parse(period.endsAt) > Date.parse(period.startsAt);
  const headcount = Number(draft.headcount);
  const legend = "mb-3 text-sm font-semibold tracking-[0.12em] text-muted uppercase";
  const preview = {
    ...draftToFields(draft),
    headcount,
    qualifications: draft.qualifications.flatMap(([id, level]) => {
      const q = qualificationTypes.find((type) => type.id === id);
      return q ? [{ qualificationTypeId: id, code: q.code, name: q.name, level }] : [];
    }),
  };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start"
    >
      <div className="min-w-0 space-y-8 rounded-xl border border-line bg-white p-5 sm:p-6">
        {restorable && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue/20 bg-info-bg px-4 py-3 text-sm"
          >
            <p>
              {t("autosave.found", {
                date: new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(restorable.savedAt)),
              })}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="primary" onClick={restore}>
                {t("autosave.restore")}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  forgetAutosave();
                  setRestoreResolved(true);
                }}
              >
                {t("autosave.discard")}
              </Button>
            </div>
          </div>
        )}
        {serverError && (
          <div
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-sm text-danger"
          >
            <p className="font-semibold">{serverError.message}</p>
            {serverError.requestId && (
              <p className="mt-1 font-mono text-xs">
                {tRoot("common.reference", { id: serverError.requestId })}
              </p>
            )}
          </div>
        )}

        <fieldset className="grid min-w-0 gap-5 md:grid-cols-2">
          <legend className={legend}>{t("sectionNeed")}</legend>
          <Field id="title" label={t("fields.title")} error={errors.title}>
            <input
              {...control("title")}
              placeholder={t("titlePlaceholder")}
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </Field>
          <Field id="location" label={t("fields.location")} error={errors.location}>
            <input
              {...control("location")}
              placeholder={t("locationPlaceholder")}
              value={draft.location}
              onChange={(e) => set("location", e.target.value)}
            />
          </Field>
          <Field id="country" label={t("fields.country")} error={errors.country}>
            <select
              {...control("country")}
              value={draft.country}
              onChange={(e) => set("country", e.target.value as RequirementDraft["country"])}
            >
              <option value="">{t("fields.notStated")}</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            id="timeZone"
            label={t("fields.timeZone")}
            hint={t("timeZoneHint")}
            error={errors.timeZone}
          >
            <select
              {...control("timeZone")}
              aria-describedby={describedBy("timeZone", errors.timeZone, t("timeZoneHint"))}
              value={draft.timeZone}
              onChange={(e) => set("timeZone", e.target.value as RequirementDraft["timeZone"])}
            >
              <option value="">{t("fields.notStated")}</option>
              {REQUIREMENT_TIME_ZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </Field>
          <Field id="headcount" label={t("fields.headcount")} error={errors.headcount}>
            <input
              {...control("headcount")}
              type="number"
              min={1}
              max={50}
              value={draft.headcount}
              onChange={(e) => set("headcount", e.target.value)}
            />
          </Field>
          {recruiter && (
            <div className="md:col-span-2">
              <Field
                id="onBehalfOfClientId"
                label={tRecruiter("client")}
                hint={clientHint}
                error={errors.onBehalfOfClientId}
              >
                <select
                  {...control("onBehalfOfClientId")}
                  aria-describedby={describedBy(
                    "onBehalfOfClientId",
                    errors.onBehalfOfClientId,
                    clientHint,
                  )}
                  disabled={clientFixed}
                  value={draft.clientId}
                  onChange={(e) => set("clientId", e.target.value)}
                >
                  <option value="">{tRecruiter("choose")}</option>
                  {recruiter.clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              {!recruiter.clients.length && !clientFixed && (
                <Link
                  href="/app/recruiter#clients"
                  className="mt-1 inline-flex items-center text-sm font-semibold text-blue hover:underline pointer-coarse:min-h-11"
                >
                  {tRecruiter("manage")}
                </Link>
              )}
            </div>
          )}
          <Field id="urgency" label={t("fields.urgency")} error={errors.urgency}>
            <select
              {...control("urgency")}
              value={draft.urgency}
              onChange={(e) => {
                const urgency = e.target.value as RequirementDraft["urgency"];
                update((d) => ({
                  ...d,
                  urgency,
                  conditions: {
                    ...d.conditions,
                    maxMobilizationHours: mobilizationFor(
                      urgency,
                      d.conditions.maxMobilizationHours,
                    ),
                  },
                }));
              }}
            >
              {URGENCIES.map((u) => (
                <option key={u} value={u}>
                  {tDomain(`urgency.${u}`)}
                </option>
              ))}
            </select>
          </Field>
        </fieldset>

        <fieldset className="min-w-0 space-y-5">
          <legend className={legend}>{t("sectionPeriod")}</legend>
          <div className="grid gap-5 md:grid-cols-3">
            <Field
              id="startsAt"
              label={t("fields.starts")}
              hint={shifts.length ? t("shifts.periodFromShifts") : undefined}
              error={errors.startsAt}
            >
              <input
                {...control("startsAt")}
                type="datetime-local"
                disabled={shifts.length > 0}
                value={shifts.length ? toLocalInput(period.startsAt) : draft.startsAt}
                onChange={(e) => set("startsAt", e.target.value)}
              />
            </Field>
            <Field id="endsAt" label={t("fields.ends")} error={errors.endsAt}>
              <input
                {...control("endsAt")}
                type="datetime-local"
                disabled={shifts.length > 0}
                value={shifts.length ? toLocalInput(period.endsAt) : draft.endsAt}
                onChange={(e) => set("endsAt", e.target.value)}
              />
            </Field>
            <Field id="shift" label={t("fields.shift")} error={errors.shift}>
              <select
                {...control("shift")}
                value={draft.shift}
                onChange={(e) => set("shift", e.target.value as RequirementDraft["shift"])}
              >
                {SHIFTS.map((s) => (
                  <option key={s} value={s}>
                    {tDomain(`shift.${s}`)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div
            role="group"
            aria-labelledby="shifts-title"
            aria-describedby={errors.shifts ? "shifts-error" : "shifts-intro"}
            className="space-y-3 border-t border-line pt-4"
          >
            <h3 id="shifts-title" className="text-sm font-semibold">
              {t("shifts.title")}
            </h3>
            <p id="shifts-intro" className="text-sm text-muted">
              {t("shifts.intro")}
            </p>
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem_auto] md:items-end">
              <Field id="nextShiftStart" label={t("shifts.start")}>
                <input
                  id="nextShiftStart"
                  className={controlClass}
                  type="datetime-local"
                  value={draft.nextShift.startsAt}
                  onChange={(e) =>
                    set("nextShift", { ...draft.nextShift, startsAt: e.target.value })
                  }
                />
              </Field>
              <Field id="nextShiftEnd" label={t("shifts.end")}>
                <input
                  id="nextShiftEnd"
                  className={controlClass}
                  type="datetime-local"
                  value={draft.nextShift.endsAt}
                  onChange={(e) => set("nextShift", { ...draft.nextShift, endsAt: e.target.value })}
                />
              </Field>
              <Field id="nextShiftHours" label={t("shifts.hours")}>
                <input
                  id="nextShiftHours"
                  className={controlClass}
                  type="number"
                  min={0.25}
                  max={24}
                  step={0.25}
                  value={draft.nextShift.baseHours}
                  onChange={(e) =>
                    set("nextShift", { ...draft.nextShift, baseHours: e.target.value })
                  }
                />
              </Field>
              <Button className="whitespace-nowrap" onClick={addShift} disabled={!nextShift}>
                {t("shifts.add")}
              </Button>
            </div>
            {shifts.length > 0 && (
              <>
                <ol className="divide-y divide-line rounded-lg border border-line">
                  {shifts.map((s) => {
                    const span = formatShiftSpan(locale, s.startsAt, s.endsAt);
                    return (
                      <li
                        key={s.startsAt}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm tabular-nums"
                      >
                        <span>
                          {t("shifts.row", { span, hours: formatNumber(locale, s.baseHours) })}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={t("shifts.removeAria", { span })}
                          onClick={() => removeShift(s.startsAt)}
                        >
                          {t("shifts.remove")}
                        </Button>
                      </li>
                    );
                  })}
                </ol>
                <p className="text-sm">
                  {t.rich("shifts.summary", {
                    hours: formatNumber(locale, totalBaseHours(shifts)),
                    count: shifts.length,
                    b: (chunks) => <strong>{chunks}</strong>,
                  })}
                </p>
              </>
            )}
            {(errors.shifts || liveShiftIssues.length > 0) && (
              <ul id="shifts-error" className="space-y-1 text-sm font-medium text-danger">
                {errors.shifts && <li>{errors.shifts}</li>}
                {liveShiftIssues
                  .map((issue) => translateKey(tRoot, `v.requirement.shifts.${issue}`))
                  .filter((message) => message !== errors.shifts)
                  .map((message) => (
                    <li key={message}>{message}</li>
                  ))}
              </ul>
            )}
          </div>
        </fieldset>

        <fieldset
          className="min-w-0"
          aria-describedby={errors.qualifications ? "qualifications-error" : undefined}
        >
          <legend className="mb-1 text-sm font-semibold tracking-[0.12em] text-muted uppercase">
            {t("sectionQualifications")}
          </legend>
          <p className="mb-4 text-sm text-muted">
            {t.rich("qualificationsIntro", {
              b: (chunks) => <strong className="text-ink">{chunks}</strong>,
            })}
          </p>
          {errors.qualifications && (
            <p id="qualifications-error" className="mb-3 text-sm font-medium text-danger">
              {errors.qualifications}
            </p>
          )}
          <div className="grid gap-6 md:grid-cols-2">
            {QUALIFICATION_CATEGORIES.map((category) => {
              const items = byCategory[category];
              if (!items?.length) return null;
              return (
                <div key={category}>
                  <h3 className="mb-2 text-sm font-semibold">{tDomain(`category.${category}`)}</h3>
                  <ul className="divide-y divide-line rounded-lg border border-line bg-white">
                    {items.map((q) => {
                      const level = selected.get(q.id);
                      const checkboxId = `q-${q.id}`;
                      return (
                        <li key={q.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                          <input
                            id={checkboxId}
                            type="checkbox"
                            className="size-4"
                            checked={level !== undefined}
                            onChange={(e) => toggle(q.id, e.target.checked)}
                          />
                          <label
                            htmlFor={checkboxId}
                            className="min-w-0 flex-1 text-sm pointer-coarse:py-3"
                          >
                            <span className="font-mono font-semibold">{q.code}</span>{" "}
                            <span className="text-muted">{q.name}</span>
                          </label>
                          {level && (
                            <select
                              aria-label={t("levelAria", { code: q.code })}
                              value={level}
                              onChange={(e) => setLevel(q.id, e.target.value as RequirementLevel)}
                              className="min-h-9 pointer-coarse:min-h-11 rounded-md border border-line bg-white px-2 text-sm"
                            >
                              <option value="hard">{tDomain("level.hard")}</option>
                              <option value="soft">{tDomain("level.soft")}</option>
                            </select>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="min-w-0 space-y-5">
          <legend className={legend}>{t("sectionTerms")}</legend>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {(["hourlyRate", "shiftHours", "overtimeRate", "perDiem"] as const).map((key) => {
              const id = `conditions.${key}`;
              return (
                <Field key={key} id={id} label={t(`terms.${key}`)} error={errors[id]}>
                  <input
                    {...control(id)}
                    type="number"
                    inputMode="decimal"
                    min={key === "shiftHours" ? 0.25 : 0}
                    max={key === "shiftHours" ? 24 : 2000}
                    step={0.01}
                    value={draft.conditions[key]}
                    onChange={(e) => setCondition(key, e.target.value)}
                  />
                </Field>
              );
            })}
            <Field
              id="conditions.contractType"
              label={t("terms.contractType")}
              error={errors["conditions.contractType"]}
            >
              <select
                {...control("conditions.contractType")}
                value={draft.conditions.contractType}
                onChange={(e) =>
                  setCondition("contractType", e.target.value as ConditionsDraft["contractType"])
                }
              >
                <option value="">{t("fields.notStated")}</option>
                {CONTRACT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {tRoot(`organization.detail.terms.contractType.${type}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              id="conditions.maxMobilizationHours"
              label={t("terms.maxMobilizationHours")}
              error={errors["conditions.maxMobilizationHours"]}
            >
              <input
                {...control("conditions.maxMobilizationHours")}
                type="number"
                min={1}
                max={168}
                step={1}
                value={draft.conditions.maxMobilizationHours}
                onChange={(e) => setCondition("maxMobilizationHours", e.target.value)}
              />
            </Field>
            <Field
              id="conditions.arrival"
              label={t("terms.arrival")}
              error={errors["conditions.arrival"]}
            >
              <input
                {...control("conditions.arrival")}
                maxLength={160}
                value={draft.conditions.arrival}
                onChange={(e) => setCondition("arrival", e.target.value)}
              />
            </Field>
          </div>
          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {(
              [
                "budgetMandatory",
                "flights",
                "accommodation",
                "localTransport",
                "meals",
                "ownTools",
              ] as const
            ).map((key) => (
              <label
                key={key}
                className="flex items-center gap-3 py-1.5 text-sm pointer-coarse:py-3"
              >
                <input
                  type="checkbox"
                  className="size-4"
                  checked={draft.conditions[key]}
                  onChange={(e) => setCondition(key, e.target.checked)}
                />
                {t(`terms.${key}`)}
              </label>
            ))}
          </div>
          <Field
            id="description"
            label={t("fields.description")}
            hint={t("descriptionHint")}
            error={errors.description}
          >
            <textarea
              {...control("description")}
              aria-describedby={describedBy(
                "description",
                errors.description,
                t("descriptionHint"),
              )}
              rows={4}
              maxLength={4000}
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>
          <p className="text-xs text-muted">{tRoot("organization.detail.terms.notice")}</p>
        </fieldset>
      </div>

      <aside
        aria-labelledby="review-title"
        className="space-y-3 rounded-xl bg-navy p-5 text-sm text-white lg:sticky lg:top-6"
      >
        <h2 id="review-title" className="text-xs font-semibold tracking-[0.12em] uppercase">
          {t("summary.title")}
        </h2>
        <UrgencyBadge urgency={draft.urgency} />
        <p className="text-lg font-semibold break-words">
          {draft.title.trim() || t("summary.untitled")}
        </p>
        {recruiter && draft.clientId && (
          <p>
            {tRecruiter("summary", {
              client: recruiter.clients.find((c) => c.id === draft.clientId)?.name ?? "",
            })}
          </p>
        )}
        {draft.location.trim() && (
          <p>
            {draft.country
              ? t("summary.place", {
                  base: draft.location.trim(),
                  country: formatCountry(locale, draft.country),
                })
              : draft.location.trim()}
          </p>
        )}
        {daily !== null && conditions.shiftHours !== undefined && (
          <p className="tabular-nums">
            {t("summary.dayRate", {
              amount: formatEuro(locale, daily),
              hours: formatNumber(locale, conditions.shiftHours),
            })}
          </p>
        )}
        {periodValid && Number.isInteger(headcount) && headcount > 0 && (
          <p className="tabular-nums">
            {t("summary.requiredShifts", {
              count: requiredShiftDays({ ...period, headcount, shifts }),
            })}
          </p>
        )}
        <p role="status" className="text-white/85">
          {!countable
            ? t("summary.viableNeedsHard")
            : !viableNow
              ? t("summary.viableLoading")
              : viableNow.value === null
                ? t("summary.viableUnavailable")
                : t("summary.viable", { count: viableNow.value })}
        </p>
        <RequirementPreview requirement={preview} />
        {isDraft && <p className="text-white/85">{t("summary.draftNote")}</p>}
        {/* v1.8 Company2.jsx:125, shown to the agency only (the client company never sees it: ORG-03 #13). */}
        {recruiter && <p className="text-white/85">{tRecruiter("note")}</p>}
        <div className="flex flex-col gap-2 border-t border-white/20 pt-3">
          {isDraft && (
            <Button
              variant="inverse"
              disabled={pending}
              aria-busy={pending}
              onClick={() => submit("draft")}
            >
              {pending && lastIntent === "draft" ? t("savingDraft") : t("saveDraft")}
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
            {pending && lastIntent !== "draft"
              ? t(initial && !isDraft ? "editSubmitting" : "submitting")
              : t(!initial ? "submit" : isDraft ? "saveAndPublish" : "editSubmit")}
          </Button>
          <ButtonLink
            variant="inverse"
            href={
              initial
                ? `/app/organization/requirements/${initial.id}`
                : "/app/organization/requirements"
            }
          >
            {tRoot("common.cancel")}
          </ButtonLink>
        </div>
      </aside>
    </form>
  );
}
