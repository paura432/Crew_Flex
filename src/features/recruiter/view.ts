// Display helpers of the recruiter screens (pure: no React, no I/O; client and server components both import it).
import type { Tone } from "@/components/ui/StatusChip";
import { canActForClient, type RepresentationStatus } from "@/domain/recruiter";
import type { RepresentedClient } from "@/types/api";

export const CLIENT_STATUS_TONE: Record<RepresentationStatus, Tone> = {
  pending: "warn",
  active: "ok",
  revoked: "neutral",
};

/** The date line of a client: when it was revoked, activated or added. */
export function clientSince(client: RepresentedClient) {
  if (client.status === "revoked" && client.revokedAt)
    return { key: "revokedOn", date: client.revokedAt } as const;
  if (client.status === "active" && client.activatedAt)
    return { key: "activatedOn", date: client.activatedAt } as const;
  return { key: "addedOn", date: client.createdAt } as const;
}

/** The builder offers only clients it may publish for (BR-27.2), by name. */
export const selectableClients = (clients: RepresentedClient[]) =>
  clients
    .filter((c) => canActForClient(c.status))
    .map((c) => ({ id: c.id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
