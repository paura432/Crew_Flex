import type { NextConfig } from "next";

// Security headers for every route. CSP is intentionally not set yet: Next.js inline
// runtime scripts need a nonce-based CSP, tracked in docs/product/SECURITY_PRIVACY.md.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Every /app route depends on the user session, so Cache Components is off for V0
  // (see docs/architecture/ADR-001-foundation.md).
  cacheComponents: false,
  reactCompiler: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
