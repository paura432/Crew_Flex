import type { FieldErrors } from "@/lib/validation/errors";
import type { ApiErrorCode } from "@/types/api";

/** «Cerrar cuenta» form. Codes are translated by the form (`account.data.errors.*`). */
export type CloseAccountState =
  | { status: "idle" }
  | {
      status: "error";
      code: "CONFIRM_WORD" | "ACTIVE_COMMITMENTS" | "ACTIVE_TRAINING_SEATS" | ApiErrorCode;
      requestId?: string;
    };

/** «Invitar» form (`account.invite.*`). Never carries the invitation code. */
export type InviteState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | {
      status: "error";
      code: ApiErrorCode;
      fieldErrors?: FieldErrors;
      values?: Record<string, string>;
      requestId?: string;
    };

/** The export's file name (v1.8 `CrewFlex-mis-datos.json`), in the UI language. */
export const exportFileName = (locale: string) =>
  locale === "en" ? "CrewFlex-my-data.json" : "CrewFlex-mis-datos.json";

export const initialCloseAccountState: CloseAccountState = { status: "idle" };
export const initialInviteState: InviteState = { status: "idle" };
