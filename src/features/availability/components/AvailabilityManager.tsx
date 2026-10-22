"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { controlClass, describedBy, Field } from "@/components/ui/Field";
import { Metric } from "@/components/ui/Metric";
import { actionErrorCopy, callAction, Notice, type NoticeState } from "@/components/ui/Notice";
import { Panel } from "@/components/ui/Panel";
import { StatusChip } from "@/components/ui/StatusChip";
import type { AvailabilityStatus } from "@/domain/availability";
import { formatDateTime, formatMonth } from "@/i18n/format";
import { resolveFieldErrors } from "@/i18n/validation";
import { useIdempotencyKey } from "@/lib/idempotency";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/errors";
import { toLocalInput, toUtcIso as toIso } from "@/lib/format";
import { createAvailabilityWindowInput } from "@/lib/validation/availability";
import type { AvailabilityRotation, AvailabilityWindow } from "@/types/api";
import {
  createWindowAction,
  deleteWindowAction,
  replaceDaysAction,
  updateWindowAction,
  type AvailabilityActionResult,
} from "../actions";
import {
  calendarDays,
  countDays,
  DAY_STYLE,
  dayWindow,
  isDayEditable,
  monthOffset,
  shiftMonth,
  WEEKDAYS,
  type DayState,
} from "../calendar";
import { planChanges, planCycle, RotationError, type PlannedDay } from "../rotation";
import { CyclePlanner, type CycleSettings } from "./CyclePlanner";

type Picker = AvailabilityStatus | "clear";

const PICKER_OPTIONS: { value: Picker; cls: string }[] = [
  { value: "available", cls: "border-ok/40 bg-ok-bg text-ok" },
  { value: "unavailable", cls: "border-line bg-canvas text-ink" },
  { value: "aog_only", cls: DAY_STYLE.aog_only },
  { value: "clear", cls: "border-line bg-white text-muted" },
];

const STATUS_CHIP = {
  available: { tone: "ok", label: "statusAvailable" },
  unavailable: { tone: "neutral", label: "statusUnavailable" },
  aog_only: { tone: "warn", label: "statusAogOnly" },
} as const satisfies Record<AvailabilityStatus, { tone: string; label: string }>;

const PLANNED_STATE = (status: PlannedDay["status"]): DayState => status ?? "none";

