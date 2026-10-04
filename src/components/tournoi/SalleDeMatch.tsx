import Link from "next/link";
import type { ReactNode } from "react";
import Panneau from "@/components/design/Panneau";
import LibelleSection from "@/components/design/LibelleSection";
import BoutonCopier from "@/components/design/BoutonCopier";
import { etapesMatch, etapesMatch5v5 } from "@/lib/reglement";
import { heureParis } from "@/lib/tournois-auto/creneaux";
import { formaterDate } from "@/lib/tournois";
import { DELAI_FORFAIT_MINUTES, limiteForfait } from "@/lib/forfait";
import type { ConditionVictoire } from "@/lib/conditions-1v1";
import { debutChrono } from "@/lib/chrono-match";
import ChronoMatch from "@/components/tournoi/ChronoMatch";

// Salle de match (28/09/2026, audit E9 / N1 / N2) : ce dont un joueur a
// besoin pour jouer son match sans chercher — son adversaire, son Riot ID à
// copier, qui crée la partie, les règles, l'état de la lecture du résultat.
// Affichée en haut de la page du tournoi pour les deux joueurs du match.

export type EtatSalleDeMatch = "attente_adversaire" | "a_jouer" | "litige" | "defaite_reconnue";

export interface JoueurAligne {
  pseudo: string;
  slug: string;
  riotId: string | null;
}

/** Match 5v5 (audit N21) : les deux alignements de cinq joueurs. */
export interface EquipesSalleDeMatch {
  /** Le visiteur est le capitaine de son équipe (seul à pouvoir la déclarer prête). */
  estCapitaine: boolean;
  /** Adresse de la page de l'équipe adverse, si elle existe encore. */
  slugAdverse: string | null;
  nous: JoueurAligne[];
  eux: JoueurAligne[];
}

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
  /** « Je suis prêt » de chacun (audit N4) : heure de la déclaration, ou nul. */
  pret?: { moi: string | null; adversaire: string | null };
  /** Comment on gagne une partie (audit N5). */
  condition?: ConditionVictoire;
  /** Tournoi 5v5 : `adversaire.pseudo` est alors le nom de l'équipe adverse. */
  equipes?: EquipesSalleDeMatch | null;
  /** Match programmé plus tard (scrim, audit N22). */
  aVenir?: boolean;
}

interface SalleDeMatchProps {
  infos: InfosSalleDeMatch;
  /** Reconnaître sa défaite (formulaire de la page). */
  actions?: ReactNode;
  /** Bouton « Je suis prêt » (formulaire de la page), affiché tant que le joueur ne l'est pas. */
  actionPret?: ReactNode;
}

/** Qui est prêt, et ce que ça implique (forfait automatique, audit N4). */
function EtatPret({
  pret,
  adversaire,
  actionPret,
  equipe,
}: {
  pret: { moi: string | null; adversaire: string | null };
  adversaire: string;
  actionPret?: ReactNode;
  /** 5v5 : on parle de l'équipe, déclarée prête par son capitaine. */
  equipe?: { estCapitaine: boolean } | null;
}) {
  const statut = (pretLe: string | null) =>
    pretLe ? (
      <span className="text-accent tabular-nums">prêt depuis {heureParis(pretLe)}</span>
    ) : (
      <span className="text-muted">pas encore prêt</span>
    );

  // Chronomètre (audit N1) : il part quand les deux sont prêts.
  const departChrono = debutChrono(pret);

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      <p className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>
          {equipe ? "Ton équipe" : "Toi"} : {statut(pret.moi)}
        </span>
        <span>
          {adversaire} : {statut(pret.adversaire)}
        </span>
      </p>
      {departChrono && <ChronoMatch depuis={departChrono} />}
      {equipe ? (
        <p className={`text-sm ${pret.adversaire && !pret.moi ? "text-danger" : "text-text-2"}`}>
          {pret.moi && pret.adversaire
            ? "Les deux équipes sont prêtes : lancez la partie."
            : pret.adversaire
              ? `${adversaire} est prête : ${equipe.estCapitaine ? "déclare ton équipe prête" : "ton capitaine doit déclarer l'équipe prête"} avant ${heureParis(limiteForfait(pret.adversaire).toISOString())}, sinon elle perd ce match par forfait.`
              : pret.moi
                ? `Si ${adversaire} ne se déclare pas prête avant ${heureParis(limiteForfait(pret.moi).toISOString())}, elle perd par forfait.`
                : `${equipe.estCapitaine ? "Déclare ton équipe prête" : "Ton capitaine déclare l'équipe prête"} dès que vous êtes tous les cinq devant votre jeu. Dès qu'une équipe l'est, l'autre a ${DELAI_FORFAIT_MINUTES} minutes pour le faire, sinon elle perd par forfait.`}
        </p>
      ) : pret.moi && pret.adversaire ? (
        <p className="text-sm text-text-2">Vous êtes prêts tous les deux : lancez la partie.</p>
      ) : pret.adversaire ? (
        <p role="alert" className="text-sm text-danger">
          {adversaire} est prêt : déclare-toi prêt avant{" "}
          <span className="tabular-nums">{heureParis(limiteForfait(pret.adversaire).toISOString())}</span>, sinon tu
          perds ce match par forfait.
        </p>
      ) : pret.moi ? (
        <p className="text-sm text-text-2">
          Si {adversaire} ne se déclare pas prêt avant{" "}
          <span className="tabular-nums">{heureParis(limiteForfait(pret.moi).toISOString())}</span>, il perd par forfait
          — aucun point pour personne.
        </p>
      ) : (
        <p className="text-sm text-text-2">
          Déclare-toi prêt dès que tu es devant ton jeu. Dès que l&apos;un de vous l&apos;est, l&apos;autre a{" "}
          {DELAI_FORFAIT_MINUTES} minutes pour le faire, sinon il perd par forfait.
        </p>
      )}
      {!pret.moi && actionPret}
    </div>
  );
}

