"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { controlClass, describedBy, Field } from "@/components/ui/Field";
import { signInAction } from "../actions";
import { initialAuthState } from "../state";
import { FormAlert } from "./FormAlert";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(signInAction, initialAuthState);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? (state.values ?? {}) : {};

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next ?? "/app"} />
      <FormAlert state={state} />
      <Field id="email" label="Email" error={errors.email}>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={values.email}
          required
          className={controlClass}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={describedBy("email", errors.email)}
        />
      </Field>
      <Field id="password" label="Password" error={errors.password}>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={controlClass}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={describedBy("password", errors.password)}
        />
      </Field>
      <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
