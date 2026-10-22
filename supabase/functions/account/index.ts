// Own data rights (PKG account; v1.8 «Mi cuenta», `server/app.mjs:142-143,176`; M-3 default T-42/T-43).
// LOCAL ONLY.
//   GET    /account              → AccountExportResponse: the caller's own records (passport, logbook…) and files
//   DELETE /account { confirm }  → AccountCloseResponse: RPC close_my_account, then the files' objects
// Identity from the JWT only; every read runs under RLS as the caller (no other person's data, no audit
// trail). No privileged key: close_my_account deletes the Auth user as its owner in ONE transaction
// (migration 20261023400100: refused with accepted/confirmed applications → 409 ACTIVE_COMMITMENTS;
// applications in progress withdrawn and audited; commitments and audit kept without the profile), and
// the Storage objects of the deleted documents are removed with the caller's token (own folder, no row
// points at them any more). Whatever Storage leaves behind is a due `owner_delete` tombstone that
// documents-maintenance purges.
import { requireActor, type Actor } from "../_shared/auth.ts";
import { ApiError, fromDatabaseError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/http.ts";
import { logEvent } from "../_shared/logger.ts";
import { parseJsonBody } from "../_shared/validation.ts";
import { BUCKET, DOCUMENT_SELECT, toDocument } from "../professional-documents/index.ts";
import { filesToEmbed } from "../../../src/domain/account.ts";
import { closeAccountInput } from "../../../src/lib/validation/account.ts";
import type {
  AccountCloseResponse,
  AccountExport,
  AccountExportResponse,
  ExportRecord,
} from "../../../src/types/api.ts";

const FN = "account";

/**
 * Every column `toDocument` reads (one list, owned by professional-documents) + the path for the bytes.
 * Documents in the wallet's trash are exported too, marked by `archivedAt` (T-101: they are still the
 * person's stored data until purged).
 */
export const DOCUMENT_COLUMNS = `${DOCUMENT_SELECT}, storage_path`;

/** Standard base64 of bytes (chunked: no argument-count limit on large files). */
export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

type Result<T> = { data: T | null; error: { code?: string; message?: string } | null };

function rows<T = ExportRecord>(result: Result<unknown>): T[] {
  if (result.error) throw fromDatabaseError(result.error);
  return (result.data ?? []) as T[];
}

function one<T = ExportRecord>(result: Result<unknown>): T | null {
  if (result.error) throw fromDatabaseError(result.error);
  return (result.data ?? null) as T | null;
}

async function exportFor(actor: Actor): Promise<AccountExport> {
  const db = actor.client;
  const [profileResult, memberships, technician, created, documentRows] = await Promise.all([
    db
      .from("profiles")
      .select("id, display_name, account_type, platform_role, preferred_locale, created_at")
      .eq("id", actor.id)
      .maybeSingle(),
    db
      .from("organization_members")
      .select("role, created_at, organizations ( id, name, type, country )")
      .eq("profile_id", actor.id),
    db
      .from("technician_profiles")
      .select(
        "base_location, mobility, years_experience, current_status, visibility, primary_category, categories, aircraft, engines, skills, english_level, own_tools, base_country, work_permits, general_restrictions, created_at, updated_at",
      )
      .eq("profile_id", actor.id)
      .maybeSingle(),
    db
      .from("work_requirements")
      .select(
        "id, organization_id, title, location, starts_at, ends_at, shift, headcount, urgency, status, created_at",
      )
      .eq("created_by", actor.id)
      .order("created_at"),
    db
      .from("professional_documents")
      .select(DOCUMENT_COLUMNS)
      .eq("owner_id", actor.id)
      .order("created_at"),
  ]);
  const profile = one<{
    id: string;
    display_name: string;
    account_type: "professional" | "organization";
    platform_role: "user" | "platform_admin";
    preferred_locale: "es" | "en" | null;
    created_at: string;
  }>(profileResult);
  if (!profile) throw new ApiError("NOT_FOUND");

  const technicianProfile = one(technician);
  let professional: AccountExport["professional"] = null;
  if (technicianProfile) {
    const [
      qualifications,
      reviewNotes,
      availability,
      rotation,
      applications,
      typeRatings,
      privateDetails,
      organizationBlocks,
      logbook,
    ] = await Promise.all([
      db
        .from("technician_qualifications")
        .select(
          "id, status, issued_at, expires_at, verification_status, reviewed_at, created_at, updated_at, qualification_types ( code, name, category )",
        )
        .eq("technician_profile_id", actor.id)
        .order("created_at"),
      db.rpc("own_qualification_reviews"),
      db
        .from("availability_windows")
        .select("starts_at, ends_at, status, created_at, updated_at")
        .eq("technician_profile_id", actor.id)
        .order("starts_at"),
      db
        .from("availability_rotations")
        .select("pattern, anchor, custom_cycle, updated_at")
        .eq("technician_profile_id", actor.id)
        .maybeSingle(),
      db.rpc("get_my_applications"),
      db
        .from("technician_type_ratings")
        .select("aircraft, category, expires_at, restrictions, created_at, updated_at")
        .eq("technician_profile_id", actor.id)
        .order("created_at"),
      db
        .from("technician_private_details")
        .select("phone, current_employer_id, min_rate, rate_unit, updated_at")
        .eq("profile_id", actor.id)
        .maybeSingle(),
      db
        .from("technician_organization_blocks")
        .select("organization_id, created_at")
        .eq("technician_profile_id", actor.id)
        .order("created_at"),
      db
        .from("logbook_entries")
        .select(
          "entry_date, aircraft, ata, hours, category, environment, description, cv_relevant, archived, created_at, updated_at",
        )
        .eq("technician_profile_id", actor.id)
        .order("entry_date"),
    ]);
    professional = {
      profile: technicianProfile,
      qualifications: rows(qualifications),
      reviewNotes: rows(reviewNotes),
      availability: rows(availability),
      rotation: one(rotation),
      applications: rows(applications),
      typeRatings: rows(typeRatings),
      privateDetails: one(privateDetails),
      organizationBlocks: rows(organizationBlocks),
      logbook: rows(logbook),
    };
  }

  const stored = rows<{ storage_path: string }>(documentRows);
  const documents = stored.map((raw) => ({ ...toDocument(raw), storagePath: raw.storage_path }));
  const embed = filesToEmbed(documents);
  const exported = await Promise.all(
    documents.map(async ({ storagePath, ...document }) => {
      if (!embed.has(document.id)) return { ...document, contentBase64: null };
      const file = await db.storage.from(BUCKET).download(storagePath);
      if (file.error || !file.data) return { ...document, contentBase64: null };
      return {
        ...document,
        contentBase64: toBase64(new Uint8Array(await file.data.arrayBuffer())),
      };
    }),
  );

  return {
    format: "crewflex-account-export/1",
    exportedAt: new Date().toISOString(),
    account: {
      id: profile.id,
      email: actor.email,
      displayName: profile.display_name,
      accountType: profile.account_type,
      platformRole: profile.platform_role,
      preferredLocale: profile.preferred_locale,
      createdAt: new Date(profile.created_at).toISOString(),
    },
    memberships: rows(memberships),
    professional,
    requirementsCreated: rows(created),
    documents: exported,
    filesOmitted: exported.filter((d) => d.contentBase64 === null).length,
  };
}

export const handler = createHandler(FN, {
  GET: async (ctx) => {
    const actor = await requireActor(ctx);
    return { data: { export: await exportFor(actor) } satisfies AccountExportResponse };
  },

  DELETE: async (ctx) => {
    const actor = await requireActor(ctx);
    await parseJsonBody(ctx.req, closeAccountInput);
    const { data, error } = await actor.client.rpc("close_my_account", {
      p_request_id: ctx.requestId,
    });
    if (error) throw fromDatabaseError(error);
    const paths = ((data ?? []) as { storage_path: string }[]).map((r) => r.storage_path);

    let filesRemoved = 0;
    if (paths.length > 0) {
      const removed = await actor.client.storage.from(BUCKET).remove(paths);
      filesRemoved = removed.error ? 0 : (removed.data?.length ?? 0);
    }
    const filesPending = paths.length - filesRemoved;
    if (filesPending > 0) {
      logEvent({
        fn: FN,
        requestId: ctx.requestId,
        event: "objects_left_for_purge",
        level: "warn",
        actorId: actor.id,
        internal: `pending_${filesPending}`,
      });
    }
    return {
      data: { closed: true, filesRemoved, filesPending } satisfies AccountCloseResponse,
    };
  },
});

if (import.meta.main) Deno.serve(handler);
