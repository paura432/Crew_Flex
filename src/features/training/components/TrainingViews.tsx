import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { StatusChip } from "@/components/ui/StatusChip";
import { TRAINING_STATUS_LABEL_KEYS } from "@/domain/training";
import type { Locale } from "@/i18n/config";
import { formatMoneyCents } from "@/i18n/format";
import type { TrainingEdition, TrainingRequest } from "@/types/api";
import { formatDay, formatSessionRange, statusTone } from "../view";

export async function TrainingStatus({ status }: { status: string }) {
  const t = await getTranslations("training.status");
  const key =
    TRAINING_STATUS_LABEL_KEYS[status as keyof typeof TRAINING_STATUS_LABEL_KEYS] ?? status;
  return <StatusChip tone={statusTone(status)}>{t(key as never)}</StatusChip>;
}

/** «1250 € por persona» / «a consultar». Informative (OD-7): nothing is charged. */
export async function priceText(
  edition: Pick<TrainingEdition, "priceCents" | "currency" | "priceUnit">,
) {
  const [t, locale] = await Promise.all([
    getTranslations("training"),
    getLocale() as Promise<Locale>,
  ]);
  return edition.priceUnit === "quote" || edition.priceCents === null
    ? t("priceUnit.quote")
    : `${formatMoneyCents(locale, edition.priceCents, edition.currency)} ${t(`priceUnit.${edition.priceUnit}`)}`;
}

/** One edition (convocatoria): mode, dates in its zone, place, seats, price and the provider's own terms. */
export async function EditionSummary({
  edition,
  children,
}: {
  edition: TrainingEdition;
  children?: ReactNode;
}) {
  const [t, tRoot, locale] = await Promise.all([
    getTranslations("training.common"),
    getTranslations("training"),
    getLocale() as Promise<Locale>,
  ]);
  return (
    <div className="space-y-2 rounded-lg border border-line p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip tone="info">{tRoot(`mode.${edition.mode}`)}</StatusChip>
        {edition.provisional && <StatusChip tone="warn">{t("provisional")}</StatusChip>}
        <span className="text-muted">
          {[edition.city, edition.country].filter(Boolean).join(" · ")}
        </span>
      </div>
      {edition.sessions.length > 0 ? (
        <ul className="space-y-1">
          {edition.sessions.map((s) => (
            <li key={s.id} className="tabular-nums">
              {formatSessionRange(locale, s.startsAt, s.endsAt, edition.timeZone)} ·{" "}
              {tRoot(`element.${s.element}`)}
              {s.location && <span className="text-muted"> · {s.location}</span>}
            </li>
          ))}
          <li className="text-muted">{t("zone", { zone: edition.timeZone })}</li>
        </ul>
      ) : edition.deadline ? (
        <p>
          {t("selfPacedUntil", {
            date: formatDay(locale, edition.deadline, edition.timeZone),
          })}
        </p>
      ) : (
        <p className="text-muted">{t("datesPending")}</p>
      )}
      <p className="tabular-nums">
        <span className="font-semibold">{await priceText(edition)}</span> ·{" "}
        {t("seats", { remaining: edition.remaining, capacity: edition.capacity })}
      </p>
      <details>
        <summary className="cursor-pointer font-semibold pointer-coarse:min-h-11">
          {t("terms")}
        </summary>
        <dl className="mt-2 space-y-2">
          <div>
            <dt className="font-semibold">{t("priceIncludes")}</dt>
            <dd className="whitespace-pre-line">{edition.priceIncludes}</dd>
          </div>
          <div>
            <dt className="font-semibold">{t("policy")}</dt>
            <dd className="whitespace-pre-line">{edition.policy}</dd>
          </div>
        </dl>
        <p className="mt-2 text-muted">{t("informative")}</p>
      </details>
      {children}
    </div>
  );
}

/** A request as either party reads it; `actions` are the side's own forms (the server re-checks every move). */
export async function RequestSummary({
  request,
  side,
  actions,
}: {
  request: TrainingRequest;
  side: "professional" | "provider";
  actions?: ReactNode;
}) {
  const [t, tRoot, locale] = await Promise.all([
    getTranslations("training.requests"),
    getTranslations("training"),
    getLocale() as Promise<Locale>,
  ]);
  const offer = request.currentOffer;
  return (
    <article className="space-y-3 rounded-lg border border-line bg-white p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <TrainingStatus status={request.status} />
        <StatusChip>{tRoot(`kind.${request.kind}`)}</StatusChip>
      </div>
      <h3 className="text-base font-semibold">{request.courseTitle}</h3>
      <p className="text-muted">
        {side === "professional"
          ? request.providerName
          : t("applicant", { name: request.applicantName, units: request.units })}
      </p>
      {request.note && <p className="whitespace-pre-line">{request.note}</p>}
      {request.edition && <EditionSummary edition={request.edition} />}
      {offer && (
        <div className="rounded-lg bg-canvas p-3">
          <p className="font-semibold">{t("offer", { version: offer.version })}</p>
          {offer.totalCents !== null && (
            <p className="tabular-nums">
              {t("offerTotal", {
                total: formatMoneyCents(locale, offer.totalCents, offer.currency),
              })}
            </p>
          )}
        </div>
      )}
      {request.reason && <p>{t("reason", { reason: request.reason })}</p>}
      {request.outcome && (
        <p>
          {t("outcome", {
            outcome: tRoot(
              `status.${request.outcome === "no_show" ? "noShow" : request.outcome}` as never,
            ),
          })}
        </p>
      )}
      <details>
        <summary className="cursor-pointer font-semibold pointer-coarse:min-h-11">
          {t("history")}
        </summary>
        <ol className="mt-2 space-y-1 text-muted">
          {request.history.map((e, i) => (
            <li key={i} className="tabular-nums">
              {formatDay(locale, e.at)} · {tRoot(`status.${TRAINING_STATUS_KEY(e.to)}` as never)} ·{" "}
              {t(`actor.${e.actor}`)}
              {e.offerVersion ? ` · v${e.offerVersion}` : ""}
            </li>
          ))}
        </ol>
      </details>
      {actions}
    </article>
  );
}

const TRAINING_STATUS_KEY = (s: string) =>
  TRAINING_STATUS_LABEL_KEYS[s as keyof typeof TRAINING_STATUS_LABEL_KEYS] ?? s;