/** Les cinq joueurs d'une équipe, avec leur Riot ID à copier (invitations). */
function ListeAlignee({ titre, joueurs }: { titre: string; joueurs: JoueurAligne[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-mini text-muted uppercase">{titre}</span>
      <ul className="flex flex-col gap-1.5">
        {joueurs.map((j) => (
          <li key={j.slug} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <Link
              href={`/joueur/${j.slug}`}
              className="font-semibold text-text hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {j.pseudo}
            </Link>
            {j.riotId ? (
              <>
                <span className="text-text-2 tabular-nums select-all">{j.riotId}</span>
                <BoutonCopier
                  texte={j.riotId}
                  libelle="Copier"
                  libelleAccessible={`Copier le Riot ID de ${j.pseudo}`}
                  className="inline-flex min-h-11 items-center text-mini font-semibold text-accent uppercase underline underline-offset-3"
                />
              </>
            ) : (
              <span className="text-xs text-muted">Riot ID indisponible</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SalleDeMatch({ infos, actions, actionPret }: SalleDeMatchProps) {
  const {
    tour,
    etat,
    adversaire,
    jeCreeLaPartie,
    demarreLe,
    bestOf,
    perdantDeclare,
    chances,
    pret,
    condition,
    equipes,
  } = infos;

  return (
    <Panneau as="section" className="flex flex-col gap-5 px-6 py-6 sm:px-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <LibelleSection as="h2" className="text-text">
          Ton match — {tour}
        </LibelleSection>
        {demarreLe && etat !== "attente_adversaire" && (
          <span className="text-xs text-muted tabular-nums">
            {infos.aVenir ? `Prévu le ${formaterDate(demarreLe)}` : `Ouvert à ${heureParis(demarreLe)}`}
          </span>
        )}
      </div>

      {etat === "attente_adversaire" || !adversaire ? (
        <p className="text-sm text-text-2">
          {equipes
            ? "L'équipe adverse sera connue à la fin du match précédent : les cinq joueurs seront prévenus dès que le match s'ouvre."
            : "Ton adversaire sera connu à la fin du match précédent : tu seras prévenu dès que ton match s'ouvre."}
        </p>
      ) : equipes ? (
        <>
          <div className="flex min-w-0 flex-col">
            <span className="text-mini text-muted uppercase">Équipe adverse</span>
            {equipes.slugAdverse ? (
              <Link
                href={`/equipe/${equipes.slugAdverse}`}
                className="font-titre text-2xl font-extrabold uppercase text-text hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {adversaire.pseudo}
              </Link>
            ) : (
              <span className="font-titre text-2xl font-extrabold uppercase text-text">{adversaire.pseudo}</span>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <ListeAlignee titre="Ton équipe" joueurs={equipes.nous} />
            <ListeAlignee titre="Équipe adverse" joueurs={equipes.eux} />
          </div>

          <p
            className={`text-sm ${etat === "litige" ? "text-danger" : "text-text-2"}`}
            role={etat === "litige" ? "alert" : undefined}
          >
            {etat === "a_jouer" &&
              "Le résultat est recherché automatiquement dans l'historique Riot : les dix joueurs alignés doivent être dans la partie."}
            {etat === "litige" &&
              "Partie pas encore retrouvée chez Riot : la recherche continue, et l'organisateur peut trancher. Si vous n'avez pas encore joué, jouez maintenant, avec les dix joueurs alignés."}
            {etat === "defaite_reconnue" &&
              `Défaite reconnue par le capitaine de ${perdantDeclare ?? "une équipe"} : en attente de la confirmation dans l'historique Riot (20 min au plus).`}
          </p>

          {etat !== "defaite_reconnue" && (
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed text-text-2 marker:text-accent">
              {etapesMatch5v5(jeCreeLaPartie, equipes.estCapitaine, bestOf).map((etape) => (
                <li key={etape}>{etape}</li>
              ))}
            </ol>
          )}

          {etat === "a_jouer" && pret && (
            <EtatPret
              pret={pret}
              adversaire={adversaire.pseudo}
              actionPret={equipes.estCapitaine ? actionPret : undefined}
              equipe={{ estCapitaine: equipes.estCapitaine }}
            />
          )}

          {equipes.estCapitaine && actions}
        </>
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
              {etapesMatch(adversaire.riotId, jeCreeLaPartie, bestOf, condition).map((etape) => (
                <li key={etape}>{etape}</li>
              ))}
            </ol>
          )}

          {etat === "a_jouer" && pret && (
            <EtatPret pret={pret} adversaire={adversaire.pseudo} actionPret={actionPret} />
          )}

          {actions}
        </>
      )}
    </Panneau>
  );
}
