import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactNode } from "react";
import { URL_SITE } from "@/lib/notifications";
import { RATING_INITIAL, type Palier } from "@/lib/classement";
import { COULEUR_PALIER } from "@/lib/paliers";
import { LABEL_STATUT, type StatutPublic } from "@/lib/tournois";
import { FUSEAU_PARIS } from "@/lib/tournois-auto/creneaux";
import { disposerBracket, tronquer, type MatchImage } from "@/lib/bracket-image";

// Images de partage (28/09/2026, audit M11 / N7) : l'aperçu qui s'affiche
// quand on colle le lien d'un CV ou d'un tournoi sur Discord, X, WhatsApp
// ou LinkedIn. Aux couleurs « Venin » (src/app/globals.css) ; polices dans
// assets/polices (le générateur d'images ne lit pas le woff2).

export const TAILLE_IMAGE = { width: 1200, height: 630 };

export const COULEURS = {
  fond: "#080908",
  surface: "#131513",
  texte: "#f5f5f4",
  texte2: "#b9beb9",
  muted: "#9ca39c",
  accent: "#b6ff3b",
  ligne: "rgba(245, 245, 244, 0.12)",
  ligneForte: "rgba(245, 245, 244, 0.28)",
};

const dossier = join(process.cwd(), "assets");

// Lus une seule fois par instance du serveur.
const polices = Promise.all([
  readFile(join(dossier, "polices/big-shoulders-display-latin-900-normal.woff")),
  readFile(join(dossier, "polices/big-shoulders-display-latin-800-normal.woff")),
  readFile(join(dossier, "polices/chakra-petch-latin-500-normal.woff")),
  readFile(join(dossier, "polices/chakra-petch-latin-600-normal.woff")),
]);

const logo = readFile(join(process.cwd(), "public/brand/najarena-logo-blanc.svg")).then(
  (svg) => `data:image/svg+xml;base64,${svg.toString("base64")}`,
);

/** Options d'ImageResponse (taille, polices) et logo, à charger avant le rendu. */
export async function ressourcesImage() {
  const [[titre900, titre800, texte500, texte600], sourceLogo] = await Promise.all([polices, logo]);
  return {
    logo: sourceLogo,
    options: {
      ...TAILLE_IMAGE,
      fonts: [
        { name: "Titre", data: titre900, weight: 900 as const, style: "normal" as const },
        { name: "Titre", data: titre800, weight: 800 as const, style: "normal" as const },
        { name: "Texte", data: texte500, weight: 500 as const, style: "normal" as const },
        { name: "Texte", data: texte600, weight: 600 as const, style: "normal" as const },
      ],
    },
  };
}

/** Adresse affichée en pied d'image, sans « https:// ». */
export function adresseAffichee(chemin: string): string {
  return `${URL_SITE.replace(/^https?:\/\//, "").replace(/\/$/, "")}${chemin}`;
}

/** Taille du titre selon sa longueur, pour qu'il tienne sur une ligne. */
export function tailleTitre(texte: string, max: number, min: number, largeurUtile: number): number {
  // Big Shoulders Display en capitales : environ 0,5 em par caractère.
  const taille = Math.floor(largeurUtile / (Math.max(texte.length, 1) * 0.5));
  return Math.max(min, Math.min(max, taille));
}

/** Coche « vérifié », dessinée (aucune police ne garantit le glyphe ✓). */
export function Coche({ taille, couleur }: { taille: number; couleur: string }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24">
      <path d="M4 12.5l5 5L20 6.5" fill="none" stroke={couleur} strokeWidth={3.2} strokeLinecap="square" />
    </svg>
  );
}

