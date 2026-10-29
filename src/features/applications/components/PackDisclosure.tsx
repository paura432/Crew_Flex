import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { getApplicationPack } from "../api";
import { withPackParam } from "../view";
import { CandidatePackView } from "./CandidatePackView";

/**
 * «Ver expediente» under one application (v2-15, v1.8 `Workflow.jsx` «Ver expediente»). A link, not a modal:
 * `?pack=<application id>` opens it in place (one at a time, server-rendered, read only when opened) and
 * «Cerrar expediente» goes back to the card. The copy comes from `get_application_pack`, which only the
 * application's two parties may read.
 */
export async function PackDisclosure({
  applicationId,
  open,
  baseHref,
  intro,
}: {
  applicationId: string;
  open: boolean;
  /** The page URL with its other search params (filters, page); `pack` is set or removed here. */
  baseHref: string;
  intro: string;
}) {
  const [t, tRoot] = await Promise.all([getTranslations("candidatePack"), getTranslations()]);
  const panelId = `pack-${applicationId}`;
  const toggle = open
    ? `${withPackParam(baseHref, null)}#a-${applicationId}`
    : `${withPackParam(baseHref, applicationId)}#${panelId}`;
  const result = open ? await getApplicationPack(applicationId) : null;

  return (
    <div className="text-sm">
      <Link
        href={toggle}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="inline-flex items-center font-semibold text-blue hover:underline pointer-coarse:min-h-11"
      >
        {open ? t("hide") : t("view")}
      </Link>
      {open && result && (
        <section
          id={panelId}
          aria-labelledby={`${panelId}-title`}
          className="mt-2 scroll-mt-4 rounded-lg border border-line bg-canvas px-4 py-3"
        >
          <h3 id={`${panelId}-title`} className="mb-2 text-base font-semibold tracking-tight">
            {t("heading")}
          </h3>
          {!result.ok ? (
            <p className="text-danger">
              {t("error")}{" "}
              <span className="font-mono text-xs">
                {tRoot("common.reference", { id: result.requestId })}
              </span>
            </p>
          ) : result.data.pack === null ? (
            <p className="text-muted">{t("none")}</p>
          ) : (
            <CandidatePackView pack={result.data.pack} mode="copy" intro={intro} />
          )}
        </section>
      )}
    </div>
  );
}
