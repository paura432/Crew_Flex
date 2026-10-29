// «Documentos y cursos próximos a revisar» (v1.8 `Badges.jsx:10`, TD-44): the declared expiries within
// REVIEW_WINDOW_DAYS — expired included — over the held qualifications and, while the wallet is on, the
// own documents, soonest first. Pure: «Mi espacio» and the passport's «Pasaporte visual» list the same rows.
import { isDueForReview } from "@/domain/documents";

export interface ReviewItem {
  key: string;
  title: string;
  /** `YYYY-MM-DD`. */
  expiresAt: string;
  /** Where «Abrir» leads: the qualifications page or the wallet. */
  href: string;
}

export function upcomingReviews(
  qualifications: readonly {
    id: string;
    status: string;
    expires_at: string | null;
    qualification_types: { code: string; name: string };
  }[],
  /** Own wallet documents with a date; `null` when the wallet is off or the read failed. */
  documents: readonly { id: string; title: string; expiresAt: string }[] | null,
  today: string,
): ReviewItem[] {
  return [
    ...qualifications
      .filter((q) => q.status === "active" && q.expires_at !== null)
      .map((q) => ({
        key: `q-${q.id}`,
        title: `${q.qualification_types.code} · ${q.qualification_types.name}`,
        expiresAt: q.expires_at as string,
        href: "/app/professional/qualifications",
      })),
    ...(documents ?? []).map((d) => ({
      key: `d-${d.id}`,
      title: d.title,
      expiresAt: d.expiresAt,
      href: "/app/professional/documents",
    })),
  ]
    .filter((item) => isDueForReview(item.expiresAt, today))
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
}
