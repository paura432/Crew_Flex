import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { controlClass, Field } from "@/components/ui/Field";
import { availableTrainingTransitions, TRAINING_OUTCOMES } from "@/domain/training";
import type { TrainingRequest } from "@/types/api";
import { REQUESTS_PATH } from "../view";
import { TrainingForm } from "./TrainingForm";

/**
 * The moves one side may make on a request (`availableTrainingTransitions`, mirror of the SQL table): accept the CURRENT
 * offer with an explicit tick, withdraw, cancel with a reason (professional); waitlist, send terms, reject, confirm,
 * cancel, record the result (provider). The server decides the actor and re-checks capacity, overlaps and versions.
 */
export async function RequestActions({
  request,
  side,
}: {
  request: TrainingRequest;
  side: "professional" | "provider";
}) {
  const [t, tRoot] = await Promise.all([
    getTranslations("training.requests"),
    getTranslations("training"),
  ]);
  const moves = availableTrainingTransitions(request.status, side, request.kind).map((m) => m.to);
  const base = { requestId: request.id, expectedUpdatedAt: request.updatedAt };
  const id = (s: string) => `${request.id}-${s}`;
  const quote = request.edition?.priceUnit === "quote";

  return (
    <div className="space-y-3 border-t border-line pt-3">
      {moves.includes("accepted") && request.currentOffer && (
        <TrainingForm
          op="transition"
          fixed={{ ...base, to: "accepted", offerId: request.currentOffer.id }}
          booleans={["acceptTerms"]}
          submitLabel={t("accept")}
          successText={t("done")}
          variant="primary"
        >
          <label className="flex items-start gap-2 text-sm pointer-coarse:min-h-11 pointer-coarse:items-center">
            <input type="checkbox" name="acceptTerms" className="mt-0.5 size-4" />
            {t("acceptTerms", { version: request.currentOffer.version })}
          </label>
        </TrainingForm>
      )}
      {moves.includes("offered") && (
        <TrainingForm
          op="transition"
          fixed={{ ...base, to: "offered" }}
          cents={["quoteTotalCents"]}
          submitLabel={t("sendOffer")}
          successText={t("done")}
          variant="primary"
        >
          {quote && (
            <Field id={id("quote")} label={t("quoteTotal")}>
              <input
                id={id("quote")}
                name="quoteTotalCents"
                inputMode="decimal"
                className={controlClass}
              />
            </Field>
          )}
        </TrainingForm>
      )}
      <div className="flex flex-wrap gap-2">
        {(["confirmed", "waitlisted", "withdrawn", "closed"] as const)
          .filter((to) => moves.includes(to))
          .map((to) => (
            <TrainingForm
              key={to}
              op="transition"
              fixed={{ ...base, to }}
              submitLabel={t(`to.${to}`)}
              successText={t("done")}
              className="inline"
              variant={to === "confirmed" ? "primary" : "secondary"}
            />
          ))}
      </div>
      {(["rejected", "cancelled"] as const)
        .filter((to) => moves.includes(to))
        .map((to) => (
          <TrainingForm
            key={to}
            op="transition"
            fixed={{ ...base, to }}
            submitLabel={t(`to.${to}`)}
            successText={t("done")}
            variant="danger"
          >
            <Field id={id(to)} label={t("reasonLabel")}>
              <textarea id={id(to)} name="reason" rows={2} className={controlClass} />
            </Field>
          </TrainingForm>
        ))}
      {moves.includes("finished") && (
        <TrainingForm
          op="transition"
          fixed={{ ...base, to: "finished" }}
          submitLabel={t("to.finished")}
          successText={t("done")}
        >
          <Field id={id("outcome")} label={t("outcomeLabel")}>
            <select id={id("outcome")} name="outcome" className={controlClass}>
              {TRAINING_OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {tRoot(`status.${o === "no_show" ? "noShow" : o}`)}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-sm text-muted">{t("noCertification")}</p>
        </TrainingForm>
      )}
      <Link
        href={`${REQUESTS_PATH}/${request.id}`}
        className="inline-flex font-semibold text-blue hover:underline pointer-coarse:min-h-11 pointer-coarse:items-center"
      >
        {t("conversation")}
      </Link>
    </div>
  );
}
