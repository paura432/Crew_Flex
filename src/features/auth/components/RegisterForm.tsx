"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { controlClass, describedBy, Field } from "@/components/ui/Field";
import { signUpAction } from "../actions";
import { initialAuthState } from "../state";
import { FormAlert } from "./FormAlert";

const ORGANIZATION_TYPES = [
  ["mro", "MRO"],
  ["airline", "Airline"],
  ["operator", "Operator"],
  ["staffing_agency", "Staffing agency"],
  ["other", "Other"],
] as const;

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(signUpAction, initialAuthState);
  const [accountType, setAccountType] = useState<"professional" | "organization">("organization");
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? (state.values ?? {}) : {};

  if (state.status === "check_email") {
    return (
      <div role="status" className="rounded-lg border border-ok/30 bg-ok-bg px-4 py-3 text-ok">
        <p className="font-semibold">Check your inbox</p>
        <p className="text-sm">
          We sent a confirmation link to {state.email}. Confirm it, then sign in.
        </p>
      </div>
    );
  }

  const text = (id: string, label: string, props: Record<string, string> = {}) => (
    <Field id={id} label={label} error={errors[id]} hint={props.hint}>
      <input
        id={id}
        name={id}
        type={props.type ?? "text"}
        autoComplete={props.autoComplete}
        defaultValue={props.type === "password" ? undefined : values[id]}
        required
        className={controlClass}
        aria-invalid={Boolean(errors[id])}
        aria-describedby={describedBy(id, errors[id], props.hint)}
      />
    </Field>
  );

  return (
    <form
      key={state.status === "error" ? JSON.stringify(values) : "initial"}
      action={formAction}
      className="flex flex-col gap-4"
      noValidate
    >
      <FormAlert state={state} />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">I am registering as</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["organization", "Organization", "MRO, airline, operator"],
              ["professional", "Professional", "Technician / engineer"],
            ] as const
          ).map(([value, label, detail]) => (
            <label
              key={value}
              className="flex cursor-pointer flex-col rounded-lg border border-line bg-white p-3 has-[:checked]:border-accent has-[:checked]:bg-warn-bg/40"
            >
              <span className="flex items-center gap-2 font-semibold">
                <input
                  type="radio"
                  name="accountType"
                  value={value}
                  checked={accountType === value}
                  onChange={() => setAccountType(value)}
                />
                {label}
              </span>
              <span className="text-sm text-muted">{detail}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {text("displayName", "Your name", { autoComplete: "name" })}
      {text("email", "Email", { type: "email", autoComplete: "email" })}
      {text("password", "Password", {
        type: "password",
        autoComplete: "new-password",
        hint: "At least 10 characters.",
      })}

      {accountType === "organization" && (
        <>
          {text("organizationName", "Organization name", { autoComplete: "organization" })}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="organizationType" label="Organization type" error={errors.organizationType}>
              <select
                id="organizationType"
                name="organizationType"
                defaultValue={values.organizationType || "mro"}
                className={controlClass}
              >
                {ORGANIZATION_TYPES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            {text("country", "Country (ISO code)", { hint: "e.g. ES", autoComplete: "country" })}
          </div>
        </>
      )}

      <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
