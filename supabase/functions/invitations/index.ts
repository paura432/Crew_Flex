// Invitations to sign up (PKG account; v1.8 `server/app.mjs:42,188`; OD-8 default T-40). LOCAL ONLY.
//   POST /invitations { email, accountType } → 201 InvitationResponse — never the code
// Platform admins only: the role is read from the database (RPC is_platform_admin, under RLS) and
// re-checked by every RPC. Fails closed: create_invitation refuses (0A000 → 404) unless the owner-only
// flag `app_private.feature_flags('invitation_signup')` is on.
//
// Delivery without any privileged key. Supabase Auth only e-mails addresses that have an Auth user, so
// the PUBLIC Auth API (publishable key, no session) is asked to sign the address in with a one-time
// link (`signInWithOtp`, `shouldCreateUser`): Auth creates a short-lived *delivery account* — metadata
// `invitation_delivery = <invitation id>`, to which the sign-up trigger gives no profile — and sends
// its e-mail with `emailRedirectTo = <site>/register?invite=<code>`. finish_invitation_delivery()
// then deletes that account (so the invitee can register with the code) and audits the outcome.
// The code exists in this request and in the e-mail only; the database keeps its SHA-256.
import { z } from "zod";
import { requireActor, type Actor } from "../_shared/auth.ts";
import { allowedOrigins } from "../_shared/cors.ts";
import { ApiError, fromDatabaseError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/http.ts";
import { logEvent } from "../_shared/logger.ts";
import { createPublicClient } from "../_shared/supabase.ts";
import { parseJsonBody } from "../_shared/validation.ts";
import { createInvitationInput } from "../../../src/lib/validation/account.ts";
import type { InvitationResponse } from "../../../src/types/api.ts";

const FN = "invitations";

const createdRow = z.object({
  invitation_id: z.string(),
  code: z.string().regex(/^[0-9a-f]{64}$/),
  expires_at: z.string(),
});

/**
 * Where the invitation link points: the app's own origin, the first exact entry of ALLOWED_ORIGINS
 * (the browser allowlist; production `https://crew-flex.vercel.app`). Auth re-checks it against its
 * redirect allowlist. Null when none is configured.
 */
export function invitationLink(code: string, origins: string[] = allowedOrigins()): string | null {
  const site = origins[0];
  return site ? `${site}/register?invite=${encodeURIComponent(code)}` : null;
}

async function requirePlatformAdmin(actor: Actor): Promise<void> {
  const { data, error } = await actor.client.rpc("is_platform_admin");
  if (error) throw fromDatabaseError(error);
  if (data !== true) throw new ApiError("FORBIDDEN");
}

export const handler = createHandler(FN, {
  POST: async (ctx) => {
    const actor = await requireActor(ctx);
    await requirePlatformAdmin(actor);
    const input = await parseJsonBody(ctx.req, createInvitationInput);
    const email = input.email.toLowerCase();

    const { data, error } = await actor.client.rpc("create_invitation", {
      p_email: email,
      p_account_type: input.accountType,
      p_request_id: ctx.requestId,
    });
    if (error) throw fromDatabaseError(error);
    const row = createdRow.parse(Array.isArray(data) ? data[0] : data);

    const link = invitationLink(row.code);
    let sent = false;
    if (link) {
      const { error: sendError } = await createPublicClient().auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: link,
          data: { invitation_delivery: row.invitation_id },
        },
      });
      sent = !sendError;
      if (sendError) {
        logEvent({
          fn: FN,
          requestId: ctx.requestId,
          event: "invitation_not_sent",
          level: "warn",
          actorId: actor.id,
          internal: `auth_${sendError.status ?? "error"}`,
        });
      }
    }
    // Always: remove the delivery account, record sent / revoked (a code nobody received is useless).
    const finished = await actor.client.rpc("finish_invitation_delivery", {
      p_invitation_id: row.invitation_id,
      p_sent: sent,
      p_request_id: ctx.requestId,
    });
    if (finished.error) {
      logEvent({
        fn: FN,
        requestId: ctx.requestId,
        event: "delivery_account_left",
        level: "warn",
        actorId: actor.id,
        internal: finished.error.code ?? "error",
      });
    }
    if (!sent) throw new ApiError("INTERNAL_ERROR", "The invitation e-mail could not be sent.");

    return {
      status: 201,
      data: {
        invitation: {
          id: row.invitation_id,
          email,
          accountType: input.accountType,
          expiresAt: new Date(row.expires_at).toISOString(),
        },
      } satisfies InvitationResponse,
    };
  },
});

if (import.meta.main) Deno.serve(handler);
