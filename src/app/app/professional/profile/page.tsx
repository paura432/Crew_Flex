import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { StatusChip } from "@/components/ui/StatusChip";
import { EU_COUNTRIES, type EuCountry } from "@/domain/passport";
import { countOwnDocuments, listOwnDocumentExpiries } from "@/features/documents/api";
import {
  getOwnProfessionalOverview,
  getProfessionalProfile,
  type ProfessionalOverview,
} from "@/features/professional/api";
import { completenessOf } from "@/features/professional/completeness";
import {
  EmptyDraftButton,
  PassportDraftProvider,
} from "@/features/professional/components/PassportDraft";
import { PassportVisual } from "@/features/professional/components/PassportVisual";
import { ProfileForm } from "@/features/professional/components/ProfileForm";
import { medalInputOf } from "@/features/professional/medals";
import { upcomingReviews } from "@/features/professional/reviews";
import { LearningAchievements } from "@/features/tools/components/LearningAchievements";
import { isDocumentWalletEnabled } from "@/server/feature-flags";
import { requireSessionActor } from "@/server/session";

/** Country names in the active locale, on the server so the client form renders the same text. */
function countryNames(locale: string): Record<EuCountry, string> {
  const names = new Intl.DisplayNames([locale], { type: "region" });
  return Object.fromEntries(EU_COUNTRIES.map((c) => [c, names.of(c) ?? c])) as Record<
    EuCountry,
    string
  >;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("passport") };
}

/**
 * The own overview for the badge and the visual passport; a failed read leaves both out (the form,
 * read through its own function, still works).
 */
async function ownOverview(actorId: string): Promise<ProfessionalOverview | null> {
  try {
    return await getOwnProfessionalOverview(actorId);
  } catch (error) {
    unstable_rethrow(error); // Next.js control flow (dynamic APIs, redirects) is not a read failure
    return null;
  }
}

/**
 * The own wallet, only while it is on: the document count (v1.8 «evidencias», BR-11 «Documento
 * aportado») and the dated documents of the 60-day review list. A failed read leaves each out (`null`).
 */
async function ownWallet(): Promise<{
  enabled: boolean;
  count: number | null;
  expiries: Awaited<ReturnType<typeof listOwnDocumentExpiries>>;
}> {
  try {
    if (!(await isDocumentWalletEnabled())) return { enabled: false, count: null, expiries: null };
    const [count, expiries] = await Promise.all([countOwnDocuments(), listOwnDocumentExpiries()]);
    return { enabled: true, count, expiries };
  } catch (error) {
    unstable_rethrow(error);
    return { enabled: false, count: null, expiries: null };
  }
}

export default async function ProfessionalProfilePage() {
  const [actor, t, locale] = await Promise.all([
    requireSessionActor(),
    getTranslations("professional"),
    getLocale(),
  ]);
  if (actor.profile.account_type !== "professional") {
    return (
      <StateMessage title={t("noProfileTitle")} description={t("passport.noProfileDescription")} />
    );
  }
  const [result, overview, wallet, tPassport] = await Promise.all([
    getProfessionalProfile(),
    ownOverview(actor.id),
    ownWallet(),
    getTranslations("passport"),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  // N-25, v1.8 «{%} completado · {n} evidencias»: the BR-11 percentage (same as the overview) and the
  // own wallet documents. Without the wallet (or its count) only the percentage; no overview, no badge.
  const badge = overview
    ? (() => {
        const { percent } = completenessOf(
          actor.profile.display_name,
          overview,
          wallet.count,
          new Date(),
        );
        return wallet.count === null
          ? tPassport("badgeNoWallet", { percent })
          : tPassport("badge", { percent, count: wallet.count });
      })()
    : null;

  return (
    <PassportDraftProvider>
      <PageHeader
        eyebrow={t("passport.eyebrow")}
        title={t("passport.title")}
        description={t("passport.description")}
        actions={
          <>
            {result.ok && (
              <EmptyDraftButton
                labels={{
                  trigger: t("passport.emptyDraft.trigger"),
                  title: t("passport.emptyDraft.title"),
                  text: t("passport.emptyDraft.text"),
                  confirm: t("passport.emptyDraft.confirm"),
                  cancel: (await getTranslations("common"))("cancel"),
                }}
              />
            )}
            {badge && <StatusChip tone="info">{badge}</StatusChip>}
          </>
        }
      />
      {overview && (
        <PassportVisual
          userId={actor.id}
          name={actor.profile.display_name}
          medals={medalInputOf(overview, today)}
          today={today}
          reviews={upcomingReviews(overview.qualifications, wallet.expiries, today)}
          reviewsFailed={wallet.enabled && wallet.expiries === null}
        />
      )}
      {result.ok ? (
        <ProfileForm
          profile={result.data.profile}
          organizations={result.data.organizations}
          countryNames={countryNames(locale)}
        />
      ) : (
        <ApiErrorState error={result.error} requestId={result.requestId} />
      )}
      {/* v1.8 `Badges` (learning view): the achievements of this browser under the visual passport. */}
      <div className="mt-6">
        <LearningAchievements userId={actor.id} />
      </div>
    </PassportDraftProvider>
  );
}
