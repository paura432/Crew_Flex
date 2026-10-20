// The only zod entry for src/lib (Next.js and the Edge Functions that import these modules).
// zod 4 decides at schema definition whether to compile object parsers with `new Function`; under the
// CSP (T18) that probe is `unsafe-eval`, so the flag must be set before the first schema is defined.
import { z } from "zod";

z.config({ jitless: true });

export * from "zod";
