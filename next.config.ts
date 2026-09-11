import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
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
