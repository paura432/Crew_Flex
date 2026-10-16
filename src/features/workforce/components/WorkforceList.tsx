import { getLocale, getTranslations } from "next-intl/server";
import { StatusChip, type Tone } from "@/components/ui/StatusChip";
import type { VerificationStatus } from "@/domain/qualification";
import { formatDate } from "@/i18n/format";
import type { WorkforceMember } from "../api";

const VERIFICATION_TONE: Record<VerificationStatus, Tone> = {
  verified: "ok",
  pending: "warn",
  rejected: "danger",
  expired: "danger",
};

export async function WorkforceList({ members }: { members: WorkforceMember[] }) {
  const [t, tDomain, locale] = await Promise.all([
    getTranslations("organization.workforce"),
    getTranslations("domain"),
    getLocale(),
  ]);
  return (
    <ul className="divide-y divide-line">
      {members.map((member) => (
        <li key={member.profileId} className="grid gap-3 py-4 md:grid-cols-[minmax(0,14rem)_1fr]">
          <div>
            <p className="font-semibold">{member.displayName}</p>
            <p className="text-sm text-muted">
              {tDomain(`role.${member.role}`)}
              {member.technician?.baseLocation && ` · ${member.technician.baseLocation}`}
            </p>
          </div>
          {member.technician ? (
            member.technician.qualifications.length > 0 ? (
              <ul
                className="flex flex-wrap gap-2"
                aria-label={t("memberQualifications", { name: member.displayName })}
              >
                {member.technician.qualifications.map((q) => (
                  <li
                    key={q.id}
                    className="flex items-center gap-2 rounded-lg border border-line px-2 py-1 text-sm"
                  >
                    <span className="font-mono font-semibold">{q.qualification_types.code}</span>
                    <StatusChip tone={VERIFICATION_TONE[q.verification_status]}>
                      {tDomain(`verification.${q.verification_status}`)}
                    </StatusChip>
                    {q.expires_at && (
                      <span className="text-muted tabular-nums">
                        {formatDate(locale, q.expires_at)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t("noQualifications")}</p>
            )
          ) : (
            <p className="text-sm text-muted">{t("organizationUser")}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
