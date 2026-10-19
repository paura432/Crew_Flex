// Serves ONE Edge Function handler from an exact commit's worktree on its own port (compat harness).
const { handler } = await import(Deno.env.get("FN_ENTRY")!);
Deno.serve({ port: Number(Deno.env.get("PORT")), hostname: "127.0.0.1", onListen() {} }, handler);
