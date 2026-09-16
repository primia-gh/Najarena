import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// Logos de tournoi/équipe (offre payante) servis depuis Supabase Storage —
// next/image exige que le domaine distant soit explicitement autorisé.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
};

// withSentryConfig ne fait qu'ajouter l'instrumentation de build — sans
// SENTRY_AUTH_TOKEN (voir .env.local), l'upload des sourcemaps est
// simplement ignoré (silent: true évite un avertissement de build inutile
// pour un porteur de projet qui ne code pas).
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
});
