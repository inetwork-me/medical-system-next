import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

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
};

export default withNextIntl(nextConfig);
