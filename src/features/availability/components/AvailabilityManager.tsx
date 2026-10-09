"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { controlClass, describedBy, Field } from "@/components/ui/Field";
import { Metric } from "@/components/ui/Metric";
import { Panel } from "@/components/ui/Panel";
import { StatusChip } from "@/components/ui/StatusChip";
import type { AvailabilityStatus } from "@/domain/availability";
import { formatDateTime } from "@/lib/format";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/errors";
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

const MONTH_FMT = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const PICKER_OPTIONS: { value: Picker; label: string; cls: string }[] = [
  { value: "available", label: "Available", cls: "border-ok/40 bg-ok-bg text-ok" },
  { value: "unavailable", label: "Blocked", cls: "border-line bg-canvas text-ink" },
  { value: "clear", label: "Rest (clear)", cls: "border-line bg-white text-muted" },
];

const DAY_STYLE: Record<DayState, string> = {
  available: "border-ok/40 bg-ok-bg text-ok",
  unavailable: "border-line bg-canvas text-muted",
  mixed: "border-warn/40 bg-warn-bg text-warn",
  none: "border-line bg-white text-muted",
};
const DAY_LABEL: Record<DayState, string> = {
  available: "Available",
  unavailable: "Blocked",
  mixed: "Partial",
  none: "Rest",
};

/** `datetime-local` value ↔ ISO UTC (the UI edits UTC wall-clock, as everywhere in the app). */
const toLocalInput = (iso: string) => iso.slice(0, 16);
const toIso = (local: string) => (local ? `${local}:00Z` : "");

function errorCopy(result: Extract<AvailabilityActionResult, { ok: false }>) {
  switch (result.code) {
    case "UNAUTHORIZED":
      return "Your session expired. Sign in again.";
    case "FORBIDDEN":
      return result.message;
    case "NETWORK_ERROR":
      return "The service could not be reached. Nothing was saved — retry.";
    case "NOT_FOUND":
      return "This window no longer exists. Reload the page.";
    default:
      return result.message;
  }
}

