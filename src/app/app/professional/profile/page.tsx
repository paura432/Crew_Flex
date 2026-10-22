import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { StatusChip } from "@/components/ui/StatusChip";
import { EU_COUNTRIES, type EuCountry } from "@/domain/passport";
import { countOwnDocuments } from "@/features/documents/api";
import { getOwnProfessionalOverview, getProfessionalProfile } from "@/features/professional/api";
import { completenessOf } from "@/features/professional/completeness";
import { ProfileForm } from "@/features/professional/components/ProfileForm";
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
 * N-25, v1.8 «{%} completado · {n} evidencias»: the BR-11 percentage (same as the overview) and the
 * own wallet documents. Without the wallet only the percentage; if the data cannot be read, no badge.
 */
async function completionBadge(actorId: string, displayName: string): Promise<string | null> {
  try {
    const [overview, walletEnabled, t] = await Promise.all([
      getOwnProfessionalOverview(actorId),
      isDocumentWalletEnabled(),
      getTranslations("passport"),
    ]);
    if (!overview) return null;
    const documents = walletEnabled ? await countOwnDocuments() : null;
    const { percent } = completenessOf(displayName, overview, documents, new Date());
    return documents === null
      ? t("badgeNoWallet", { percent })
      : t("badge", { percent, count: documents });
  } catch (error) {
    unstable_rethrow(error); // Next.js control flow (dynamic APIs, redirects) is not a read failure
    return null;
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
  const [result, badge] = await Promise.all([
    getProfessionalProfile(),
    completionBadge(actor.id, actor.profile.display_name),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={t("passport.eyebrow")}
        title={t("passport.title")}
        description={t("passport.description")}
        actions={badge ? <StatusChip tone="info">{badge}</StatusChip> : undefined}
      />
      {result.ok ? (
        <ProfileForm
          profile={result.data.profile}
          organizations={result.data.organizations}
          countryNames={countryNames(locale)}
        />
      ) : (
        <ApiErrorState error={result.error} requestId={result.requestId} />
      )}
    </>
  );
}
