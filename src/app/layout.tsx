import type { Metadata } from "next";
import { Big_Shoulders, Chakra_Petch } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Footer from "@/components/Footer";
import Navbar from "@/components/design/Navbar";
import "./globals.css";

// Polices de l'identité « Venin » (design-system/najarena/MASTER.md §3).
// "Big Shoulders Display" a été fusionné par Google dans la famille
// variable "Big Shoulders" : l'axe opsz est calé sur 72 (= la coupe
// Display) dans globals.css, --font-titre.
const bigShoulders = Big_Shoulders({
  variable: "--font-big-shoulders",
  subsets: ["latin"],
  axes: ["opsz"],
  // Avertissement « Failed to find font override values » en dev : Next
  // ne connaît pas encore les métriques de cette famille récente et ne
  // génère donc pas de police de repli ajustée. Sans effet visuel.
});

const chakraPetch = Chakra_Petch({
  variable: "--font-chakra-petch",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// À définir avec le vrai domaine avant mise en production (voir
// .env.local) — repli sur localhost en dev, jamais un domaine inventé.
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: "Najarena — Ton niveau, vérifié.",
  description:
    "Tournois League of Legends en 1v1, quotidiens. Les résultats sont lus dans la donnée officielle Riot : un classement incontestable, un profil joueur vérifié.",
  openGraph: {
    siteName: "Najarena",
    locale: "fr_FR",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${bigShoulders.variable} ${chakraPetch.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-texte">
        {/* Lien d'évitement : premier élément atteint au clavier, il saute la
            barre de navigation (vérification ui-ux-pro-max, « skip links »). */}
        <a
          href="#contenu"
          className="sr-only z-50 rounded-bouton bg-accent font-texte text-sm font-bold text-on-accent uppercase focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:px-4 focus:py-3"
        >
          Aller au contenu
        </a>
        <Navbar />
        <div id="contenu" tabIndex={-1} className="outline-none" />
        {children}
        <Footer />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
