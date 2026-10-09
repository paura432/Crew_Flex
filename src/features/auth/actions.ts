"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { signInInput, signUpInput } from "@/lib/validation/auth";
import { toFieldErrors } from "@/lib/validation/errors";
import { safeNextPath, type AuthErrorCode, type AuthFormState } from "./state";

interface AuthErrorLike {
  code?: string;
  name?: string;
  status?: number;
}

function mapAuthError(error: AuthErrorLike): { code: AuthErrorCode; message: string } {
  if (error.name === "AuthRetryableFetchError" || error.status === 0) {
    return { code: "NETWORK_ERROR", message: "Could not reach the authentication service. Retry." };
  }
  switch (error.code) {
    case "invalid_credentials":
      return { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." };
    case "email_not_confirmed":
      return { code: "EMAIL_NOT_CONFIRMED", message: "Confirm your email before signing in." };
    case "user_already_exists":
    case "email_exists":
      return { code: "USER_EXISTS", message: "An account with this email already exists." };
    case "weak_password":
      return { code: "WEAK_PASSWORD", message: "Choose a stronger password." };
    default:
      return { code: "UNKNOWN", message: "Authentication failed. Try again." };
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
      message: "Check the highlighted fields.",
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
      message: "Check the highlighted fields.",
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

export async function signOutAction() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
