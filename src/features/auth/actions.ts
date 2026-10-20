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
import { toFieldErrors } from "@/lib/validation/errors";
import { hasRecentRecoverySession } from "./recovery";
import { safeNextPath, type AuthErrorCode, type AuthFormState } from "./state";

interface AuthErrorLike {
  code?: string;
  name?: string;
  status?: number;
}

/** Maps provider errors to stable codes; the UI translates them (`auth.errors.*`). */
function mapAuthError(error: AuthErrorLike): { code: AuthErrorCode } {
  if (error.name === "AuthRetryableFetchError" || error.status === 0) {
    return { code: "NETWORK_ERROR" };
  }
  if (error.name === "AuthSessionMissingError") return { code: "RECOVERY_EXPIRED" };
  switch (error.code) {
    case "invalid_credentials":
      return { code: "INVALID_CREDENTIALS" };
    case "email_not_confirmed":
      return { code: "EMAIL_NOT_CONFIRMED" };
    case "user_already_exists":
    case "email_exists":
      return { code: "USER_EXISTS" };
    case "weak_password":
      return { code: "WEAK_PASSWORD" };
    case "same_password":
      return { code: "SAME_PASSWORD" };
    // Provider refused a password change outside a recovery session (T22 settings).
    case "current_password_required":
    case "reauthentication_needed":
      return { code: "RECOVERY_EXPIRED" };
    default:
      return { code: "UNKNOWN" };
  }
}

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

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const accountType = formData.get("accountType");
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
  if (!parsed.success) {
    return {
      status: "error",
      code: "VALIDATION_ERROR",
      fieldErrors: toFieldErrors(parsed.error),
      values: echoValues(formData, SIGN_UP_ECHO),
    };
  }

  const input = parsed.data;
  // Metadata only seeds the profile/organization in the sign-up trigger. It never grants a
  // platform role (see supabase/migrations: handle_new_user).
  const metadata =
    input.accountType === "organization"
      ? {
          account_type: input.accountType,
          display_name: input.displayName,
          organization_name: input.organizationName,
          organization_type: input.organizationType,
          country: input.country,
        }
      : { account_type: input.accountType, display_name: input.displayName };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: metadata },
  });
  if (error) {
    return { status: "error", ...mapAuthError(error), values: echoValues(formData, SIGN_UP_ECHO) };
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
  await supabase.auth.signOut();
  redirect("/login");
}
