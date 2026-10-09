import type { ApiErrorBody } from "@/types/api";
import { ButtonLink } from "./Button";
import { StateMessage } from "./StateMessage";

const COPY: Record<ApiErrorBody["code"], { title: string; description: string }> = {
  UNAUTHORIZED: { title: "Your session has expired", description: "Sign in again to continue." },
  FORBIDDEN: {
    title: "You don't have permission",
    description: "Your role in this organization does not allow this action. Ask an admin.",
  },
  VALIDATION_ERROR: { title: "Invalid request", description: "Some values are not valid." },
  NOT_FOUND: { title: "Not found", description: "It may have been removed or you lack access." },
  METHOD_NOT_ALLOWED: { title: "Not supported", description: "This operation is not supported." },
  CONFLICT: { title: "Conflict", description: "The data changed. Reload and try again." },
  PAYLOAD_TOO_LARGE: { title: "Request too large", description: "Reduce the amount of data." },
  NETWORK_ERROR: {
    title: "Service unreachable",
    description: "Crew Flex could not reach the backend. Check your connection and retry.",
  },
  INTERNAL_ERROR: {
    title: "Server error",
    description: "Something failed on our side. Try again in a moment.",
  },
};

/** Distinguishes auth, permission, validation, network, not-found and server errors. */
export function ApiErrorState({ error, requestId }: { error: ApiErrorBody; requestId?: string }) {
  const copy = COPY[error.code];
  return (
    <StateMessage
      tone="danger"
      title={copy.title}
      description={
        <>
          {error.code === "VALIDATION_ERROR" ? error.message : copy.description}
          {requestId && (
            <span className="mt-2 block font-mono text-xs">Reference: {requestId}</span>
          )}
        </>
      }
      action={
        error.code === "UNAUTHORIZED" ? (
          <ButtonLink href="/login" variant="primary">
            Sign in
          </ButtonLink>
        ) : undefined
      }
    />
  );
}
