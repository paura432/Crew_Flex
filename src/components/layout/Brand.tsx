import { getTranslations } from "next-intl/server";
import { BrandMark } from "./BrandMark";

/**
 * v1.8 brand (C-12 default, T-140): the plane mark, «CrewFlex» and the «AVIATION» tag (11 px, one of the
 * micro-labels DESIGN_SYSTEM lists). `onDark` for the navy sidebar and landing; `compact` keeps the
 * mark alone below 420 px (the name stays for assistive tech) so the mobile bar fits the bell.
 */
export async function Brand({
  onDark = false,
  compact = false,
}: {
  onDark?: boolean;
  compact?: boolean;
}) {
  const t = await getTranslations("common");
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark />
      <span className={`leading-tight ${compact ? "sr-only min-[420px]:not-sr-only" : ""}`}>
        <span className={`block text-lg font-bold tracking-tight ${onDark ? "text-white" : ""}`}>
          {t("appName")}
        </span>
        <span
          className={`block text-[11px] tracking-[0.28em] ${onDark ? "text-[#91aac1]" : "text-muted"}`}
        >
          {t("brandTag")}
        </span>
      </span>
    </span>
  );
}
