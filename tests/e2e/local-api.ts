// Local E2E helpers shared by the suites: the local stack from `.env.e2e`, synthetic seed accounts
// only (docs/qa/LOCAL_ENVIRONMENT.md §4). Suites skip themselves unless the URL is local (guard.ts).
import { createClient } from "@supabase/supabase-js";

export const url = process.env.E2E_SUPABASE_URL;
export const key = process.env.E2E_SUPABASE_PUBLISHABLE_KEY;
export const LOCAL_PASSWORD = "crewflex-local-only"; // synthetic local seed only (LOCAL_ENVIRONMENT.md §4)

export interface Envelope {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: { code: string; message: string; reason?: string };
  requestId: string;
}

export const client = (token?: string) =>
  createClient(url!, key!, {
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
    auth: { persistSession: false, autoRefreshToken: false },
  });

export async function signIn(email: string): Promise<string> {
  const { data, error } = await client().auth.signInWithPassword({
    email,
    password: LOCAL_PASSWORD,
  });
  if (error || !data.session) throw new Error(`local sign-in failed: ${error?.message}`);
  return data.session.access_token;
}

export async function call(
  fn: string,
  init: {
    method?: string;
    token?: string;
    query?: Record<string, string>;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<{ status: number; body: Envelope }> {
  const target = new URL(`/functions/v1/${fn}`, url);
  for (const [k, v] of Object.entries(init.query ?? {})) target.searchParams.set(k, v);
  const res = await fetch(target, {
    method: init.method ?? "GET",
    headers: {
      ...init.headers,
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      apikey: key!,
      "Content-Type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  return { status: res.status, body: (await res.json()) as Envelope };
}
