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
import { controlClass, Field } from "@/components/ui/Field";
import { describedBy } from "@/components/ui/field-ids";
import { callAction } from "@/components/ui/action-result";
import { AIRCRAFT, categoryKey, ENGINES, PROFESSIONAL_CATEGORIES, SKILLS } from "@/domain/passport";
import { QUALIFICATION_CATEGORIES, type QualificationType } from "@/domain/qualification";
import {
  CONTRACT_TYPES,
  dayRate,
  EU_COUNTRIES,
  type RequirementLevel,
  type RequirementShift,
  REQUIREMENT_TIME_ZONES,
  requiredShiftDays,
  SHIFTS,
  shiftIssues,
  sortShifts,
  totalBaseHours,
  typeRatingRuleIncomplete,
  URGENCIES,
  type WorkRequirement,
} from "@/domain/work-requirement";
import type { Locale } from "@/i18n/config";
import {
  formatCountry,
  formatEuro,
  formatLocalDateTime,
  formatNumber,
  formatShiftSpan,
} from "@/i18n/format";
import { type MessageResolver, resolveFieldErrors, translateKey } from "@/i18n/validation";
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
  statesProfileRules,
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
  const t = useTranslations("organization.new");
  const tRoot = useTranslations();
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

  const storageKey = autosaveKey(organizationId, initial?.id);
  const autosave = useAutosave(storageKey, draft, dirty);
  const restore = () => {
    if (!autosave.restorable) return;
    update(() =>
      restoredDraft(autosave.restorable!.draft, t("defaults.arrival"), recruiter?.clients),
    );
    autosave.resolve();
  };

  const shifts = sortShifts(draft.shifts);
  const period = draftPeriod(draft);
  const viable = useViableCount(organizationId, draft, period);
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
      autosave.forget();
      const result = await callAction(() =>
        "id" in data
          ? updateRequirementAction(data)
          : createRequirementAction(data, idempotency.keyFor(data)),
      );
      if (result.status !== "error") return;
      writeAutosave(storageKey, draft);
      setErrors(result.fieldErrors ?? {});
      setServerError({
        message: serverMessage(result, Boolean(initial), t, tRoot),
        requestId: result.requestId,
      });
    });
  }
  const primaryIntent: Intent = initial && isDraft ? "publish" : undefined;
  // BR-27.4: the client a professional reads on a published requirement is the one who receives the data.
  const clientFixed = Boolean(initial && !isDraft);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(primaryIntent);
  }
  const control = controlProps(errors);
  const sectionProps = { draft, errors, control, set, update };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start"
    >
      <div className="min-w-0 space-y-8 rounded-xl border border-line bg-white p-5 sm:p-6">
        {autosave.restorable && (
          <AutosaveBanner
            savedAt={autosave.restorable.savedAt}
            onRestore={restore}
            onDiscard={() => {
              autosave.forget();
              autosave.resolve();
            }}
          />
        )}
        {serverError && <ServerErrorAlert error={serverError} />}
        <NeedSection {...sectionProps} recruiter={recruiter} clientFixed={clientFixed} />
        <PeriodSection {...sectionProps} shifts={shifts} period={period} />
        <QualificationsSection {...sectionProps} qualificationTypes={qualificationTypes} />
        <TermsSection {...sectionProps} />
      </div>
      <ReviewAside
        draft={draft}
        recruiter={recruiter}
        shifts={shifts}
        period={period}
        viable={viable}
        qualificationTypes={qualificationTypes}
        isDraft={isDraft}
        editingId={initial?.id}
        pending={pending}
        lastIntent={lastIntent}
        onSaveDraft={() => submit("draft")}
      />
    </form>
  );
}

const legend = "mb-3 text-sm font-semibold tracking-[0.12em] text-muted uppercase";

type Errors = ReturnType<typeof resolveFieldErrors>;
type Update = (change: (d: RequirementDraft) => RequirementDraft) => void;
type SetField = <K extends keyof RequirementDraft>(key: K, value: RequirementDraft[K]) => void;
type BuilderT = ReturnType<typeof useTranslations<"organization.new">>;
type RootT = MessageResolver;
type Period = ReturnType<typeof draftPeriod>;
type Shifts = RequirementShift[];
type Clients = { id: string; name: string }[];
type Viable = { countable: boolean; value: { value: number | null } | null };

