"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { controlClass, describedBy, Field } from "@/components/ui/Field";
import { Metric } from "@/components/ui/Metric";
import { actionErrorCopy, Notice, type NoticeState } from "@/components/ui/Notice";
import { Panel } from "@/components/ui/Panel";
import { StatusChip } from "@/components/ui/StatusChip";
import type { AvailabilityStatus } from "@/domain/availability";
import { formatDateTime, formatMonth } from "@/i18n/format";
import { resolveFieldErrors } from "@/i18n/validation";
import { useIdempotencyKey } from "@/lib/idempotency";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/errors";
import { toLocalInput, toUtcIso as toIso } from "@/lib/format";
import { createAvailabilityWindowInput } from "@/lib/validation/availability";
import type { AvailabilityWindow } from "@/types/api";
import {
  createWindowAction,
  deleteWindowAction,
  updateWindowAction,
  type AvailabilityActionResult,
} from "../actions";
import {
  calendarDays,
  countDays,
  dayWindow,
  monthOffset,
  shiftMonth,
  type DayState,
} from "../calendar";

type Picker = AvailabilityStatus | "clear";

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

const PICKER_OPTIONS: { value: Picker; cls: string }[] = [
  { value: "available", cls: "border-ok/40 bg-ok-bg text-ok" },
  { value: "unavailable", cls: "border-line bg-canvas text-ink" },
  { value: "clear", cls: "border-line bg-white text-muted" },
];

const DAY_STYLE: Record<DayState, string> = {
  available: "border-ok/40 bg-ok-bg text-ok",
  unavailable: "border-line bg-canvas text-muted",
  mixed: "border-warn/40 bg-warn-bg text-warn",
  none: "border-line bg-white text-muted",
};

export function AvailabilityManager({
  windows,
  initialMonth,
}: {
  windows: AvailabilityWindow[];
  initialMonth: string;
}) {
  const t = useTranslations("availability");
  const tRoot = useTranslations();
  const locale = useLocale();
  const [month, setMonth] = useState(initialMonth);
  const [picker, setPicker] = useState<Picker>("available");
  const [editing, setEditing] = useState<AvailabilityWindow | null>(null);
  const [rawErrors, setErrors] = useState<FieldErrors>({});
  const errors = resolveFieldErrors(tRoot, rawErrors);
  const dayLabel = (state: DayState) => t(`day.${state}`);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [pending, startTransition] = useTransition();
  const idempotency = useIdempotencyKey();

  const days = calendarDays(windows, month);
  const cells = [
    ...Array.from({ length: monthOffset(month) }, (_, i) => ({ key: `pad-${i}`, day: null })),
    ...days.map((day) => ({ key: day.date, day })),
  ];
  const monthStart = `${month}-01`;
  const monthEnd = `${shiftMonth(month, 1)}-01`;
  const availableDays = countDays(windows, "available", monthStart, monthEnd);
  const blockedDays = countDays(windows, "unavailable", monthStart, monthEnd);

  function run(label: string, task: () => Promise<AvailabilityActionResult>) {
    setNotice(null);
    startTransition(async () => {
      const result = await task();
      if (result.ok) {
        idempotency.release();
        setNotice({ tone: "ok", text: label });
        setEditing(null);
        setErrors({});
      } else {
        setErrors(result.fieldErrors ?? {});
        setNotice(actionErrorCopy(tRoot, result));
      }
    });
  }

  function onDayClick(date: string) {
    const day = days.find((d) => d.date === date);
    if (!day) return;
    if (day.windows.length > 0 && !day.singleDayWindow) {
      setNotice({ tone: "danger", text: t("coveredByLonger", { date }) });
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

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
          label={t("metrics.windows")}
          value={windows.length}
          detail={t("metrics.windowsDetail")}
        />
      </dl>

      <Panel
        title={formatMonth(locale, `${monthStart}T00:00:00Z`)}
        actions={
          <div className="flex gap-2">
            <Button aria-label={t("prevMonth")} onClick={() => setMonth(shiftMonth(month, -1))}>
              ←
            </Button>
            <Button aria-label={t("nextMonth")} onClick={() => setMonth(shiftMonth(month, 1))}>
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
              className={`min-h-9 rounded-lg border px-3 text-sm font-semibold ${cls} aria-[pressed=true]:ring-2 aria-[pressed=true]:ring-navy`}
            >
              {t(`picker.${value}`)}
            </button>
          ))}
        </div>
        <p className="mb-4 text-sm text-muted">{t("pickerHint")}</p>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold tracking-wide text-muted uppercase">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1">
              {t(`weekday.${d}`)}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1" aria-busy={pending}>
          {cells.map(({ key, day }) =>
            day === null ? (
              <div key={key} aria-hidden />
            ) : (
              <button
                key={key}
                type="button"
                disabled={pending}
                onClick={() => onDayClick(day.date)}
                aria-label={`${day.date}: ${dayLabel(day.state)}`}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border text-sm transition-colors hover:ring-2 hover:ring-navy/30 disabled:opacity-60 sm:min-h-20 ${DAY_STYLE[day.state]}`}
              >
                <span className="text-base font-bold tabular-nums">
                  {Number(day.date.slice(-2))}
                </span>
                <span className="hidden text-[11px] leading-none sm:block">
                  {dayLabel(day.state)}
                </span>
              </button>
            ),
          )}
        </div>
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
                <StatusChip tone={w.status === "available" ? "ok" : "neutral"}>
                  {t(w.status === "available" ? "statusAvailable" : "statusUnavailable")}
                </StatusChip>
                <span className="min-w-0 flex-1 tabular-nums">
                  {formatDateTime(locale, w.startsAt)} <span className="text-muted">→</span>{" "}
                  <span className="whitespace-nowrap">{formatDateTime(locale, w.endsAt)}</span>
                </span>
                <div className="flex gap-2">
                  <Button
                    className="min-h-8 px-3 text-xs"
                    onClick={() => {
                      setEditing(w);
                      setErrors({});
                      setNotice(null);
                    }}
                    disabled={pending}
                  >
                    {tRoot("common.edit")}
                  </Button>
                  <Button
                    className="min-h-8 px-3 text-xs text-danger"
                    disabled={pending}
                    onClick={() => run(t("windowDeleted"), () => deleteWindowAction(w.id))}
                  >
                    {tRoot("common.delete")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