export function AvailabilityManager({
  windows,
  initialMonth,
  today,
  rotation,
  version,
}: {
  windows: AvailabilityWindow[];
  /** Saved generator pattern (private), or null. */
  rotation: AvailabilityRotation | null;
  /** Calendar version from the last server render; a save from a stale one is refused (W5-03). */
  version?: string;
  initialMonth: string;
  /** `YYYY-MM-DD` (UTC), from the server render. */
  today: string;
}) {
  const t = useTranslations("availability");
  const tRoot = useTranslations();
  const locale = useLocale();
  const [month, setMonthState] = useState(initialMonth);
  /** Month survives reload and back/forward (`?month=`), as the overview calendar does. */
  const setMonth = (m: string) => {
    setMonthState(m);
    window.history.replaceState(null, "", `?month=${m}`);
  };
  const [picker, setPicker] = useState<Picker>("available");
  const [editing, setEditing] = useState<AvailabilityWindow | null>(null);
  const [rawErrors, setErrors] = useState<FieldErrors>({});
  const errors = resolveFieldErrors(tRoot, rawErrors);
  const dayLabel = (state: DayState) => t(`day.${state}`);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  // Unsaved days (generated cycle and/or painted by hand); saved together in one transaction.
  const [plan, setPlan] = useState<Record<string, PlannedDay>>({});
  const [cycleError, setCycleError] = useState<string | null>(null);
  // Undo steps of the draft (V1.8 demo planner); cleared on save and discard.
  const [history, setHistory] = useState<Record<string, PlannedDay>[]>([]);
  // The pattern of the last preview; saved with the days so it is offered again next time.
  const [generatedWith, setGeneratedWith] = useState<AvailabilityRotation | null>(null);
  const planned = Object.keys(plan).length;
  const [pending, startTransition] = useTransition();
  const idempotency = useIdempotencyKey();

  const days = calendarDays(windows, month);
  // Draft days that saving would cut out of a longer or partial-hour window.
  const splitDays = days.filter(
    (d) => d.date in plan && d.windows.length > 0 && !d.singleDayWindow,
  ).length;
  const cells = [
    ...Array.from({ length: monthOffset(month) }, (_, i) => ({ key: `pad-${i}`, day: null })),
    ...days.map((day) => ({ key: day.date, day })),
  ];
  const monthStart = `${month}-01`;
  const monthEnd = `${shiftMonth(month, 1)}-01`;
  const availableDays = countDays(windows, "available", monthStart, monthEnd);
  const blockedDays = countDays(windows, "unavailable", monthStart, monthEnd);
  const aogDays = countDays(windows, "aog_only", monthStart, monthEnd);

  function run(
    label: string,
    task: () => Promise<AvailabilityActionResult>,
    onOk?: () => void,
    conflict?: string,
  ) {
    setNotice(null);
    startTransition(async () => {
      const result = await callAction(task);
      if (result.ok) {
        idempotency.release();
        onOk?.();
        setNotice({ tone: "ok", text: label });
        setEditing(null);
        setErrors({});
      } else {
        setErrors(result.fieldErrors ?? {});
        setNotice(
          conflict && result.code === "CONFLICT"
            ? { tone: "danger", text: conflict, requestId: result.requestId }
            : actionErrorCopy(tRoot, result),
        );
      }
    });
  }

  // Setting days is idempotent by nature (applying the same set twice gives the same windows), so
  // each save gets a fresh key: re-using a key per payload could replay an old "set" that a later
  // save has since overwritten and report it as applied (review finding MEDIUM-2, 2026-10-19).
  function replaceDays(
    label: string,
    changes: { date: string; status: PlannedDay["status"] }[],
    savedRotation?: AvailabilityRotation,
  ) {
    run(
      label,
      () =>
        replaceDaysAction(
          {
            days: changes,
            ...(savedRotation ? { rotation: savedRotation } : {}),
            ...(version ? { expectedVersion: version } : {}),
          },
          crypto.randomUUID(),
        ),
      clearDraft,
      // The draft is kept (clearDraft runs on success only) so it can be re-applied after a reload.
      t("cycle.conflict"),
    );
  }

  function clearDraft() {
    setPlan({});
    setHistory([]);
    setGeneratedWith(null);
    setCycleError(null);
  }

  /** Every draft change goes through here so it can be undone. */
  function changePlan(next: (old: Record<string, PlannedDay>) => Record<string, PlannedDay>) {
    setHistory((h) => [...h, plan]);
    setPlan(next);
  }

  function undo() {
    const previous = history.at(-1);
    if (previous === undefined) return;
    setHistory((h) => h.slice(0, -1));
    setPlan(previous);
  }

  function onPreview(settings: CycleSettings) {
    try {
      const generated = planCycle(days, settings.pattern, { ...settings, today });
      changePlan((old) => ({ ...old, ...generated }));
      setGeneratedWith({
        pattern: settings.pattern,
        anchor: settings.anchor,
        customCycle: settings.pattern === "custom" ? settings.custom : [],
      });
      setCycleError(null);
      setNotice(null);
    } catch (error) {
      if (!(error instanceof RotationError)) throw error;
      setCycleError(t(`cycle.error.${error.code}`));
    }
  }

  function onSavePlan() {
    const changes = planChanges(days, plan);
    if (changes.length === 0 && !generatedWith) {
      clearDraft();
      setNotice({ tone: "ok", text: t("cycle.nothingToSave") });
      return;
    }
    const label =
      changes.length === 0 ? t("cycle.patternSaved") : t("cycle.saved", { count: changes.length });
    replaceDays(label, changes, generatedWith ?? undefined);
  }

  function onDayClick(date: string) {
    const day = days.find((d) => d.date === date);
    if (!day || !isDayEditable(date, today)) return;
    const status = picker === "clear" ? null : picker;
    if (planned > 0) {
      changePlan((old) => ({ ...old, [date]: { status } }));
      return;
    }
    if (day.windows.length > 0 && !day.singleDayWindow) {
      // Never split silently (BR-4.6): the day goes to the draft, the warning below names what saving
      // will cut, and nothing changes until the professional saves.
      changePlan(() => ({ [date]: { status } }));
      setNotice(null);
      return;
    }
    const existing = day.singleDayWindow;
    if (picker === "clear") {
      if (existing) run(t("dayCleared", { date }), () => deleteWindowAction(existing.id));
      return;
    }
    const input = { ...dayWindow(date), status: picker };
    if (existing) {
      if (existing.status === picker) return;
      run(t("daySet", { date, state: dayLabel(picker).toLowerCase() }), () =>
        updateWindowAction(existing.id, input),
      );
    } else {
      run(t("daySet", { date, state: dayLabel(picker).toLowerCase() }), () =>
        createWindowAction(input, idempotency.keyFor(input)),
      );
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      startsAt: toIso(String(form.get("startsAt") ?? "")),
      endsAt: toIso(String(form.get("endsAt") ?? "")),
      status: String(form.get("status") ?? ""),
    };
    const parsed = createAvailabilityWindowInput.safeParse(payload);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    if (editing) run(t("windowUpdated"), () => updateWindowAction(editing.id, parsed.data));
    else
      run(t("windowAdded"), () => createWindowAction(parsed.data, idempotency.keyFor(parsed.data)));
  }

  const input = (id: string) => ({
    id,
    name: id,
    className: controlClass,
    "aria-invalid": Boolean(errors[id]),
    "aria-describedby": describedBy(id, errors[id]),
    disabled: pending,
  });

  return (
    <div className="space-y-6">
      <Notice
        notice={notice}
        referenceLabel={tRoot("common.reference", { id: notice?.requestId ?? "" })}
      />

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label={t("metrics.available")}
          value={availableDays}
          detail={t("metrics.availableDetail")}
          tone={availableDays > 0 ? "ok" : "neutral"}
        />
        <Metric
          label={t("metrics.blocked")}
          value={blockedDays}
          detail={t("metrics.blockedDetail")}
        />
        <Metric
          label={t("metrics.aogOnly")}
          value={aogDays}
          detail={t("metrics.aogOnlyDetail")}
          tone={aogDays > 0 ? "warn" : "neutral"}
        />
        <Metric
          label={t("metrics.windows")}
          value={windows.length}
          detail={t("metrics.windowsDetail")}
        />
      </dl>

      <CyclePlanner
        today={today}
        saved={rotation}
        disabled={pending}
        error={cycleError}
        onPreview={onPreview}
      />

      <Panel
        title={formatMonth(locale, `${monthStart}T00:00:00Z`)}
        actions={
          <div className="flex gap-2">
            <Button
              aria-label={t("prevMonth")}
              disabled={planned > 0}
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              ←
            </Button>
            <Button
              aria-label={t("nextMonth")}
              disabled={planned > 0}
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              →
            </Button>
          </div>
        }
      >
        <div className="mb-1 flex flex-wrap gap-2" role="group" aria-label={t("pickerLabel")}>
          {PICKER_OPTIONS.map(({ value, cls }) => (
            <button
              key={value}
              type="button"
              aria-pressed={picker === value}
              onClick={() => setPicker(value)}
              className={`min-h-9 pointer-coarse:min-h-11 rounded-lg border px-3 text-sm font-semibold ${cls} aria-[pressed=true]:ring-2 aria-[pressed=true]:ring-navy`}
            >
              {t(`picker.${value}`)}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted">{t("pickerHint")}</p>
        <p className="mb-4 text-sm text-muted">{t("aogHint")}</p>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold tracking-wide text-muted uppercase">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1">
              {t(`weekday.${d}`)}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1" aria-busy={pending}>
          {cells.map(({ key, day }) => {
            if (day === null) return <div key={key} aria-hidden />;
            const draft = plan[day.date];
            const state = draft ? PLANNED_STATE(draft.status) : day.state;
            const label = draft?.cycle
              ? `${dayLabel(state)} · ${t(`cycle.state.${draft.cycle}`)}`
              : dayLabel(state);
            return (
              <button
                key={key}
                type="button"
                disabled={pending || !isDayEditable(day.date, today)}
                onClick={() => onDayClick(day.date)}
                aria-label={`${day.date}: ${label}${draft ? `, ${t("cycle.unsaved")}` : ""}`}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border text-sm transition-colors enabled:hover:ring-2 enabled:hover:ring-navy/30 disabled:opacity-60 sm:min-h-20 ${DAY_STYLE[state]} ${draft ? "outline-2 -outline-offset-4 outline-accent outline-dashed" : ""}`}
              >
                <span className="text-base font-bold tabular-nums">
                  {Number(day.date.slice(-2))}
                </span>
                <span className="hidden text-[11px] leading-none sm:block">{dayLabel(state)}</span>
              </button>
            );
          })}
        </div>

        {planned > 0 && (
          <div className="mt-4 space-y-3 rounded-lg border border-warn/40 bg-warn-bg p-3 text-sm text-warn">
            <p role="status">{t("cycle.pending", { count: planned })}</p>
            {splitDays > 0 && <p>{t("cycle.splitWarning", { count: splitDays })}</p>}
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" disabled={pending} aria-busy={pending} onClick={onSavePlan}>
                {pending ? tRoot("common.saving") : t("cycle.save")}
              </Button>
              <Button disabled={pending || history.length === 0} onClick={undo}>
                {t("cycle.undo")}
              </Button>
              <Button disabled={pending} onClick={clearDraft}>
                {t("cycle.discard")}
              </Button>
            </div>
          </div>
        )}
      </Panel>

      <Panel title={editing ? t("editWindow") : t("addWindow")}>
        <form
          key={editing?.id ?? "new"}
          onSubmit={onSubmit}
          noValidate
          className="grid gap-4 md:grid-cols-[1fr_1fr_auto_auto] md:items-end"
        >
          <Field id="startsAt" label={t("starts")} error={errors.startsAt}>
            <input
              {...input("startsAt")}
              type="datetime-local"
              step={900}
              defaultValue={editing ? toLocalInput(editing.startsAt) : ""}
            />
          </Field>
          <Field id="endsAt" label={t("ends")} error={errors.endsAt}>
            <input
              {...input("endsAt")}
              type="datetime-local"
              step={900}
              defaultValue={editing ? toLocalInput(editing.endsAt) : ""}
            />
          </Field>
          <Field id="status" label={t("status")} error={errors.status}>
            <select {...input("status")} defaultValue={editing?.status ?? "available"}>
              <option value="available">{t("statusAvailable")}</option>
              <option value="unavailable">{t("statusUnavailable")}</option>
              <option value="aog_only">{t("statusAogOnly")}</option>
            </select>
          </Field>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
              {pending
                ? tRoot("common.saving")
                : editing
                  ? tRoot("common.save")
                  : tRoot("common.add")}
            </Button>
            {editing && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setErrors({});
                }}
              >
                {tRoot("common.cancel")}
              </Button>
            )}
          </div>
        </form>
        {errors.form && <p className="mt-2 text-sm font-medium text-danger">{errors.form}</p>}
      </Panel>

      <Panel title={t("savedWindows", { count: windows.length })}>
        {windows.length === 0 ? (
          <p className="text-sm text-muted">{t("emptyHint")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {windows.map((w) => (
              <li key={w.id} className="grid gap-2 py-3 text-sm sm:flex sm:items-center sm:gap-3">
                <StatusChip tone={STATUS_CHIP[w.status].tone}>
                  {t(STATUS_CHIP[w.status].label)}
                </StatusChip>
                <span className="min-w-0 flex-1 tabular-nums">
                  {formatDateTime(locale, w.startsAt)} <span className="text-muted">→</span>{" "}
                  <span className="whitespace-nowrap">{formatDateTime(locale, w.endsAt)}</span>
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditing(w);
                      setErrors({});
                      setNotice(null);
                    }}
                    disabled={pending}
                  >
                    {tRoot("common.edit")}
                  </Button>
                  <ConfirmButton
                    size="sm"
                    disabled={pending}
                    label={tRoot("common.delete")}
                    confirmLabel={t("confirmDelete")}
                    cancelLabel={tRoot("common.cancel")}
                    onConfirm={() => run(t("windowDeleted"), () => deleteWindowAction(w.id))}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
