import type { ReactNode } from "react";
import Icone from "@/components/design/Icone";
import { LABEL_NIVEAU, type NiveauVerdict } from "@/lib/tournois";

// Badges de la nouvelle identité (MASTER §6).

// whitespace-nowrap : un badge ne se coupe jamais sur deux lignes
// (ui-ux-pro-max, « compact label overflow »).
const TEXTE_BADGE = "whitespace-nowrap font-texte text-mini font-semibold uppercase";

/** « ✓ VÉRIFIÉ » vert, sans fond — profil vérifié, résultat vérifié. */
export function BadgeVerifie({ children = "Vérifié", className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-accent ${TEXTE_BADGE} ${className}`}>
      <Icone nom="coche" taille={12} epaisseur={3} />
      {children}
    </span>
  );
}

/**
 * Niveau de fiabilité d'un verdict (CLAUDE.md §3), affiché sur chaque match.
 * Niveaux 3 et 2 (code tournoi, historique) : « VÉRIFIÉ » vert + source.
 * Niveau 1 (décision manuelle) : jamais vert, jamais « vérifié » — gris,
 * avec une icône de plume, car il ne compte pas pour le classement.
 * `compact` (bracket, espaces étroits) : « ✓ CODE TOURNOI » / « ✓ HISTORIQUE »
 * sans le mot « vérifié » — la source reste visible pour tous, jamais cachée
 * dans une infobulle que seuls les utilisateurs à la souris verraient
 * (ui-ux-pro-max : pas d'information réservée au survol).
 */
export function BadgeVerdict({
  niveau,
  compact = false,
  className = "",
}: {
  niveau: NiveauVerdict;
  compact?: boolean;
  className?: string;
}) {
  const source = LABEL_NIVEAU[niveau];

  if (niveau === "manuel") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-muted ${TEXTE_BADGE} ${className}`}
      >
        <Icone nom="crayon" taille={12} epaisseur={2.2} />
        {source}
        <span className="sr-only"> — décision de l&apos;organisateur, ne compte pas pour le classement</span>
      </span>
    );
  }

  return (
    <BadgeVerifie className={className}>
      {compact ? (
        <>
          <span className="sr-only">Vérifié — </span>
          {source}
        </>
      ) : (
        <>
          Vérifié <span className="text-muted">· {source}</span>
        </>
      )}
    </BadgeVerifie>
  );
}

/** « EN DIRECT » : fond vert, point noir qui pulse. */
export function BadgeEnDirect({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-bouton bg-accent px-2 py-1 text-on-accent ${TEXTE_BADGE} font-bold ${className}`}
    >
      <span className="h-1.5 w-1.5 animate-pulsation rounded-full bg-on-accent" aria-hidden="true" />
      En direct
    </span>
  );
}

/** « CHERCHE UNE ÉQUIPE » : fond vert, texte noir. */
export function BadgeChercheEquipe({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-bouton bg-accent px-2.5 py-[5px] text-on-accent ${TEXTE_BADGE} ${className}`}>
      Cherche une équipe
    </span>
  );
}
