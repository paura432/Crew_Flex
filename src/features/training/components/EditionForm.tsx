"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { controlClass, Field } from "@/components/ui/Field";
import { callAction, Notice, type NoticeState } from "@/components/ui/Notice";
import {
  centsToDecimal,
  decimalToCents,
  editionIssue,
  TRAINING_CURRENCIES,
  TRAINING_MODES,
  TRAINING_PRICE_UNITS,
  TRAINING_SESSION_ELEMENTS,
  type TrainingSessionElement,
} from "@/domain/training";
import type { TrainingEdition } from "@/types/api";
import { trainingWriteAction } from "../actions";
import { trainingErrorCopy } from "../error-copy";
import { isoToUtcInput, PROVIDER_PATH, utcInputToIso } from "../view";

interface Row {
  startsAt: string;
  endsAt: string;
  location: string;
  element: TrainingSessionElement;
}
const emptyRow: Row = { startsAt: "", endsAt: "", location: "", element: "theory" };

/** Create or edit an edition (convocatoria) of a course: sessions typed in UTC, shown later in the edition's zone. */
export function EditionForm({
  courseId,
  edition,
}: {
  courseId: string;
  edition?: TrainingEdition;
}) {
  const t = useTranslations("training.provider.edition");
  const tRoot = useTranslations();
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(
    edition?.sessions.map((s) => ({
      startsAt: isoToUtcInput(s.startsAt),
      endsAt: isoToUtcInput(s.endsAt),
      location: s.location ?? "",
      element: s.element,
    })) ?? [],
  );
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const s = (name: string) => String(f.get(name) ?? "").trim();
    const priceUnit = s("priceUnit");
    const input = {
      courseId,
      ...(edition ? { id: edition.id, expectedUpdatedAt: edition.updatedAt } : {}),
      mode: s("mode"),
      provisional: f.get("provisional") === "on",
      deadline: utcInputToIso(s("deadline")),
      capacity: Number(s("capacity")),
      city: s("city") || undefined,
      country: s("country") || undefined,
      currency: s("currency"),
      priceUnit,
      priceCents: priceUnit === "quote" ? null : (decimalToCents(s("price")) ?? -1),
      priceIncludes: s("priceIncludes"),
      policy: s("policy"),
      timeZone: s("timeZone"),
      sessions: rows
        .filter((r) => r.startsAt || r.endsAt)
        .map((r) => ({
          startsAt: utcInputToIso(r.startsAt) ?? "",
          endsAt: utcInputToIso(r.endsAt) ?? "",
          location: r.location.trim() || undefined,
          element: r.element,
        })),
    };
    // The same rule the server applies, before sending (the server re-checks).
    const issue = editionIssue(input as Parameters<typeof editionIssue>[0], Date.now());
    if (issue) {
      setNotice({ tone: "danger", text: tRoot(`v.training.${issue}` as never) });
      return;
    }
    setNotice(null);
    startTransition(async () => {
      const result = await callAction(() => trainingWriteAction({ op: "edition", input }));
      if (result.ok) {
        setNotice({ tone: "ok", text: t("saved") });
        router.push(PROVIDER_PATH);
        router.refresh();
      } else {
        setNotice(trainingErrorCopy(tRoot, result));
      }
    });
  }

  const set = (i: number, patch: Partial<Row>) =>
    setRows((all) => all.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const price =
    edition?.priceCents != null ? centsToDecimal(edition.priceCents).replace(/\.00$/, "") : "";

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="ed-mode" label={t("mode")}>
          <select
            id="ed-mode"
            name="mode"
            defaultValue={edition?.mode ?? "onsite"}
            className={controlClass}
          >
            {TRAINING_MODES.map((m) => (
              <option key={m} value={m}>
                {tRoot(`training.mode.${m}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="ed-tz" label={t("timeZone")} hint={t("timeZoneHint")}>
          <input
            id="ed-tz"
            name="timeZone"
            defaultValue={edition?.timeZone ?? "Europe/Madrid"}
            className={controlClass}
          />
        </Field>
        <Field id="ed-capacity" label={t("capacity")}>
          <input
            id="ed-capacity"
            name="capacity"
            type="number"
            min={1}
            max={500}
            defaultValue={edition?.capacity ?? 8}
            className={controlClass}
          />
        </Field>
        <Field id="ed-deadline" label={t("deadline")} hint={t("deadlineHint")}>
          <input
            id="ed-deadline"
            name="deadline"
            type="datetime-local"
            defaultValue={isoToUtcInput(edition?.deadline ?? null)}
            className={controlClass}
          />
        </Field>
        <Field id="ed-city" label={t("city")}>
          <input
            id="ed-city"
            name="city"
            defaultValue={edition?.city ?? ""}
            className={controlClass}
          />
        </Field>
        <Field id="ed-country" label={t("country")}>
          <input
            id="ed-country"
            name="country"
            defaultValue={edition?.country ?? ""}
            className={controlClass}
          />
        </Field>
        <Field id="ed-unit" label={t("priceUnit")}>
          <select
            id="ed-unit"
            name="priceUnit"
            defaultValue={edition?.priceUnit ?? "person"}
            className={controlClass}
          >
            {TRAINING_PRICE_UNITS.map((u) => (
              <option key={u} value={u}>
                {tRoot(`training.priceUnit.${u}`)}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Field id="ed-price" label={t("price")} hint={t("priceHint")}>
            <input
              id="ed-price"
              name="price"
              inputMode="decimal"
              defaultValue={price}
              className={controlClass}
            />
          </Field>
          <Field id="ed-currency" label={t("currency")}>
            <select
              id="ed-currency"
              name="currency"
              defaultValue={edition?.currency ?? "EUR"}
              className={controlClass}
            >
              {TRAINING_CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm pointer-coarse:min-h-11">
        <input
          type="checkbox"
          name="provisional"
          defaultChecked={edition?.provisional ?? false}
          className="size-4"
        />
        {t("provisional")}
      </label>
      <Field id="ed-includes" label={t("priceIncludes")} hint={t("informative")}>
        <textarea
          id="ed-includes"
          name="priceIncludes"
          rows={2}
          defaultValue={edition?.priceIncludes ?? ""}
          className={controlClass}
        />
      </Field>
      <Field id="ed-policy" label={t("policy")} hint={t("informative")}>
        <textarea
          id="ed-policy"
          name="policy"
          rows={3}
          defaultValue={edition?.policy ?? ""}
          className={controlClass}
        />
      </Field>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">{t("sessions")}</legend>
        <p className="text-sm text-muted">{t("sessionsHint")}</p>
        {rows.map((r, i) => (
          <div
            key={i}
            className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-[1fr_1fr_1fr_auto_auto] sm:items-end"
          >
            <Field id={`s-${i}-start`} label={t("startsAt")}>
              <input
                id={`s-${i}-start`}
                type="datetime-local"
                value={r.startsAt}
                onChange={(e) => set(i, { startsAt: e.target.value })}
                className={controlClass}
              />
            </Field>
            <Field id={`s-${i}-end`} label={t("endsAt")}>
              <input
                id={`s-${i}-end`}
                type="datetime-local"
                value={r.endsAt}
                onChange={(e) => set(i, { endsAt: e.target.value })}
                className={controlClass}
              />
            </Field>
            <Field id={`s-${i}-loc`} label={t("location")}>
              <input
                id={`s-${i}-loc`}
                value={r.location}
                onChange={(e) => set(i, { location: e.target.value })}
                className={controlClass}
              />
            </Field>
            <Field id={`s-${i}-el`} label={t("element")}>
              <select
                id={`s-${i}-el`}
                value={r.element}
                onChange={(e) => set(i, { element: e.target.value as TrainingSessionElement })}
                className={controlClass}
              >
                {TRAINING_SESSION_ELEMENTS.map((el) => (
                  <option key={el} value={el}>
                    {tRoot(`training.element.${el}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Button variant="ghost" onClick={() => setRows((all) => all.filter((_, j) => j !== i))}>
              {t("removeSession")}
            </Button>
          </div>
        ))}
        <Button onClick={() => setRows((all) => [...all, emptyRow])}>{t("addSession")}</Button>
      </fieldset>

      <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
        {t("save")}
      </Button>
      <Notice
        notice={notice}
        referenceLabel={tRoot("common.reference", { id: notice?.requestId ?? "" })}
      />
    </form>
  );
}
