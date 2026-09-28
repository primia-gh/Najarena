import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// Logos de tournoi/équipe (offre payante) servis depuis Supabase Storage —
// next/image exige que le domaine distant soit explicitement autorisé.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

// En-têtes de sécurité (audit F2) : le site ne peut pas être affiché dans
// la page d'un autre site (hameçonnage par superposition), le navigateur
// ne devine pas le type d'un fichier, l'adresse complète des pages n'est
// pas transmise aux sites extérieurs, et caméra, micro et position sont
// refusés d'office. Pas de politique de contenu complète : elle exigerait
// de lister chaque service tiers (Stripe, Supabase, Sentry, Vercel) et
// casserait le site au moindre oubli.
const ENTETES_SECURITE = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: ENTETES_SECURITE }];
  },
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
