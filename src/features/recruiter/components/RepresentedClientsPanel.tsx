import { getLocale, getTranslations } from "next-intl/server";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { Panel } from "@/components/ui/Panel";
import { StatusChip } from "@/components/ui/StatusChip";
import { canRevoke } from "@/domain/recruiter";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import { listRepresentedClients } from "../api";
import { CLIENT_STATUS_TONE, clientSince } from "../view";
import { AddClientForm } from "./AddClientForm";
import { RevokeClientButton } from "./RevokeClientButton";

/**
 * v1.8 «Cartera de clientes» (Company2.jsx:211): «{nombre} · {correo || 'Sin correo'}» with the representation's
 * state (T-130: pending until the administration records the evidence), the add form and «Revocar» for the agency's
 * admins/managers. Every member of the agency reads it; nobody else (RLS).
 */
export async function RepresentedClientsPanel({
  organizationId,
  canManage,
}: {
  organizationId: string;
  canManage: boolean;
}) {
  const [t, locale, result] = await Promise.all([
    getTranslations("recruiter.clients"),
    getLocale() as Promise<Locale>,
    listRepresentedClients(organizationId),
  ]);
  return (
    <div id="clients" className="scroll-mt-4">
      <Panel title={t("title")}>
        <div className="space-y-4">
          {!result.ok ? (
            <ApiErrorState error={result.error} requestId={result.requestId} />
          ) : result.data.clients.length === 0 ? (
            <p className="text-sm text-muted">{t("empty")}</p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {result.data.clients.map((client) => {
                const line = clientSince(client);
                return (
                  <li
                    key={client.id}
                    className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm break-words">
                        <strong>{client.name}</strong> · {client.contactEmail ?? t("noEmail")}
                      </p>
                      <p className="text-xs text-muted tabular-nums">
                        {t(line.key, { date: formatDate(locale, line.date) })}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusChip tone={CLIENT_STATUS_TONE[client.status]}>
                        {t(`status.${client.status}`)}
                      </StatusChip>
                      {canManage && canRevoke(client.status) && (
                        <RevokeClientButton id={client.id} name={client.name} />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="rounded-lg border border-line bg-info-bg px-4 py-3 text-sm text-blue">
            {t("verificationNote")}
          </p>
          <p className="text-sm text-muted">{t("note")}</p>
          {canManage ? (
            <AddClientForm organizationId={organizationId} />
          ) : (
            <p className="text-sm text-muted">{t("managersOnly")}</p>
          )}
        </div>
      </Panel>
    </div>
  );
}
