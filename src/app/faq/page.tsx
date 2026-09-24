import Link from "next/link";
import type { Metadata } from "next";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";
import { JsonLd } from "@/lib/json-ld";
import { CRENEAUX } from "@/lib/tournois-auto/creneaux";

// Réponse construite à partir de la configuration réelle des tournois
// automatiques (lib/tournois-auto/creneaux.ts) : elle ne peut pas annoncer
// un horaire ou une capacité qui n'existe pas.
const QUOTIDIEN = CRENEAUX[0];

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
          reponse: `Oui : le ${QUOTIDIEN.nom}, un tournoi 1v1 ouvert à tous, chaque soir à ${QUOTIDIEN.heure} (heure de Paris) sur le serveur ${QUOTIDIEN.region}, ${QUOTIDIEN.capacite} places. Il se crée tout seul, la veille. Le check-in ouvre ${QUOTIDIEN.checkinMinutes} minutes avant le début : confirme ta présence depuis la page du tournoi (un rappel t'est envoyé si tu as activé les notifications). Sans check-in, pas de place dans le bracket. En dessous de ${QUOTIDIEN.minimumJoueurs} joueurs confirmés, le tournoi est annulé.`,
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
      "Non. L'IA n'a aucun accès aux résultats ni au classement et n'écrit jamais rien elle-même. Le seul usage aujourd'hui est l'assistant de création de tournoi, réservé aux organisateurs et disponible quand il est activé : il propose une configuration à partir d'une description, et l'organisateur valide avant de créer. La revue de match écrite (offre Elite) n'est pas générée par une IA : c'est un calcul par règles sur tes statistiques Riot.",
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
      <div className="relative px-grille *:max-w-3xl">
        <Apparition>
          <span className="block font-texte text-libelle font-medium text-muted uppercase">
            FAQ
          </span>
          <h1 className="mt-1 font-titre uppercase text-section font-black tracking-[1px] text-text hyphens-auto [overflow-wrap:anywhere]">
            Les questions de confiance.
          </h1>
          <p className="mt-3 max-w-lg text-sm text-muted">
            Les réponses que tu cherches avant de t&apos;inscrire — sans détour, et toutes vérifiées
            dans le fonctionnement réel du site.
          </p>
        </Apparition>

        <div className="mt-10 flex flex-col gap-4">
          {QUESTIONS.map((q, i) => (
            <Apparition key={q.question} delai={Math.min(i * 0.05, 0.25)}>
              <article className="rounded-[3px] border border-line border-l-[3px] border-l-accent bg-surface p-5">
                <h2 className="font-titre uppercase text-base font-extrabold text-text">{q.question}</h2>
                <p className="mt-1.5 text-sm text-muted">{q.reponse}</p>
              </article>
            </Apparition>
          ))}
        </div>

        <Apparition delai={0.1}>
          <p className="mt-12 text-sm text-muted">
            Pour aller plus loin :{" "}
            {LIENS.map((l, i) => (
              <span key={l.href}>
                {i > 0 && " · "}
                <Link href={l.href} className="text-text underline underline-offset-3">
                  {l.libelle}
                </Link>
              </span>
            ))}
            .
          </p>
        </Apparition>
      </div>
    </main>
  );
}