/** The id, name, class and error wiring of one builder control. */
function controlProps(errors: Errors) {
  return (id: string) => ({
    id,
    name: id,
    className: controlClass,
    "aria-invalid": Boolean(errors[id]),
    "aria-describedby": describedBy(id, errors[id]),
  });
}

type Control = ReturnType<typeof controlProps>;

interface SectionProps {
  draft: RequirementDraft;
  errors: Errors;
  control: Control;
  set: SetField;
  update: Update;
}

/** The copy of a failed save: applications already in, a stale edit, or the API's own error. */
function serverMessage(
  result: { code: string; reason?: unknown } & Record<string, unknown>,
  editing: boolean,
  t: BuilderT,
  tRoot: RootT,
) {
  if ("reason" in result && result.reason === "HAS_APPLICATIONS") return t("hasApplications");
  if (result.code === "CONFLICT" && editing) return t("stale");
  if (result.code === "FORBIDDEN") return t("forbidden");
  if (result.code === "NETWORK_ERROR") return t("unreachable");
  if (result.code === "UNAUTHORIZED") return t("sessionExpired");
  if (result.code === "VALIDATION_ERROR") return translateKey(tRoot, "common.checkFields");
  return translateKey(tRoot, `api.${result.code}.description`);
}

const submitKey = (editingId: string | undefined, isDraft: boolean) =>
  !editingId ? "submit" : isDraft ? "saveAndPublish" : "editSubmit";

function viableLabel(viable: Viable, t: BuilderT) {
  if (!viable.countable) return t("summary.viableNeedsHard");
  if (!viable.value) return t("summary.viableLoading");
  if (viable.value.value === null) return t("summary.viableUnavailable");
  return t("summary.viable", { count: viable.value.value });
}

/** A saved draft over today's defaults (fields added since it was saved keep their default). */
function restoredDraft(saved: RequirementDraft, arrival: string, clients: Clients | undefined) {
  const base = emptyDraft(arrival);
  return keepSelectableClient(
    {
      ...base,
      ...saved,
      nextShift: { ...base.nextShift, ...saved.nextShift },
      conditions: { ...base.conditions, ...saved.conditions },
    },
    clients,
  );
}

/** Autosave (v1.8 `useDraft`: every 350 ms, per organization and requirement) and the draft it offers back. */
function useAutosave(storageKey: string, draft: RequirementDraft, dirty: boolean) {
  const storedRaw = useSyncExternalStore(noSubscription, readStorage(storageKey), () => null);
  const [resolved, setResolved] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => writeAutosave(storageKey, draft), 350);
    return () => clearTimeout(timer);
  }, [dirty, draft, storageKey]);
  return {
    restorable: !dirty && !resolved ? readAutosave(storedRaw) : null,
    resolve: () => setResolved(true),
    forget: () => {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // blocked storage
      }
    },
  };
}

/** Live count of viable candidates (v2-13), debounced, for the period, urgency, hard qualifications and country. */
function useViableCount(organizationId: string, draft: RequirementDraft, period: Period): Viable {
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
  return { countable, value: viable?.key === countKey ? viable : null };
}

function AutosaveBanner({
  savedAt,
  onRestore,
  onDiscard,
}: {
  savedAt: string;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  const t = useTranslations("organization.new");
  const locale = useLocale() as Locale;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue/20 bg-info-bg px-4 py-3 text-sm"
    >
      <p>{t("autosave.found", { date: formatLocalDateTime(locale, savedAt) })}</p>
      <div className="flex gap-2">
        <Button size="sm" variant="primary" onClick={onRestore}>
          {t("autosave.restore")}
        </Button>
        <Button size="sm" onClick={onDiscard}>
          {t("autosave.discard")}
        </Button>
      </div>
    </div>
  );
}

function ServerErrorAlert({ error }: { error: { message: string; requestId?: string } }) {
  const tRoot = useTranslations();
  return (
    <div
      role="alert"
      className="rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-sm text-danger"
    >
      <p className="font-semibold">{error.message}</p>
      {error.requestId && (
        <p className="mt-1 font-mono text-xs">
          {tRoot("common.reference", { id: error.requestId })}
        </p>
      )}
    </div>
  );
}

