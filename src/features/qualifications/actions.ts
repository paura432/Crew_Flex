"use server";

import { toFieldErrors } from "@/lib/validation/errors";
import {
  createQualificationInput,
  qualificationIdQuery,
  updateQualificationInput,
} from "@/lib/validation/professional";
import {
  fromProfessionalResponse,
  invalidResult,
  type ProfileActionResult,
} from "../professional/action-result";
import { createQualification, deleteQualification, updateQualification } from "./api";

const PATHS = ["/app/professional/qualifications"];

/** Declares a qualification: always `pending` (BR-2.6); the owner is the JWT subject. */
export async function addQualificationAction(input: unknown): Promise<ProfileActionResult> {
  const parsed = createQualificationInput.safeParse(input);
  if (!parsed.success) return invalidResult(toFieldErrors(parsed.error));
  return fromProfessionalResponse(await createQualification(parsed.data), PATHS);
}

export async function updateQualificationAction(
  id: unknown,
  input: unknown,
): Promise<ProfileActionResult> {
  const idParsed = qualificationIdQuery.safeParse({ id });
  if (!idParsed.success) return invalidResult({ form: "Invalid qualification." });
  const parsed = updateQualificationInput.safeParse(input);
  if (!parsed.success) return invalidResult(toFieldErrors(parsed.error));
  return fromProfessionalResponse(await updateQualification(idParsed.data.id, parsed.data), PATHS);
}

export async function deleteQualificationAction(id: unknown): Promise<ProfileActionResult> {
  const idParsed = qualificationIdQuery.safeParse({ id });
  if (!idParsed.success) return invalidResult({ form: "Invalid qualification." });
  return fromProfessionalResponse(await deleteQualification(idParsed.data.id), PATHS);
}
