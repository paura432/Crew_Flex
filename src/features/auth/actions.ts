"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  forgotPasswordInput,
  resetPasswordInput,
  signInInput,
  signUpInput,
} from "@/lib/validation/auth";
import { normalizeInvitationCode } from "@/lib/validation/account";
import { toFieldErrors } from "@/lib/validation/errors";
import { isInvitationSignupRequired } from "@/server/feature-flags";
import { readInvitation } from "./invitation";
import { hasRecentRecoverySession } from "./recovery";
import { mapAuthError, safeNextPath, type AuthFormState } from "./state";

function echoValues(formData: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((key) => [key, String(formData.get(key) ?? "")]));
}

const SIGN_UP_ECHO = ["displayName", "email", "organizationName", "organizationType", "country"];

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signInInput.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      code: "VALIDATION_ERROR",
      fieldErrors: toFieldErrors(parsed.error),
      values: echoValues(formData, ["email"]),
    };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { status: "error", ...mapAuthError(error), values: echoValues(formData, ["email"]) };
  }

  redirect(safeNextPath(formData.get("next")));
}

/**
 * Sign-up. With the owner flag `invitation_signup` on (T-40, OD-8 default v1.8) a valid invitation code
 * is required: its account type replaces the form's, a code of another address is refused without
 * consuming it, and the sign-up trigger checks and consumes it again in the same transaction (the
 * real barrier). With the flag off, open sign-up as before. The confirmation link lands on
 * `/auth/confirm?next=/app` (AUTH-03); with confirmations on, an existing address gets the same
 * «check your inbox» answer as a new one (no enumeration). With the invitation flag on, a direct
 * Auth API sign-up of an unknown address fails (CFI01 → 500) while an existing one gets Auth's
 * obfuscated 200: that residual is documented (SECURITY_PRIVACY T40).
 */
export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const invitationOnly = await isInvitationSignupRequired();
  const rawCode = String(formData.get("invitationCode") ?? "");
  const code = normalizeInvitationCode(rawCode);
  let accountType = formData.get("accountType");
  if (invitationOnly) {
    const echo = { ...echoValues(formData, SIGN_UP_ECHO), invitationCode: rawCode.trim() };
    if (!rawCode.trim()) return { status: "error", code: "INVITATION_REQUIRED", values: echo };
    const invitation = code ? await readInvitation(code, null) : null;
    if (!invitation || invitation.status !== "valid" || !invitation.accountType) {
      return { status: "error", code: "INVITATION_INVALID", values: echo };
    }
    accountType = invitation.accountType;
  }
  const parsed = signUpInput.safeParse({
    accountType,
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
    ...(accountType === "organization"
      ? {
          organizationName: formData.get("organizationName"),
          organizationType: formData.get("organizationType"),
          country: formData.get("country"),
        }
      : {}),
  });
  const values = {
    ...echoValues(formData, SIGN_UP_ECHO),
    ...(invitationOnly ? { invitationCode: rawCode.trim() } : {}),
  };
  if (!parsed.success) {
    return {
      status: "error",
      code: "VALIDATION_ERROR",
      fieldErrors: toFieldErrors(parsed.error),
      values,
    };
  }

  const input = parsed.data;
  if (invitationOnly && code) {
    const forAddress = await readInvitation(code, input.email);
    if (forAddress.status === "other_email") {
      return { status: "error", code: "INVITATION_OTHER_EMAIL", values };
    }
    if (forAddress.status !== "valid")
      return { status: "error", code: "INVITATION_INVALID", values };
  }
  // Metadata only seeds the profile/organization in the sign-up trigger. It never grants a
  // platform role (see supabase/migrations: handle_new_user); with invitations the trigger takes the
  // account type from the invitation and removes the code from the metadata.
  const metadata = {
    ...(input.accountType === "organization"
      ? {
          account_type: input.accountType,
          display_name: input.displayName,
          organization_name: input.organizationName,
          organization_type: input.organizationType,
          country: input.country,
        }
      : { account_type: input.accountType, display_name: input.displayName }),
    ...(invitationOnly && code ? { invitation_code: code } : {}),
  };

  // Server Actions are same-origin (Next.js checks Origin against Host), so this is our own URL.
  const origin = (await headers()).get("origin");
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: metadata, emailRedirectTo: `${origin}/auth/confirm?next=/app` },
  });
  if (error) {
    // The trigger refused (race: the code was used or revoked meanwhile): say so, not «failed».
    if (invitationOnly && code && (await readInvitation(code, input.email)).status !== "valid") {
      return { status: "error", code: "INVITATION_INVALID", values };
    }
    const mapped = mapAuthError(error);
    // T-41: an existing address gets the new-address answer (no enumeration). Auth only obfuscates
    // it itself when neither e-mail nor SMS autoconfirm is on, so the app does not rely on that.
    if (mapped.code === "USER_EXISTS") return { status: "check_email", email: input.email };
    return { status: "error", ...mapped, values };
  }
  if (!data.session) return { status: "check_email", email: input.email };

  redirect("/app");
}

/**
 * Sends the recovery e-mail. The answer is the same whether or not the account exists (no account
 * enumeration); only validation and network failures are reported. Supabase rate-limits the sends.
 */
export async function requestPasswordResetAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = forgotPasswordInput.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return {
      status: "error",
      code: "VALIDATION_ERROR",
      fieldErrors: toFieldErrors(parsed.error),
      values: echoValues(formData, ["email"]),
    };
  }
  // Server Actions are same-origin (Next.js checks Origin against Host), so this is our own URL.
  const origin = (await headers()).get("origin");
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });
  if (error && mapAuthError(error).code === "NETWORK_ERROR") {
    return { status: "error", code: "NETWORK_ERROR", values: echoValues(formData, ["email"]) };
  }
  return { status: "check_email", email: parsed.data.email };
}

/**
 * Sets the new password, only in a session opened by a recovery link within the last hour (a plain
 * signed-in session cannot change the password without the current one), then ends every session
 * of the user, this one included.
 */
export async function updatePasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = resetPasswordInput.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { status: "error", code: "VALIDATION_ERROR", fieldErrors: toFieldErrors(parsed.error) };
  }
  const supabase = await createServerSupabase();
  if (!(await hasRecentRecoverySession(supabase))) {
    return { status: "error", code: "RECOVERY_EXPIRED" };
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: "error", ...mapAuthError(error) };
  // V1.8 parity (server/app.mjs:165): every session ends, this one too — the recovery session keeps
  // GoTrue's «no current password» exemption for its whole life (review of 5d22175).
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login?reset=1");
}

export async function signOutAction() {
  const supabase = await createServerSupabase();
  // This device only, as v1.8 (X-12): auth-js defaults to `global`, which also ended the account's
  // sessions on every other device. The password reset above stays global on purpose.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?signedOut=1");
}