/** Cadre commun : fond, logo, rubrique en haut, adresse en bas. */
export function CadreImage({
  logo: sourceLogo,
  rubrique,
  adresse,
  children,
}: {
  logo: string;
  rubrique: string;
  adresse: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "56px 72px",
        background: `radial-gradient(circle at 88% 12%, rgba(182, 255, 59, 0.10), transparent 45%), ${COULEURS.fond}`,
        color: COULEURS.texte,
        fontFamily: "Texte",
        // Seules les graisses chargées existent : sans elle, repli sur une
        // police générique.
        fontWeight: 500,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- image générée, pas une page */}
          <img src={sourceLogo} width={34} height={46} alt="" />
          <span style={{ fontFamily: "Titre", fontWeight: 900, fontSize: 40, letterSpacing: 2 }}>NAJARENA</span>
        </div>
        <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: 5, color: COULEURS.muted }}>{rubrique}</span>
      </div>

      {children}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: `2px solid ${COULEURS.ligne}`,
          paddingTop: 22,
          fontSize: 22,
          color: COULEURS.muted,
        }}
      >
        <span>{adresse}</span>
        <span style={{ letterSpacing: 3, fontWeight: 600 }}>RÉSULTATS LUS CHEZ RIOT</span>
      </div>
    </div>
  );
}

// ---------- Carte CV (joueur/[pseudo]/opengraph-image.tsx) ----------

export interface CarteProfil {
  pseudo: string;
  slug: string;
  compteVerifie: boolean;
  /** Rating arrondi ; null tant qu'aucun tournoi n'est clôturé. */
  rating: number | null;
  estClasse: boolean;
  confiance: number;
  palier: Palier | null;
  matchsVerifies: number;
  victoires: number;
}

export function ContenuCarteProfil({
  carte,
  logo,
  rubrique = "CV E-SPORT · LEAGUE OF LEGENDS",
  chemin,
}: {
  carte: CarteProfil;
  logo: string;
  /** En-tête de l'image (le certificat y met sa date). */
  rubrique?: string;
  /** Adresse affichée en pied d'image (par défaut, le CV). */
  chemin?: string;
}) {
  const couleurPalier = carte.palier ? (COULEUR_PALIER[carte.palier.nom.toLowerCase()] ?? COULEURS.muted) : COULEURS.muted;
  const defaites = carte.matchsVerifies - carte.victoires;

  return (
    <CadreImage logo={logo} rubrique={rubrique} adresse={adresseAffichee(chemin ?? `/joueur/${carte.slug}`)}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 48 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, width: 640 }}>
          {carte.compteVerifie ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: COULEURS.accent, fontSize: 22, fontWeight: 600, letterSpacing: 4 }}>
              <Coche taille={26} couleur={COULEURS.accent} />
              COMPTE RIOT VÉRIFIÉ
            </div>
          ) : (
            <div style={{ display: "flex", color: COULEURS.muted, fontSize: 22, fontWeight: 600, letterSpacing: 4 }}>
              RIOT ID NON VÉRIFIÉ
            </div>
          )}
          <span
            style={{
              fontFamily: "Titre",
              fontWeight: 900,
              fontSize: tailleTitre(carte.pseudo, 150, 72, 640),
              lineHeight: 0.9,
            }}
          >
            {carte.pseudo.toUpperCase()}
          </span>
          <span style={{ fontSize: 28, color: COULEURS.texte2 }}>
            {carte.matchsVerifies > 0
              ? `${carte.matchsVerifies} match${carte.matchsVerifies > 1 ? "s" : ""} vérifié${carte.matchsVerifies > 1 ? "s" : ""} · ${carte.victoires} V – ${defaites} D`
              : "Aucun match vérifié pour l'instant"}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
          <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: 5, color: COULEURS.muted }}>
            {carte.rating !== null ? "RATING" : "RATING DE DÉPART"}
          </span>
          <span
            style={{
              fontFamily: "Titre",
              fontWeight: 900,
              fontSize: 170,
              lineHeight: 0.8,
              color: carte.rating !== null ? COULEURS.texte : COULEURS.muted,
            }}
          >
            {String(carte.rating ?? RATING_INITIAL)}
          </span>
          {carte.palier && (
            <span style={{ fontSize: 30, fontWeight: 600, letterSpacing: 5, color: couleurPalier }}>
              {carte.palier.nom.toUpperCase()}
            </span>
          )}
          <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: 3, color: carte.estClasse ? COULEURS.accent : COULEURS.muted }}>
            {carte.estClasse ? "CONFIRMÉ" : "PROVISOIRE"} · CONFIANCE {carte.confiance} %
          </span>
        </div>
      </div>
    </CadreImage>
  );
}

