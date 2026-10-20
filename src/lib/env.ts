import { z } from "./validation/zod.ts";

// Public, non-privileged configuration only. Secrets never live in NEXT_PUBLIC_* variables.
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(20)
    .refine((key) => !key.startsWith("sb_secret_"), "A secret key must never be public"),
});

// Literal `process.env.X` accesses are required for Next.js build-time inlining.
export const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});
