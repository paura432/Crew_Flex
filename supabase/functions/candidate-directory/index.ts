// «Buscar candidatos» (package directory; migration 20261024700000, BUSINESS_RULES BR-28, T-150…T-159).
// Admin/manager of the organization (role from the database, never from the request; the RPCs re-check it).
// GET /candidate-directory?organizationId=&category=&aircraft=&englishLevel=&minYears=&country=&base=&from=&to=
//     &blocked=&page=                                   → DirectorySearchResponse { candidates, total, page, … }
// PUT /candidate-directory { organizationId, candidateRef, blocked } → DirectoryBlockResponse (v2-16)
// ONE database function does the search (search_candidate_directory, DEFINER): the external pool's visibility
// rules without a requirement (never `private`, never a member, never a blocker, never someone the organization
// blocked), per-organization pseudonyms (T-151), the passport card minimised (T-153), 20 a page, 60 searches per
// organization per minute (T-157). The answer never carries an id, contact, employer, rate, documents,
// qualifications or restriction text. 409 `reason` = DIRECTORY_CONFLICTS (rate limited, candidate not found).
import { z } from "zod";
import { requireActor, requireOrganizationRole } from "../_shared/auth.ts";
import { fromDatabaseError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/http.ts";
import { parseJsonBody, parseQuery } from "../_shared/validation.ts";
import { DIRECTORY_PAGE_SIZE } from "../../../src/domain/directory.ts";
import { candidateDeclarationsRow, toDeclarations } from "../../../src/lib/candidate-pool.ts";
import {
  directoryBlockInput,
  directorySearchQuery,
} from "../../../src/lib/validation/directory.ts";
import type {
  DirectoryBlockResponse,
  DirectoryCandidate,
  DirectorySearchResponse,
} from "../../../src/types/api.ts";

const directoryRow = z.object({
  candidate_ref: z.string(),
  candidate_display_name: z.string().nullable(),
  candidate_base_location: z.string().nullable(),
  candidate_years_experience: z.number().int().nullable(),
  candidate_declarations: candidateDeclarationsRow,
  total: z.number().int().min(0),
});

/** One row of search_candidate_directory → the contract (parsed, not cast: schema drift fails loudly). */
export function toDirectoryCandidate(raw: unknown): DirectoryCandidate {
  const row = directoryRow.parse(raw);
  return {
    ref: row.candidate_ref,
    displayName: row.candidate_display_name,
    baseLocation: row.candidate_base_location,
    yearsExperience: row.candidate_years_experience,
    declarations: toDeclarations(row.candidate_declarations),
  };
}

/** The rows of one page → the response; the total travels on every row (`count(*) over ()`), 0 when none. */
export function toSearchResponse(
  data: unknown,
  page: number,
  blocked: boolean,
): DirectorySearchResponse {
  const rows = z.array(z.unknown()).parse(data);
  const total = rows.length > 0 ? directoryRow.parse(rows[0]).total : 0;
  return {
    candidates: rows.map(toDirectoryCandidate),
    total,
    page,
    pageSize: DIRECTORY_PAGE_SIZE,
    blocked,
  };
}

export const handler = createHandler("candidate-directory", {
  GET: async (ctx) => {
    const actor = await requireActor(ctx);
    const q = parseQuery(ctx.url, directorySearchQuery);
    await requireOrganizationRole(actor, q.organizationId, ["admin", "manager"]);
    const page = q.page ?? 1;
    const blocked = q.blocked === "1";
    const { data, error } = await actor.client.rpc("search_candidate_directory", {
      p_organization_id: q.organizationId,
      p_category: q.category ?? null,
      p_aircraft: q.aircraft ?? null,
      p_english_level: q.englishLevel ?? null,
      p_min_years: q.minYears ?? null,
      p_country: q.country ?? null,
      p_base: q.base ? q.base : null,
      p_from: q.from ?? null,
      p_to: q.to ?? null,
      p_blocked: blocked,
      p_limit: DIRECTORY_PAGE_SIZE,
      p_offset: (page - 1) * DIRECTORY_PAGE_SIZE,
    });
    if (error) throw fromDatabaseError(error); // 42501 → 403, 22023 → 400, CFD01 → 409
    return { data: toSearchResponse(data, page, blocked) };
  },

  PUT: async (ctx) => {
    const actor = await requireActor(ctx);
    const input = await parseJsonBody(ctx.req, directoryBlockInput);
    await requireOrganizationRole(actor, input.organizationId, ["admin", "manager"]);
    const { data, error } = await actor.client.rpc("set_directory_block", {
      p_organization_id: input.organizationId,
      p_candidate_ref: input.candidateRef,
      p_blocked: input.blocked,
      p_request_id: ctx.requestId,
    });
    if (error) throw fromDatabaseError(error); // CFD02 → 409 DIRECTORY_CANDIDATE_NOT_FOUND
    return {
      data: {
        candidateRef: input.candidateRef,
        blocked: z.boolean().parse(data),
      } satisfies DirectoryBlockResponse,
    };
  },
});

if (import.meta.main) Deno.serve(handler);
