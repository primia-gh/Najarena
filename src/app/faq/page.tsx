import type { Metadata } from "next";
import { SEUIL_A_LA_DEMANDE } from "@/lib/a-la-demande";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";
import BoutonLien from "@/components/design/BoutonLien";
import LibelleSection from "@/components/design/LibelleSection";
import { JsonLd } from "@/lib/json-ld";
import { CRENEAUX } from "@/lib/tournois-auto/creneaux";

// Réponse construite à partir de la configuration réelle des tournois
// automatiques (lib/tournois-auto/creneaux.ts) : elle ne peut pas annoncer
// un horaire ou une capacité qui n'existe pas.
const QUOTIDIEN = CRENEAUX[0];
const COUPE_NOUVEAUX = CRENEAUX.find((c) => c.reserveNonClasses);

export const metadata: Metadata = {
  title: "FAQ — Najarena",
  description:
    "Les questions de confiance, sans détour : gratuité, affiliation à Riot Games, vérification des résultats, délais de mise à jour du classement, panne de l'API Riot, rôle de l'IA.",
};

// Chaque réponse est vérifiée dans le code ; toute modification du
// comportement décrit ici (délais, IA, verdicts) doit s'accompagner d'une
// mise à jour de cette liste. Les questions de confiance sont dépliées par
// défaut — ce sont celles qu'un visiteur méfiant cherche en premier.
const QUESTIONS = [
  {
    question: "Najarena est-il gratuit ?",
    reponse:
      "L'essentiel l'est, pour toujours : le classement, les verdicts et le profil public ne seront jamais payants. Des paliers payants (Vérifié, Elite, Organisateur) ajoutent de l'identité et du confort, jamais un péage sur la preuve. Ils sont en cours de lancement — voir la page Tarifs.",
  },
  {
    question: "Najarena est-il affilié à Riot Games ?",
    reponse:
      "Non. League of Legends et Riot Games sont des marques déposées de Riot Games, Inc. Najarena n'est ni produit, ni approuvé, ni sponsorisé par Riot Games. Le site lit les données de match fournies par l'API officielle de Riot.",
  },
  ...(QUOTIDIEN
    ? [
        {
          question: "Y a-t-il un tournoi tous les jours ?",
          reponse: `Oui : le ${QUOTIDIEN.nom}, un tournoi 1v1 ouvert à tous, chaque soir à ${QUOTIDIEN.heure} (heure de Paris) sur le serveur ${QUOTIDIEN.region}, ${QUOTIDIEN.capacite} places. Il se crée tout seul, la veille. Le check-in ouvre ${QUOTIDIEN.checkinMinutes} minutes avant le début : confirme ta présence depuis la page du tournoi (un rappel t'est envoyé si tu as activé les notifications). Sans check-in, pas de place dans le bracket. En dessous de ${QUOTIDIEN.minimumJoueurs} joueurs confirmés, le tournoi est annulé. L'heure ne te convient pas ? Indique sur la page « Tournois à la demande » quand tu es libre : dès que ${SEUIL_A_LA_DEMANDE} joueurs de ta région le sont à la même heure, un tournoi s'ouvre et vous y êtes inscrits.${COUPE_NOUVEAUX ? ` Pas encore classé ? La ${COUPE_NOUVEAUX.nom} se joue aussi chaque soir à ${COUPE_NOUVEAUX.heure}, entre joueurs qui ne le sont pas encore.` : ""}`,
        },
      ]
    : []),
  {
    question: "Comment un résultat est-il vérifié ?",
    reponse:
      "Personne ne déclare son résultat. Najarena retrouve la partie jouée entre les deux inscrits dans l'historique Riot des deux comptes (niveau 2). En dernier recours, l'organisateur tranche : c'est un verdict de niveau 1, affiché avec son motif et jamais compté dans le classement. Le niveau 3, lu directement depuis un lobby officiel Riot, n'est pas encore actif. Le niveau de fiabilité est affiché sur chaque match.",
  },
  {
    question: "Quand mon classement est-il mis à jour ?",
    // Aligné sur la tâche pg_cron « najarena-recherche-resultats » (toutes
    // les 5 minutes, docs/schema.sql) — vercel.json garde un passage
    // quotidien de secours.
    reponse:
      "À la clôture du tournoi, c'est-à-dire quand le résultat de la finale est enregistré. Seuls les verdicts de niveau 2 ou 3 comptent : une décision manuelle de l'organisateur est enregistrée tout de suite mais ne modifie pas le classement. La recherche automatique dans l'historique Riot passe toutes les 5 minutes, à partir de 8 minutes après le début du match (l'historique Riot n'est pas immédiat). Cette valeur sera mise à jour ici si elle change.",
  },
  {
    question: "Que se passe-t-il si l'API Riot est indisponible ?",
    reponse:
      "Rien n'est inventé. Si aucune partie correspondante n'est retrouvée — panne de l'API comprise —, le match passe en litige (25 minutes après son début, au passage suivant de la recherche automatique) et l'organisateur tranche : verdict de niveau 1, affiché avec son motif, hors classement. Le tournoi peut continuer, mais sans effet sur les ratings tant que les données Riot manquent.",
  },
  {
    question: "L'intelligence artificielle peut-elle toucher à mon classement ?",
    reponse:
      "Non. L'IA n'écrit jamais de résultat ni de point : elle rédige seulement des textes d'aide, à la demande (ou, pour l'analyse des parties d'un abonné Elite, automatiquement après chaque partie vérifiée), à partir de données déjà vérifiées. Quatre usages, disponibles quand ils sont activés : l'assistant de création de tournoi (l'organisateur valide avant de créer), l'analyse détaillée d'un match (offre Elite, à partir des seuls chiffres Riot du match, en plus de la revue par règles), le dossier de litige (il rassemble les faits pour l'organisateur et ne désigne jamais de vainqueur : la décision reste humaine) et la recherche de joueurs en langage naturel (offre Organisateur : l'IA traduit la demande en filtres, la recherche ne porte que sur des comptes vérifiés).",
  },
  {
    question: "Mes parties classées comptent-elles pour le classement Najarena ?",
    reponse:
      "Jamais. Si tu le demandes, Najarena lit tes parties classées chez Riot pour ton bilan (niveau, hygiène de jeu, carte des morts, sang-froid) : elles restent visibles de toi seul et ne touchent jamais ton rating, qui ne dépend que des tournois. Tu peux arrêter à tout moment, et elles sont alors effacées.",
  },
  {
    question: "Les pronostics, c'est des paris ?",
    reponse:
      "Non. Les pronostics sont gratuits : aucune mise, aucun gain, aucune récompense. Tu désignes le vainqueur des demi-finales et des finales d'un tournoi en cours ; une demi-finale juste vaut 1 point, une finale 2 points, dans un classement des pronostiqueurs par saison. Seul un résultat lu chez Riot compte (un forfait ou une décision manuelle annule le pronostic), et les pronostics ferment dès qu'un joueur se déclare prêt. Les joueurs du tournoi et son organisateur ne pronostiquent pas.",
  },
  {
    question: "Qui peut modifier un résultat ou un classement ?",
    reponse:
      "Ni les joueurs, ni le site depuis ton navigateur : le classement n'est écrit que par des fonctions serveur, jamais par le client. Chaque variation de points est journalisée (rating avant et après) et visible dans le journal des points du profil de chaque joueur. Un verdict manuel garde toujours son motif affiché.",
  },
  {
    question: "Où sont hébergées mes données ?",
    reponse:
      "Dans une base Supabase située dans l'Union européenne (région Paris). Le détail des destinataires de tes données et de tes droits figure dans la politique de confidentialité.",
  },
] as const;

