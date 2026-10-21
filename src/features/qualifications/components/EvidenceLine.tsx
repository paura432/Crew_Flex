"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";

/** V1.8 passport: the own document that backs a qualification, or that none is linked yet. */
export function EvidenceLine({ titles }: { titles: string[] }) {
  const t = useTranslations("qualifications.evidence");
  return (
    <span className="mt-1 block text-xs">
      {titles.length > 0 ? t("linked", { titles: titles.join(", ") }) : t("none")}{" "}
      <Link href="/app/professional/documents" className="font-semibold text-blue hover:underline">
        {t("open")}
      </Link>
    </span>
  );
}
