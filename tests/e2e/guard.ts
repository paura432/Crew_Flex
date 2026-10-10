/**
 * Production write guard for the remote E2E suite and the synthetic-account scripts.
 *
 * Crew Flex has a single Supabase project (OD-9, resolved temporarily on 2026-10-10): every remote
 * test runs against production. Writes are therefore allowed only when BOTH hold:
 *   1. the remote target is exactly the authorized project: the ref in E2E_SUPABASE_URL equals
 *      E2E_AUTHORIZED_PROJECT_REF (and, when the repo is linked, the linked ref);
 *   2. the operator confirmed this run explicitly: E2E_WRITE_CONFIRM=WRITE:<ref>:<today UTC> was
 *      typed on the command line — it expires daily and must not be stored in `.env.e2e`.
 * `scripts/e2e/*.sh` implement the same two conditions in bash.
 */
export const PRODUCTION_REF = "sbjkzrkmcekokkqiuvvh";

export interface GuardInput {
  url?: string;
  authorizedRef?: string;
  linkedRef?: string;
  writeConfirm?: string;
  /** Raw content of `.env.e2e`, when the file exists. */
  envFileContent?: string;
  today?: Date;
}

export type GuardResult = { ok: true; ref: string } | { ok: false; reason: string };

export function projectRefOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const host = new URL(url).hostname;
    const match = /^([a-z]{20})\.supabase\.co$/.exec(host);
    return match?.[1];
  } catch {
    return undefined;
  }
}

export function expectedConfirmation(ref: string, today = new Date()): string {
  return `WRITE:${ref}:${today.toISOString().slice(0, 10)}`;
}

export function evaluateProductionGuard(input: GuardInput): GuardResult {
  const ref = projectRefOf(input.url);
  if (!ref) return { ok: false, reason: "E2E_SUPABASE_URL is not a https://<ref>.supabase.co URL" };
  if (!input.authorizedRef) {
    return {
      ok: false,
      reason: "E2E_AUTHORIZED_PROJECT_REF is required (condition 1: target identity)",
    };
  }
  if (input.authorizedRef !== ref) {
    return { ok: false, reason: "E2E_SUPABASE_URL does not belong to E2E_AUTHORIZED_PROJECT_REF" };
  }
  if (input.linkedRef && input.linkedRef !== ref) {
    return { ok: false, reason: "the linked Supabase project differs from the authorized ref" };
  }
  if (input.envFileContent && /^\s*E2E_WRITE_CONFIRM\s*=/m.test(input.envFileContent)) {
    return {
      ok: false,
      reason: "E2E_WRITE_CONFIRM must be typed per run, never stored in .env.e2e",
    };
  }
  if (input.writeConfirm !== expectedConfirmation(ref, input.today)) {
    return {
      ok: false,
      reason: `E2E_WRITE_CONFIRM=${expectedConfirmation(ref, input.today)} is required for this run (condition 2: explicit operator confirmation)`,
    };
  }
  return { ok: true, ref };
}