export function AvailabilityManager({
  windows,
  initialMonth,
}: {
  windows: AvailabilityWindow[];
  initialMonth: string;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [picker, setPicker] = useState<Picker>("available");
  const [editing, setEditing] = useState<AvailabilityWindow | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<{
    tone: "ok" | "danger";
    text: string;
    requestId?: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

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
        setNotice({ tone: "ok", text: label });
        setEditing(null);
        setErrors({});
      } else {
        setErrors(result.fieldErrors ?? {});
        setNotice({ tone: "danger", text: errorCopy(result), requestId: result.requestId });
      }
    });
  }

  function onDayClick(date: string) {
    const day = days.find((d) => d.date === date);
    if (!day) return;
    if (day.windows.length > 0 && !day.singleDayWindow) {
      setNotice({
        tone: "danger",
        text: `${date} is covered by a longer window. Edit or delete that window in the list below.`,
      });
      return;
    }
    const existing = day.singleDayWindow;
    if (picker === "clear") {
      if (existing) run(`${date} cleared`, () => deleteWindowAction(existing.id));
      return;
    }
    const input = { ...dayWindow(date), status: picker };
    if (existing) {
      if (existing.status === picker) return;
      run(`${date} set to ${DAY_LABEL[picker].toLowerCase()}`, () =>
        updateWindowAction(existing.id, input),
      );
    } else {
      run(`${date} set to ${DAY_LABEL[picker].toLowerCase()}`, () => createWindowAction(input));
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
    if (editing) run("Window updated", () => updateWindowAction(editing.id, parsed.data));
    else run("Window added", () => createWindowAction(parsed.data));
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
      {notice && (
        <p
          role={notice.tone === "danger" ? "alert" : "status"}
          className={`rounded-lg border px-4 py-3 text-sm ${
            notice.tone === "danger"
              ? "border-danger/30 bg-danger-bg text-danger"
              : "border-ok/30 bg-ok-bg text-ok"
          }`}
        >
          {notice.text}
          {notice.requestId && (
            <span className="mt-1 block font-mono text-xs">Reference: {notice.requestId}</span>
          )}
        </p>
      )}

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric
          label="Available"
          value={availableDays}
          detail="Days published this month"
          tone={availableDays > 0 ? "ok" : "neutral"}
        />
        <Metric label="Blocked" value={blockedDays} detail="Days marked unavailable" />
        <Metric label="Windows" value={windows.length} detail="Saved time windows" />
      </dl>

      <Panel
        title={MONTH_FMT.format(new Date(`${monthStart}T00:00:00Z`))}
        actions={
          <div className="flex gap-2">
            <Button aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
              ←
            </Button>
            <Button aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>
              →
            </Button>
          </div>
        }
      >
        <div className="mb-1 flex flex-wrap gap-2" role="group" aria-label="State to apply">
          {PICKER_OPTIONS.map(({ value, label, cls }) => (
            <button
              key={value}
              type="button"
              aria-pressed={picker === value}
              onClick={() => setPicker(value)}
              className={`min-h-9 rounded-lg border px-3 text-sm font-semibold ${cls} aria-[pressed=true]:ring-2 aria-[pressed=true]:ring-navy`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mb-4 text-sm text-muted">
          Select a state, then click the days to apply it. Days are UTC.
        </p>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold tracking-wide text-muted uppercase">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1">
              {d}
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
                aria-label={`${day.date}: ${DAY_LABEL[day.state]}`}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border text-sm transition-colors hover:ring-2 hover:ring-navy/30 disabled:opacity-60 sm:min-h-20 ${DAY_STYLE[day.state]}`}
              >
                <span className="text-base font-bold tabular-nums">
                  {Number(day.date.slice(-2))}
                </span>
                <span className="hidden text-[11px] leading-none sm:block">
                  {DAY_LABEL[day.state]}
                </span>
              </button>
            ),
          )}
        </div>
      </Panel>

      <Panel title={editing ? "Edit window" : "Add a time window"}>
        <form
          key={editing?.id ?? "new"}
          onSubmit={onSubmit}
          noValidate
          className="grid gap-4 md:grid-cols-[1fr_1fr_auto_auto] md:items-end"
        >
          <Field id="startsAt" label="Starts (UTC)" error={errors.startsAt}>
            <input
              {...input("startsAt")}
              type="datetime-local"
              step={900}
              defaultValue={editing ? toLocalInput(editing.startsAt) : ""}
            />
          </Field>
          <Field id="endsAt" label="Ends (UTC)" error={errors.endsAt}>
            <input
              {...input("endsAt")}
              type="datetime-local"
              step={900}
              defaultValue={editing ? toLocalInput(editing.endsAt) : ""}
            />
          </Field>
          <Field id="status" label="Status" error={errors.status}>
            <select {...input("status")} defaultValue={editing?.status ?? "available"}>
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </Field>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
              {pending ? "Saving…" : editing ? "Save" : "Add"}
            </Button>
            {editing && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setErrors({});
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
        {errors.form && <p className="mt-2 text-sm font-medium text-danger">{errors.form}</p>}
      </Panel>

      <Panel title={`Saved windows (${windows.length})`}>
        {windows.length === 0 ? (
          <p className="text-sm text-muted">
            No availability windows yet. Mark days in the calendar or add a window above — you only
            enter matching when you are available for the whole requirement period.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {windows.map((w) => (
              <li key={w.id} className="grid gap-2 py-3 text-sm sm:flex sm:items-center sm:gap-3">
                <StatusChip tone={w.status === "available" ? "ok" : "neutral"}>
                  {w.status}
                </StatusChip>
                <span className="min-w-0 flex-1 tabular-nums">
                  {formatDateTime(w.startsAt)} <span className="text-muted">→</span>{" "}
                  <span className="whitespace-nowrap">{formatDateTime(w.endsAt)}</span>
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
                    Edit
                  </Button>
                  <Button
                    className="min-h-8 px-3 text-xs text-danger"
                    disabled={pending}
                    onClick={() => run("Window deleted", () => deleteWindowAction(w.id))}
                  >
                    Delete
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
