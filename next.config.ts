import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Standalone-Build für den Docker-Container (web, worker teilen den Code); auf Vercel nicht nötig.
  output: process.env.VERCEL ? undefined : "standalone",
  // Kein cacheComponents: die App ist vollständig privat und datengetrieben,
  // jede Seite wird pro Request gerendert (siehe docs/architecture.md, Abschnitt 1).
  serverExternalPackages: ["pg", "pg-boss", "pino", "@node-rs/argon2"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  headers: async () => [
    {
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ],
    },
  ],
};

export default withNextIntl(nextConfig);
