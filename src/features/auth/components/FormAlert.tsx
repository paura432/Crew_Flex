import type { AuthFormState } from "../state";

export function FormAlert({ state }: { state: AuthFormState }) {
  if (state.status !== "error") return null;
  return (
    <p
      role="alert"
      className="rounded-lg border border-danger/30 bg-danger-bg px-3 py-2 text-sm font-medium text-danger"
    >
      {state.message}
    </p>
  );
}