/** A staffing agency's client (BR-27): fixed once the requirement is published. */
function ClientField({
  clients,
  fixed,
  errors,
  control,
  draft,
  set,
}: Omit<SectionProps, "update"> & { clients: Clients; fixed: boolean }) {
  const tRecruiter = useTranslations("recruiter.builder");
  const clientHint = fixed
    ? tRecruiter("fixed")
    : clients.length
      ? tRecruiter("hint")
      : tRecruiter("noActive");
  return (
    <>
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
          disabled={fixed}
          value={draft.clientId}
          onChange={(e) => set("clientId", e.target.value)}
        >
          <option value="">{tRecruiter("choose")}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      {!clients.length && !fixed && (
        <Link
          href="/app/recruiter#clients"
          className="mt-1 inline-flex items-center text-sm font-semibold text-blue hover:underline pointer-coarse:min-h-11"
        >
          {tRecruiter("manage")}
        </Link>
      )}
    </>
  );
}

/** Title, place, time zone, headcount, the agency's client and urgency. */
function NeedSection({
  draft,
  errors,
  control,
  set,
  update,
  recruiter,
  clientFixed,
}: SectionProps & { recruiter?: { clients: Clients }; clientFixed: boolean }) {
  const t = useTranslations("organization.new");
  const tDomain = useTranslations("domain");
  const locale = useLocale() as Locale;
  const countries = useMemo(
    () =>
      EU_COUNTRIES.map((code) => ({ code, name: formatCountry(locale, code) })).sort((a, b) =>
        a.name.localeCompare(b.name, locale),
      ),
    [locale],
  );
  return (
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
          <ClientField
            clients={recruiter.clients}
            fixed={clientFixed}
            errors={errors}
            control={control}
            draft={draft}
            set={set}
          />
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
                maxMobilizationHours: mobilizationFor(urgency, d.conditions.maxMobilizationHours),
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
  );
}

/** The shifts (v2-09): add one at a time, the list with its total hours, and the live issues. */
function ShiftsEditor({
  draft,
  set,
  update,
  shifts,
  error,
}: Pick<SectionProps, "draft" | "set" | "update"> & { shifts: Shifts; error?: string }) {
  const t = useTranslations("organization.new");
  const tRoot = useTranslations();
  const locale = useLocale() as Locale;
  const errors = { shifts: error };
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
  return (
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
            onChange={(e) => set("nextShift", { ...draft.nextShift, startsAt: e.target.value })}
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
            onChange={(e) => set("nextShift", { ...draft.nextShift, baseHours: e.target.value })}
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
                  <span>{t("shifts.row", { span, hours: formatNumber(locale, s.baseHours) })}</span>
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
  );
}

/** Start, end and shift type (taken from the shifts once there are any), then the shifts. */
function PeriodSection({
  draft,
  errors,
  control,
  set,
  update,
  shifts,
  period,
}: SectionProps & { shifts: Shifts; period: Period }) {
  const t = useTranslations("organization.new");
  const tDomain = useTranslations("domain");
  return (
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

      <ShiftsEditor draft={draft} set={set} update={update} shifts={shifts} error={errors.shifts} />
    </fieldset>
  );
}

