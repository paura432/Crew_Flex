// Published requirements for professionals (M07, owner decision D-12 of 2026-10-22).
// GET /opportunities[?urgency=&eligible=1&q=&offset=&limit=] → { opportunities, total, considered, cap }
// GET /opportunities?id=<uuid>                               → { opportunity } (404: not published,
//                                                              ended or missing — the same answer)
// Professional accounts only (403 otherwise). The list comes from `list_opportunities` (DEFINER, fixed
// projection: organization name, no ids of people or organizations, no counts); eligibility is the
// shared engine on the caller's OWN data (`own_candidate_profile`), every failed rule explained in
// `match.blockers` — publication never makes anyone eligible. LLM ≠ eligibility engine.
import { z } from "zod";
import { requireActor, requireTechnician } from "../_shared/auth.ts";
import { ApiError, fromDatabaseError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/http.ts";
import {
  loadOwnApplications,
  loadOwnCandidate,
  periodOf,
  toOpportunity,
  toOpportunityRequirement,
} from "../_shared/applications.ts";
import { parseQuery } from "../_shared/validation.ts";
import { listOpportunitiesQuery } from "../../../src/lib/validation/applications.ts";
import type { OpportunityListResponse, OpportunityResponse } from "../../../src/types/api.ts";

// ponytail: one request evaluates at most 200 published requirements (the SQL cap of
// list_opportunities); the response says so with `considered` / `cap`. Paginate in SQL when the
// network publishes more than that at once.
export const OPPORTUNITY_CAP = 200;

export const handler = createHandler("opportunities", {
  GET: async (ctx) => {
    const actor = await requireActor(ctx);
    const query = parseQuery(ctx.url, listOpportunitiesQuery);
    await requireTechnician(actor);

    const { data, error } = await actor.client.rpc("list_opportunities", {
      p_id: query.id ?? null,
      p_urgency: query.id ? null : (query.urgency ?? null),
      p_q: query.id ? null : query.q || null,
      p_limit: OPPORTUNITY_CAP,
    });
    if (error) throw fromDatabaseError(error); // 42501 → 403 (not a professional account)
    const requirements = z.array(z.unknown()).parse(data).map(toOpportunityRequirement);
    if (query.id && requirements.length === 0) throw new ApiError("NOT_FOUND");

    const [own, mine] =
      requirements.length === 0
        ? [null, []]
        : await Promise.all([
            loadOwnCandidate(actor, periodOf(requirements)),
            loadOwnApplications(actor),
          ]);
    const now = Date.now();
    const all = own ? requirements.map((r) => toOpportunity(r, own, mine, now)) : [];

    if (query.id) return { data: { opportunity: all[0]! } satisfies OpportunityResponse };
    const filtered = query.eligible ? all.filter((o) => o.match.eligible) : all;
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
