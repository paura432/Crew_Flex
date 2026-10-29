// «Exportar mis datos» includes the professional's own Candidate Pack copies (pack-view, T-43/T-114): the
// export asks get_my_application_packs (own rows only, DEFINER) and lists what it returns.
import { assertEquals } from "@std/assert";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Actor } from "../_shared/auth.ts";
import { exportFor } from "./index.ts";

const ID = "00000000-0000-4000-8000-0000000000aa";
const PACK = { application_id: ID, copied_at: "2026-10-24T09:30:00.000Z", years_experience: 12 };

/** A query chain that answers every builder call with `result` (awaited, or through maybeSingle). */
function chain(result: { data: unknown; error: null }) {
  const q: Record<string, unknown> = {
    select: () => q,
    eq: () => q,
    order: () => q,
    maybeSingle: () => Promise.resolve(result),
    then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) =>
      Promise.resolve(result).then(ok, ko),
  };
  return q;
}

function professionalActor(rpcs: string[]): Actor {
  const single: Record<string, unknown> = {
    profiles: {
      id: ID,
      display_name: "Technician",
      account_type: "professional",
      platform_role: "user",
      preferred_locale: "es",
      created_at: "2026-10-01T00:00:00.000Z",
    },
    technician_profiles: { base_location: "Madrid (MAD)" },
  };
  const client = {
    from: (table: string) => chain({ data: single[table] ?? [], error: null }),
    rpc: (name: string) => {
      rpcs.push(name);
      return Promise.resolve({
        data: name === "get_my_application_packs" ? [PACK] : [],
        error: null,
      });
    },
  } as unknown as SupabaseClient;
  return { id: ID, email: "tech@crewflex.test", client };
}

Deno.test("the export lists the professional's own Candidate Pack copies", async () => {
  const rpcs: string[] = [];
  const exported = await exportFor(professionalActor(rpcs));
  assertEquals(rpcs.includes("get_my_application_packs"), true);
  assertEquals(exported.professional?.candidatePacks, [PACK]);
});
