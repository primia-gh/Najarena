import Link from "next/link";
import type { ReactNode } from "react";
import Panneau from "@/components/design/Panneau";
import LibelleSection from "@/components/design/LibelleSection";
import BoutonCopier from "@/components/design/BoutonCopier";
import { etapesMatch } from "@/lib/reglement";
import { heureParis } from "@/lib/tournois-auto/creneaux";

// Salle de match (28/09/2026, audit E9 / N1 / N2) : ce dont un joueur a
// besoin pour jouer son match sans chercher — son adversaire, son Riot ID à
// copier, qui crée la partie, les règles, l'état de la lecture du résultat.
// Affichée en haut de la page du tournoi pour les deux joueurs du match.

export type EtatSalleDeMatch = "attente_adversaire" | "a_jouer" | "litige" | "defaite_reconnue";

export interface InfosSalleDeMatch {
  tour: string;
  etat: EtatSalleDeMatch;
  adversaire: { pseudo: string; slug: string; riotId: string | null } | null;
  /** Le joueur en haut du match (slot 1) crée la partie personnalisée. */
  jeCreeLaPartie: boolean;
  demarreLe: string | null;
  bestOf: number;
  perdantDeclare: string | null;
  /** Chances estimées avant le match, en % (ratings Glicko-2). */
  chances?: { moi: number; adversaire: number } | null;
}

export default function SalleDeMatch({ infos, actions }: { infos: InfosSalleDeMatch; actions?: ReactNode }) {
  const { tour, etat, adversaire, jeCreeLaPartie, demarreLe, bestOf, perdantDeclare, chances } = infos;

  return (
    <Panneau as="section" className="flex flex-col gap-5 px-6 py-6 sm:px-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <LibelleSection as="h2" className="text-text">
          Ton match — {tour}
        </LibelleSection>
        {demarreLe && etat !== "attente_adversaire" && (
          <span className="text-xs text-muted tabular-nums">Ouvert à {heureParis(demarreLe)}</span>
        )}
      </div>

      {etat === "attente_adversaire" || !adversaire ? (
        <p className="text-sm text-text-2">
          Ton adversaire sera connu à la fin du match précédent : tu seras prévenu dès que ton match s&apos;ouvre.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex min-w-0 flex-col">
              <span className="text-mini text-muted uppercase">Adversaire</span>
              <Link
                href={`/joueur/${adversaire.slug}`}
                className="font-titre text-2xl font-extrabold uppercase text-text hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {adversaire.pseudo}
              </Link>
            </div>
            {adversaire.riotId ? (
              <div className="flex min-w-0 flex-col">
                <span className="text-mini text-muted uppercase">Riot ID</span>
                <span className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold tabular-nums text-text select-all">{adversaire.riotId}</span>
                  <BoutonCopier
                    texte={adversaire.riotId}
                    libelle="Copier"
                    libelleAccessible={`Copier le Riot ID de ${adversaire.pseudo}`}
                    className="inline-flex min-h-11 items-center text-mini font-semibold text-accent uppercase underline underline-offset-3"
                  />
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted">Riot ID de ton adversaire indisponible : demande-le-lui.</p>
            )}
          </div>

          {chances && (
            <p className="text-xs text-muted tabular-nums">
              Chances estimées : toi {chances.moi} % · {adversaire.pseudo} {chances.adversaire} % — d&apos;après vos
              ratings Glicko-2 au début du tournoi, à titre indicatif.
            </p>
          )}

          <p
            className={`text-sm ${etat === "litige" ? "text-danger" : "text-text-2"}`}
            role={etat === "litige" ? "alert" : undefined}
          >
            {etat === "a_jouer" && "Le résultat est recherché automatiquement dans l'historique Riot."}
            {etat === "litige" &&
              "Partie pas encore retrouvée chez Riot : la recherche continue, et l'organisateur peut trancher. Si vous n'avez pas encore joué, jouez maintenant."}
            {etat === "defaite_reconnue" &&
              `Défaite reconnue par ${perdantDeclare ?? "un joueur"} : en attente de la confirmation dans l'historique Riot (20 min au plus).`}
          </p>

          {etat !== "defaite_reconnue" && (
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed text-text-2 marker:text-accent">
              {etapesMatch(adversaire.riotId, jeCreeLaPartie, bestOf).map((etape) => (
                <li key={etape}>{etape}</li>
              ))}
            </ol>
          )}

          {actions}
        </>
      )}
    </Panneau>
  );
}