/** v1.8 «01 · Perfil técnico» (Company2.jsx:114; P10, BR-3.8–3.13): each rule counts only when stated. */
function ProfileRules({ draft, errors, control, set, update }: SectionProps) {
  const t = useTranslations("organization.new");
  const tCategory = useTranslations("passport.categories");
  const tSkill = useTranslations("passport.skills");
  const tRoot = useTranslations();
  return (
    <div
      role="group"
      aria-labelledby="rules-title"
      aria-describedby="rules-intro"
      className="mt-6 space-y-4 border-t border-line pt-4"
    >
      <h3 id="rules-title" className="text-sm font-semibold">
        {t("rules.title")}
      </h3>
      <p id="rules-intro" className="text-sm text-muted">
        {t("rules.intro")}
      </p>
      <div className="grid gap-5 md:grid-cols-2">
        <Field id="category" label={t("rules.category")} error={errors.category}>
          <select
            {...control("category")}
            value={draft.category}
            onChange={(e) => set("category", e.target.value as RequirementDraft["category"])}
          >
            <option value="">{t("rules.anyCategory")}</option>
            {PROFESSIONAL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {tCategory(categoryKey(c))}
              </option>
            ))}
          </select>
        </Field>
        <Field id="minYears" label={t("rules.minYears")} error={errors.minYears}>
          <input
            {...control("minYears")}
            type="number"
            inputMode="numeric"
            min={0}
            max={60}
            step={1}
            value={draft.minYears}
            onChange={(e) => set("minYears", e.target.value)}
          />
        </Field>
      </div>
      {(
        [
          ["aircraft", AIRCRAFT, (v: string) => v] as const,
          ["engines", ENGINES, (v: string) => v] as const,
          ["requiredSkills", SKILLS, (v: string) => tSkill(v as (typeof SKILLS)[number])] as const,
        ] as const
      ).map(([key, options, label]) => (
        <fieldset
          key={key}
          className="min-w-0"
          aria-describedby={errors[key] ? `${key}-error` : undefined}
        >
          <legend className="mb-2 text-sm font-semibold">{t(`rules.${key}`)}</legend>
          {errors[key] && (
            <p id={`${key}-error`} className="mb-2 text-sm font-medium text-danger">
              {errors[key]}
            </p>
          )}
          <ul className="flex flex-wrap gap-2">
            {options.map((option) => {
              const checked = (draft[key] as readonly string[]).includes(option);
              return (
                <li key={option}>
                  <label
                    className={`inline-flex min-h-9 pointer-coarse:min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm ${
                      checked ? "border-navy bg-navy text-white" : "border-line bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={checked}
                      onChange={(e) =>
                        update((d) => ({
                          ...d,
                          [key]: e.target.checked
                            ? [...(d[key] as readonly string[]), option]
                            : (d[key] as readonly string[]).filter((v) => v !== option),
                        }))
                      }
                    />
                    {label(option)}
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}
      <div>
        <label className="flex items-center gap-3 py-1.5 text-sm pointer-coarse:py-3">
          <input
            id="requiresTypeRating"
            type="checkbox"
            className="size-4"
            checked={draft.requiresTypeRating}
            aria-invalid={Boolean(errors.requiresTypeRating)}
            aria-describedby={errors.requiresTypeRating ? "requiresTypeRating-error" : undefined}
            onChange={(e) => set("requiresTypeRating", e.target.checked)}
          />
          {t("rules.requiresTypeRating")}
        </label>
        {/* T-83: a licence category and ≥ 1 aircraft; «Selecciona una aeronave si exiges habilitación de tipo.» */}
        {errors.requiresTypeRating ? (
          <p id="requiresTypeRating-error" className="text-sm font-medium text-danger">
            {errors.requiresTypeRating}
          </p>
        ) : (
          typeRatingRuleIncomplete(draft) && (
            <p className="text-sm text-warn">
              {translateKey(tRoot, "v.requirement.rules.typeRating")}
            </p>
          )
        )}
      </div>
    </div>
  );
}

/** The required qualifications by category (hard or soft) and the profile rules. */
function QualificationsSection({
  draft,
  errors,
  control,
  set,
  update,
  qualificationTypes,
}: SectionProps & { qualificationTypes: QualificationType[] }) {
  const t = useTranslations("organization.new");
  const tDomain = useTranslations("domain");
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
  return (
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

      {/* v1.8 «01 · Perfil técnico» (Company2.jsx:114; P10, BR-3.8–3.13): each rule counts only when stated. */}
      <ProfileRules draft={draft} errors={errors} control={control} set={set} update={update} />
    </fieldset>
  );
}

/** Rate, hours, contract, mobilization, arrival, the included logistics and the description. */
function TermsSection({ draft, errors, control, set, update }: SectionProps) {
  const t = useTranslations("organization.new");
  const tRoot = useTranslations();
  const setCondition = <K extends keyof ConditionsDraft>(key: K, value: ConditionsDraft[K]) =>
    update((d) => ({ ...d, conditions: { ...d.conditions, [key]: value } }));
  return (
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
          <label key={key} className="flex items-center gap-3 py-1.5 text-sm pointer-coarse:py-3">
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
          aria-describedby={describedBy("description", errors.description, t("descriptionHint"))}
          rows={4}
          maxLength={4000}
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>
      <p className="text-xs text-muted">{tRoot("organization.detail.terms.notice")}</p>
    </fieldset>
  );
}

/** «Revisar antes de publicar»: the live summary, viable-candidate count, preview and the actions. */
function ReviewAside({
  draft,
  recruiter,
  shifts,
  period,
  viable,
  qualificationTypes,
  isDraft,
  editingId,
  pending,
  lastIntent,
  onSaveDraft,
}: {
  draft: RequirementDraft;
  recruiter?: { clients: Clients };
  shifts: Shifts;
  period: Period;
  viable: Viable;
  qualificationTypes: QualificationType[];
  isDraft: boolean;
  editingId: string | undefined;
  pending: boolean;
  lastIntent: Intent | "none";
  onSaveDraft: () => void;
}) {
  const t = useTranslations("organization.new");
  const tRecruiter = useTranslations("recruiter.builder");
  const fields = draftToFields(draft);
  const conditions = fields.conditions as { hourlyRate?: number; shiftHours?: number };
  const headcount = Number(draft.headcount);
  const preview = {
    ...fields,
    headcount,
    qualifications: draft.qualifications.flatMap(([id, level]) => {
      const q = qualificationTypes.find((type) => type.id === id);
      return q ? [{ qualificationTypeId: id, code: q.code, name: q.name, level }] : [];
    }),
  };
  return (
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
      <SummaryFacts
        draft={draft}
        clients={recruiter?.clients}
        shifts={shifts}
        period={period}
        conditions={conditions}
        headcount={headcount}
      />
      <p role="status" className="text-white/85">
        {viableLabel(viable, t)}
      </p>
      {/* T-86: the live count applies the country only, not the other profile rules (security floor). */}
      {viable.countable && statesProfileRules(draft) && (
        <p className="text-white/85">{t("summary.viableRulesNote")}</p>
      )}
      <RequirementPreview requirement={preview} />
      {isDraft && <p className="text-white/85">{t("summary.draftNote")}</p>}
      {/* v1.8 Company2.jsx:125, shown to the agency only (the client company never sees it: ORG-03 #13). */}
      {recruiter && <p className="text-white/85">{tRecruiter("note")}</p>}
      <AsideActions
        isDraft={isDraft}
        editingId={editingId}
        pending={pending}
        lastIntent={lastIntent}
        onSaveDraft={onSaveDraft}
      />
    </aside>
  );
}

/** The client, place, day rate and required shift-days, each shown once it can be computed. */
function SummaryFacts({
  draft,
  clients,
  shifts,
  period,
  conditions,
  headcount,
}: {
  draft: RequirementDraft;
  clients: Clients | undefined;
  shifts: Shifts;
  period: Period;
  conditions: { hourlyRate?: number; shiftHours?: number };
  headcount: number;
}) {
  const t = useTranslations("organization.new");
  const tRecruiter = useTranslations("recruiter.builder");
  const locale = useLocale() as Locale;
  const daily =
    Number.isFinite(conditions.hourlyRate) && Number.isFinite(conditions.shiftHours)
      ? dayRate(conditions)
      : null;
  const periodValid =
    !Number.isNaN(Date.parse(period.startsAt)) &&
    !Number.isNaN(Date.parse(period.endsAt)) &&
    Date.parse(period.endsAt) > Date.parse(period.startsAt);
  return (
    <>
      {clients && draft.clientId && (
        <p>
          {tRecruiter("summary", {
            client: clients.find((c) => c.id === draft.clientId)?.name ?? "",
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
    </>
  );
}

/** «Guardar borrador» (drafts only), save or publish, and cancel back to where the builder was opened. */
function AsideActions({
  isDraft,
  editingId,
  pending,
  lastIntent,
  onSaveDraft,
}: {
  isDraft: boolean;
  editingId: string | undefined;
  pending: boolean;
  lastIntent: Intent | "none";
  onSaveDraft: () => void;
}) {
  const t = useTranslations("organization.new");
  const tRoot = useTranslations();
  return (
    <div className="flex flex-col gap-2 border-t border-white/20 pt-3">
      {isDraft && (
        <Button variant="inverse" disabled={pending} aria-busy={pending} onClick={onSaveDraft}>
          {pending && lastIntent === "draft" ? t("savingDraft") : t("saveDraft")}
        </Button>
      )}
      <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
        {pending && lastIntent !== "draft"
          ? t(editingId && !isDraft ? "editSubmitting" : "submitting")
          : t(submitKey(editingId, isDraft))}
      </Button>
      <ButtonLink
        variant="inverse"
        href={
          editingId
            ? `/app/organization/requirements/${editingId}`
            : "/app/organization/requirements"
        }
      >
        {tRoot("common.cancel")}
      </ButtonLink>
    </div>
  );
}