const LIENS = [
  { href: "/comment-ca-marche", libelle: "Comment ça marche" },
  { href: "/tarifs", libelle: "Tarifs" },
  { href: "/mentions-legales", libelle: "Mentions légales" },
  { href: "/confidentialite", libelle: "Confidentialité" },
];

export default function FaqPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: QUESTIONS.map((q) => ({
            "@type": "Question",
            name: q.question,
            acceptedAnswer: { "@type": "Answer", text: q.reponse },
          })),
        }}
      />
      <FondEcailles />
      {/* Revue visuelle du 09/10/2026 : onze cartes à liseré vert et réponses
          en 14 px deviennent une liste numérotée séparée par des filets,
          réponses en texte courant (MASTER §3, 17–20 px). Textes inchangés. */}
      <div className="relative flex flex-col gap-14 px-grille *:max-w-3xl">
        <Apparition>
          <LibelleSection>FAQ</LibelleSection>
          <h1 className="mt-4 font-titre text-section font-black tracking-[1px] uppercase">Les questions de confiance.</h1>
          <p className="mt-6 text-courant text-text-2">
            Les réponses que tu cherches avant de t&apos;inscrire — sans détour, et toutes vérifiées dans le fonctionnement
            réel du site.
          </p>
        </Apparition>

        <ol className="flex flex-col border-b border-line">
          {QUESTIONS.map((q, i) => (
            <li key={q.question} className="border-t border-line py-8">
              <Apparition delai={Math.min(i * 0.04, 0.2)} className="grid gap-x-6 gap-y-3 sm:grid-cols-[3rem_minmax(0,1fr)]">
                <span aria-hidden="true" className="font-titre text-3xl leading-none font-black text-faint tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex flex-col gap-3">
                  <h2 className="font-titre text-2xl leading-none font-black uppercase">{q.question}</h2>
                  <p className="text-courant text-text-2">{q.reponse}</p>
                </div>
              </Apparition>
            </li>
          ))}
        </ol>

        <Apparition className="flex flex-col gap-4">
          <LibelleSection>Pour aller plus loin</LibelleSection>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            {LIENS.map((l) => (
              <BoutonLien key={l.href} href={l.href} variante="secondaire">
                {l.libelle}
              </BoutonLien>
            ))}
          </div>
        </Apparition>
      </div>
    </main>
  );
}
