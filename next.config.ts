import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// `npm run build:pages` → static export for GitHub Pages (plain files under a base path, no server).
const staticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  // cacheComponents / partialPrefetching (create-next-app defaults) are off for now: next-intl reads the
  // request locale dynamically, and the app runs on mock data. Revisit when a real backend lands.
  // The floating dev-tools bubble sits on top of the bottom nav / RTL "More" tab; keep it off.
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Security headers on every response of the server build (the static export has no server to send them).
  // Content-Security-Policy and Strict-Transport-Security depend on the request (nonce, https): src/proxy.ts sets them.
  ...(staticExport
    ? {}
    : {
        async headers() {
          return [
            {
              source: "/:path*",
              headers: [
                { key: "X-Frame-Options", value: "DENY" },
                { key: "X-Content-Type-Options", value: "nosniff" },
                { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
              ],
            },
          ]
        },
      }),
  ...(staticExport
    ? {
        output: "export" as const,
        basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
        // /en/patients/ → /en/patients/index.html (GitHub Pages serves a folder's index.html)
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

export default withNextIntl(nextConfig);
