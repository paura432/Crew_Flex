// Published requirements for professionals (M07, owner decision D-12 of 2026-10-22).
// GET /opportunities[?urgency=&eligible=1&rest=1&q=&offset=&limit=] → { opportunities, total, considered, cap }
//     `eligible=1` the compatible ones, `rest=1` the «possible on rest» ones (BR-14.1), both = either
// GET /opportunities?id=<uuid>                               → { opportunity } (404: not published,
//                                                              ended or missing — the same answer)
// GET /opportunities?view=network[&urgency=&q=&offset=&limit=] → { opportunities: OpportunityRequirement[],
//                                                              total, considered, cap } (v2-20)
// GET /opportunities?view=network&id=<uuid>                  → { requirement } (404 as above)
// Professional accounts (403 otherwise); `view=network` is for organization members instead (403 without
// a membership) and carries no eligibility at all. The list comes from `list_opportunities` (DEFINER,
// fixed projection: organization name, no ids of people or organizations, no counts; never the caller's
// own organizations' requirements, T-90; never a requirement of an organization the caller blocked in the
// passport, v2-16/T-160 — so `?id=` of one is a 404 like an unpublished one, and applying to it answers
// 409 `ORGANIZATION_BLOCKED` in `applications`); eligibility is the shared engine on the caller's OWN data
// (`own_candidate_profile`) against the requirement and its v1.8 profile requirements
// (`get_requirement_profile_rules`, matching-v18), every failed rule explained in `match.blockers` —
// publication never makes anyone eligible. LLM ≠ eligibility engine.
import { z } from "zod";
import { type Actor, requireActor, requireTechnician } from "../_shared/auth.ts";
import { ApiError, fromDatabaseError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/http.ts";
import {
  loadOwnApplications,
  loadOwnCandidate,
  loadProfileRules,
  periodOf,
  toOpportunity,
  toOpportunityRequirement,
  withProfileRules,
} from "../_shared/applications.ts";
import { parseQuery } from "../_shared/validation.ts";
import {
  type ListOpportunitiesQuery,
  listOpportunitiesQuery,
} from "../../../src/lib/validation/applications.ts";
import type {
  NetworkOpportunityListResponse,
  NetworkOpportunityResponse,
  Opportunity,
  OpportunityListResponse,
  OpportunityRequirement,
  OpportunityResponse,
} from "../../../src/types/api.ts";

// ponytail: one request evaluates at most 200 published requirements (the SQL cap of
// list_opportunities); the response says so with `considered` / `cap`. Paginate in SQL when the
// network publishes more than that at once.
export const OPPORTUNITY_CAP = 200;

/** `eligible=1` keeps the compatible ones, `rest=1` the possible-on-rest ones, both = either, none = all. */
export const fitFilter =
  (query: Pick<ListOpportunitiesQuery, "eligible" | "rest">) =>
  (o: Pick<Opportunity, "match" | "possibleOnRest">) =>
    (!query.eligible && !query.rest) ||
    Boolean(query.eligible && o.match.eligible) ||
    Boolean(query.rest && o.possibleOnRest);

/** Organizations get no eligibility, so «Compatibles» / «Posible en descanso» are refused (400). */
export function assertNetworkParams(query: ListOpportunitiesQuery): void {
  if (query.view === "network" && (query.eligible || query.rest))
    throw new ApiError("VALIDATION_ERROR");
}

/** «Ofertas en la red» (v2-20): any membership, read under RLS (own rows). */
async function requireMembership(actor: Actor): Promise<void> {
  const { data, error } = await actor.client
    .from("organization_members")
    .select("organization_id")
    .eq("profile_id", actor.id)
    .limit(1);
  if (error) throw new ApiError("INTERNAL_ERROR");
  if (!data || data.length === 0) throw new ApiError("FORBIDDEN");
}

async function listPublished(
  actor: Actor,
  query: ListOpportunitiesQuery,
): Promise<OpportunityRequirement[]> {
  const { data, error } = await actor.client.rpc("list_opportunities", {
    p_id: query.id ?? null,
    p_urgency: query.id ? null : (query.urgency ?? null),
    p_q: query.id ? null : query.q || null,
    p_limit: OPPORTUNITY_CAP,
  });
  if (error) throw fromDatabaseError(error); // 42501 → 403 (neither a professional nor a member)
  const requirements = z.array(z.unknown()).parse(data).map(toOpportunityRequirement);
  if (query.id && requirements.length === 0) throw new ApiError("NOT_FOUND");
  return requirements;
}

export const handler = createHandler("opportunities", {
  GET: async (ctx) => {
    const actor = await requireActor(ctx);
    const query = parseQuery(ctx.url, listOpportunitiesQuery);

    if (query.view === "network") {
      // Organizations see the published projection only: no eligibility, no «Compatibles».
      assertNetworkParams(query);
      await requireMembership(actor);
      const requirements = await listPublished(actor, query);
      if (query.id)
        return { data: { requirement: requirements[0]! } satisfies NetworkOpportunityResponse };
      return {
        data: {
          opportunities: requirements.slice(query.offset, query.offset + query.limit),
          total: requirements.length,
          considered: requirements.length,
          cap: OPPORTUNITY_CAP,
        } satisfies NetworkOpportunityListResponse,
      };
    }

    await requireTechnician(actor);
    const listed = await listPublished(actor, query);

    const [own, mine, rules] =
      listed.length === 0
        ? [null, [], new Map()]
        : await Promise.all([
            loadOwnCandidate(actor, periodOf(listed)),
            loadOwnApplications(actor),
            loadProfileRules(
              actor,
              listed.map((r) => r.id),
            ),
          ]);
    // Each one with its v1.8 profile requirements (matching-v18); unpublished in between → left out.
    const requirements = withProfileRules(listed, rules);
    if (query.id && requirements.length === 0) throw new ApiError("NOT_FOUND");
    const now = Date.now();
    const all = own ? requirements.map((r) => toOpportunity(r, own, mine, now)) : [];

    if (query.id) return { data: { opportunity: all[0]! } satisfies OpportunityResponse };
    const filtered = all.filter(fitFilter(query));
    return {
      data: {
        opportunities: filtered.slice(query.offset, query.offset + query.limit),
        total: filtered.length,
        considered: requirements.length,
        cap: OPPORTUNITY_CAP,
      } satisfies OpportunityListResponse,
    };
  },
});

if (import.meta.main) Deno.serve(handler);