// ---------- Affiche de tournoi (lol/tournois/[slug]/opengraph-image.tsx) ----------

export interface AfficheTournoi {
  slug: string;
  nom: string;
  format: string;
  capacite: number;
  region: string;
  statut: StatutPublic;
  debuteLe: string;
  bestOf: number;
  vainqueur: string | null;
  /** Matchs du bracket une fois lancé (audit N7) : les trois derniers tours sont dessinés. */
  bracket?: MatchImage[];
}

const DATE_AFFICHE = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: FUSEAU_PARIS,
});

function tailleNom(nom: string): number {
  if (nom.length <= 14) return 140;
  if (nom.length <= 20) return 110;
  if (nom.length <= 28) return 88;
  return 68;
}

/** Taille du nom dans la colonne étroite de l'affiche avec bracket. */
function tailleNomEtroit(nom: string): number {
  if (nom.length <= 10) return 84;
  if (nom.length <= 16) return 66;
  if (nom.length <= 24) return 54;
  return 44;
}

const LARGEUR_BRACKET = 600;
const HAUTEUR_BRACKET = 340;

/** Les trois derniers tours, avec leurs connecteurs (src/lib/bracket-image.ts). */
function DessinBracket({ matchs }: { matchs: MatchImage[] }) {
  const { boites, traits, colonnes } = disposerBracket(matchs, LARGEUR_BRACKET, HAUTEUR_BRACKET);
  // Chakra Petch à 18 px : 9 à 10 px par caractère (capitales comprises).
  const caracteres = Math.floor(((boites[0]?.largeur ?? 180) - 28) / 10);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, width: LARGEUR_BRACKET }}>
      <div style={{ display: "flex", position: "relative", width: LARGEUR_BRACKET, height: 18 }}>
        {colonnes.map((c) => (
          <span
            key={c.tour}
            style={{ position: "absolute", left: c.x, top: 0, fontSize: 15, fontWeight: 600, letterSpacing: 3, color: COULEURS.muted }}
          >
            {c.libelle}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", position: "relative", width: LARGEUR_BRACKET, height: HAUTEUR_BRACKET }}>
        {traits.map((t, i) => (
          <div
            key={`trait-${i}`}
            style={{ position: "absolute", left: t.x, top: t.y, width: t.largeur, height: t.hauteur, background: COULEURS.ligneForte }}
          />
        ))}
        {boites.map((b) => (
          <div
            key={`${b.match.tour}-${b.match.position}`}
            style={{
              position: "absolute",
              left: b.x,
              top: b.y,
              width: b.largeur,
              height: b.hauteur,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 2,
              padding: "0 12px",
              overflow: "hidden",
              background: COULEURS.surface,
              border: `2px solid ${COULEURS.ligne}`,
            }}
          >
            {([0, 1] as const).map((place) => (
              // Le vainqueur en clair, jamais en vert ni coché : le match a
              // pu être tranché à la main (verdict manuel, jamais « vérifié »).
              <span
                key={place}
                style={{
                  fontSize: 18,
                  whiteSpace: "nowrap",
                  fontWeight: b.match.gagnant === place ? 600 : 500,
                  color: b.match.gagnant === null || b.match.gagnant === place ? COULEURS.texte : COULEURS.muted,
                }}
              >
                {tronquer(b.match.joueurs[place] ?? "—", caracteres)}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ContenuAfficheTournoi({ affiche, logo }: { affiche: AfficheTournoi; logo: string }) {
  const enCours = ["ouvert", "checkin", "en_cours"].includes(affiche.statut);

  // Bracket lancé (audit N7) : informations à gauche, bracket à droite.
  if (affiche.bracket && affiche.bracket.length > 0) {
    return (
      <CadreImage logo={logo} rubrique="TOURNOI · LEAGUE OF LEGENDS" adresse={adresseAffichee(`/lol/tournois/${affiche.slug}`)}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, width: 416 }}>
            <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: 5, color: enCours ? COULEURS.accent : COULEURS.muted }}>
              {LABEL_STATUT[affiche.statut].toUpperCase()}
            </span>
            <span style={{ fontFamily: "Titre", fontWeight: 900, fontSize: tailleNomEtroit(affiche.nom), lineHeight: 0.92 }}>
              {affiche.nom.toUpperCase()}
            </span>
            <span style={{ fontSize: 22, color: COULEURS.texte2 }}>{DATE_AFFICHE.format(new Date(affiche.debuteLe))}</span>
            <span style={{ fontSize: 22, color: COULEURS.texte2 }}>
              {affiche.format.toUpperCase()}
              {affiche.bestOf > 1 ? ` · BO${affiche.bestOf}` : ""} · {affiche.capacite} places · {affiche.region}
            </span>
            {affiche.vainqueur && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 6 }}>
                <span style={{ fontSize: 20, fontWeight: 600, color: COULEURS.muted, letterSpacing: 3 }}>VAINQUEUR</span>
                <span style={{ fontFamily: "Titre", fontWeight: 900, fontSize: 44, lineHeight: 1 }}>
                  {tronquer(affiche.vainqueur.toUpperCase(), 18)}
                </span>
              </div>
            )}
          </div>
          <DessinBracket matchs={affiche.bracket} />
        </div>
      </CadreImage>
    );
  }

  return (
    <CadreImage logo={logo} rubrique="TOURNOI · LEAGUE OF LEGENDS" adresse={adresseAffichee(`/lol/tournois/${affiche.slug}`)}>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <span
          style={{
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: 5,
            color: enCours ? COULEURS.accent : COULEURS.muted,
          }}
        >
          {LABEL_STATUT[affiche.statut].toUpperCase()}
        </span>
        <span
          style={{
            fontFamily: "Titre",
            fontWeight: 900,
            fontSize: tailleNom(affiche.nom),
            lineHeight: 0.92,
            maxWidth: 1056,
          }}
        >
          {affiche.nom.toUpperCase()}
        </span>
        <div style={{ display: "flex", gap: 36, fontSize: 28, color: COULEURS.texte2 }}>
          <span>{DATE_AFFICHE.format(new Date(affiche.debuteLe))}</span>
          <span>
            {affiche.format.toUpperCase()}
            {affiche.bestOf > 1 ? ` · BO${affiche.bestOf}` : ""}
          </span>
          <span>
            {affiche.capacite} places · {affiche.region}
          </span>
        </div>
        {affiche.vainqueur && (
          // Pas de coche verte ici : la finale peut avoir été tranchée à la
          // main (verdict manuel, jamais présenté comme vérifié).
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 34, fontWeight: 600, marginTop: 6 }}>
            <span style={{ color: COULEURS.muted, letterSpacing: 3 }}>VAINQUEUR</span>
            <span style={{ fontFamily: "Titre", fontWeight: 900, fontSize: 48 }}>{affiche.vainqueur.toUpperCase()}</span>
          </div>
        )}
      </div>
    </CadreImage>
  );
}

/** Lien vers un profil ou un tournoi qui n'existe pas (ou plus). */
export function ContenuIntrouvable({
  logo,
  rubrique,
  titre,
  chemin,
}: {
  logo: string;
  rubrique: string;
  titre: string;
  chemin: string;
}) {
  return (
    <CadreImage logo={logo} rubrique={rubrique} adresse={adresseAffichee(chemin)}>
      <span style={{ fontFamily: "Titre", fontWeight: 900, fontSize: 110 }}>{titre}</span>
    </CadreImage>
  );
}
