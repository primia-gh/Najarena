import Link from "next/link";
import type { Metadata } from "next";
import { DATE_CGU_LISIBLE } from "@/lib/cgu";
import { JOUEURS_MIN_TOURNOI_CLASSE, PREAVIS_TOURNOI_CLASSE_HEURES } from "@/lib/tournoi-classe";
import { DELAI_FORFAIT_MINUTES } from "@/lib/forfait";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation — Najarena",
  description: "Conditions générales d'utilisation du site Najarena.",
};

export default function CguPage() {
  return (
    <main className="px-grille *:max-w-3xl pt-32 pb-24 font-texte text-text">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
      >
        Najarena
      </Link>

      <h1 className="mt-6 font-titre uppercase text-section font-black tracking-[1px] text-text hyphens-auto [overflow-wrap:anywhere]">
        Conditions générales d&apos;utilisation
      </h1>
      <p className="mt-2 text-sm text-muted">Version du {DATE_CGU_LISIBLE}.</p>

      <div className="mt-8 flex flex-col gap-8 text-sm leading-relaxed text-text">
        <section>
          <h2 className="font-titre uppercase text-lg font-extrabold tracking-tight text-text">
            1. Objet
          </h2>
          <p className="mt-2 text-muted">
            Najarena est une plateforme d&apos;organisation de tournois
            League of Legends. Les résultats affichés sont lus dans la
            donnée officielle Riot Games dès que cela est techniquement
            possible ; en attendant, ils peuvent reposer sur une décision
            manuelle de l&apos;organisateur, clairement signalée comme telle
            et exclue du calcul du classement.
          </p>
        </section>

        <section>
          <h2 className="font-titre uppercase text-lg font-extrabold tracking-tight text-text">
            2. Accès au service
          </h2>
          <p className="mt-2 text-muted">
            L&apos;inscription est ouverte aux personnes d&apos;au moins 15
            ans, conformément au seuil de consentement numérique fixé par la
            réglementation française. Un utilisateur de moins de 15 ans doit
            obtenir l&apos;autorisation de son représentant légal avant de
            créer un compte.
          </p>
          <p className="mt-2 text-muted">
            Chaque personne ne peut détenir qu&apos;un seul compte. Les
            informations fournies à l&apos;inscription (pseudo, e-mail)
            doivent être exactes.
          </p>
        </section>

        <section>
          <h2 className="font-titre uppercase text-lg font-extrabold tracking-tight text-text">
            3. Riot ID et vérification
          </h2>
          <p className="mt-2 text-muted">
            Tant que la connexion officielle Riot (RSO) n&apos;est pas
            disponible, la possession d&apos;un compte Riot est vérifiée en
            demandant au joueur de modifier temporairement son icône de
            profil en jeu. Un Riot ID ne peut être lié qu&apos;à un seul
            compte Najarena à la fois.
          </p>
        </section>

        <section>
          <h2 className="font-titre uppercase text-lg font-extrabold tracking-tight text-text">
            4. Tournois, inscriptions et check-in
          </h2>
          <p className="mt-2 text-muted">
            Un tournoi affiche un statut public (ouvert, check-in, en cours,
            terminé, annulé). S&apos;inscrire demande un compte Riot vérifié
            dans la région du tournoi. Dès la première inscription, les règles du
            tournoi (capacité, format, dates) sont figées. Un joueur qui ne
            confirme pas sa présence lors du check-in peut être exclu du
            bracket par l&apos;organisateur. Un forfait ne rapporte aucun
            point à aucun des deux joueurs.
          </p>
          <p className="mt-2 text-muted">
            Chaque joueur se déclare prêt dans la salle de match. Dès que
            l&apos;un des deux l&apos;a fait, l&apos;autre dispose de{" "}
            {DELAI_FORFAIT_MINUTES} minutes pour faire de même ; à défaut, il
            perd le match par forfait. Aucun forfait n&apos;est prononcé
            contre un joueur déjà en partie à ce moment-là.
          </p>
          <p className="mt-2 text-muted">
            Un joueur peut en défier un autre, en une partie : le défi
            accepté devient un duel arbitré par Najarena, dont le résultat
            est lu de la même façon. Entre deux mêmes joueurs, un seul défi
            par période de 24 heures compte au classement ; un défi sans
            partie retrouvée dans les 24 heures est annulé.
          </p>
        </section>

        <section>
          <h2 className="font-titre uppercase text-lg font-extrabold tracking-tight text-text">
            5. Système de verdict et classement
          </h2>
          <p className="mt-2 text-muted">
            Chaque match affiche publiquement le niveau de fiabilité de son
            verdict : code de tournoi Riot ou historique retrouvé (comptent
            pour le classement), ou décision manuelle de l&apos;organisateur
            avec son motif (ne compte pas pour le classement). Najarena
            n&apos;invente jamais un résultat ; en cas de doute, la décision
            revient à l&apos;organisateur du tournoi.
          </p>
          <p className="mt-2 text-muted">
            Le classement est calculé selon la méthode Glicko-2, à la
            clôture de chaque tournoi. Chaque variation de points est
            journalisée publiquement et de façon permanente.
          </p>
          <p className="mt-2 text-muted">
            Seuls les tournois classés rapportent des points : les tournois
            officiels de Najarena, et les tournois d&apos;organisateurs qui
            réunissent au moins {JOUEURS_MIN_TOURNOI_CLASSE} joueurs au
            départ, publiés au moins {PREAVIS_TOURNOI_CLASSE_HEURES} h avant
            leur début, sans leur organisateur dans le bracket et non
            déclarés amicaux. Ces critères sont affichés sur la page de
            chaque tournoi.
          </p>
        </section>

        <section>
          <h2 className="font-titre uppercase text-lg font-extrabold tracking-tight text-text">
            6. Comportement attendu
          </h2>
          <p className="mt-2 text-muted">
            Chaque utilisateur s&apos;engage à jouer les matchs auxquels il
            s&apos;inscrit avec loyauté, et à ne pas tenter de manipuler un
            résultat ou un classement. Najarena se réserve le droit de
            suspendre un compte en cas de manquement manifeste, après examen
            par un administrateur. Le motif est communiqué au joueur par
            e-mail ; il peut contester la décision à l&apos;adresse indiquée
            dans les mentions légales. Un compte suspendu ne peut plus se
            connecter ni s&apos;inscrire aux tournois ; ses résultats déjà
            enregistrés restent affichés.
          </p>
        </section>

        <section>
          <h2 className="font-titre uppercase text-lg font-extrabold tracking-tight text-text">
            7. Responsabilité
          </h2>
          <p className="mt-2 text-muted">
            Najarena n&apos;est ni édité, ni approuvé, ni sponsorisé par Riot
            Games. Le service dépend de la disponibilité de l&apos;API Riot
            Games, sur laquelle Najarena n&apos;a pas de contrôle direct.
          </p>
        </section>

        <section>
          <h2 className="font-titre uppercase text-lg font-extrabold tracking-tight text-text">
            8. Résiliation
          </h2>
          <p className="mt-2 text-muted">
            Un utilisateur peut demander la suppression de son compte à tout
            moment en écrivant à l&apos;adresse de contact indiquée dans les{" "}
            <Link href="/mentions-legales" className="text-text underline underline-offset-3">
              mentions légales
            </Link>
            . Le journal public des points reste conservé après suppression
            d&apos;un compte, conformément au principe de classement
            incontestable.
          </p>
        </section>

        <section>
          <h2 className="font-titre uppercase text-lg font-extrabold tracking-tight text-text">
            9. Droit applicable
          </h2>
          <p className="mt-2 text-muted">
            Les présentes conditions sont soumises au droit français. Tout
            litige relève des tribunaux français compétents.
          </p>
        </section>
      </div>
    </main>
  );
}
