import Link from "next/link";
import type { Metadata } from "next";
import FondArene from "@/components/accueil/FondArene";
import BracketBackground from "@/components/BracketBackground";
import Reveal from "@/components/accueil/Reveal";
import { JsonLd } from "@/lib/json-ld";

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
  {
    question: "Comment un résultat est-il vérifié ?",
    reponse:
      "Personne ne déclare son résultat. Najarena retrouve la partie jouée entre les deux inscrits dans l'historique Riot des deux comptes (niveau 2). En dernier recours, l'organisateur tranche : c'est un verdict de niveau 1, affiché avec son motif et jamais compté dans le classement. Le niveau 3, lu directement depuis un lobby officiel Riot, n'est pas encore actif. Le niveau de fiabilité est affiché sur chaque match.",
  },
  {
    question: "Quand mon classement est-il mis à jour ?",
    // Aligné sur vercel.json (cron recherche-resultats : "0 5 * * *").
    reponse:
      "À la clôture du tournoi, c'est-à-dire quand le résultat de la finale est enregistré. Seuls les verdicts de niveau 2 ou 3 comptent : une décision manuelle de l'organisateur est enregistrée tout de suite mais ne modifie pas le classement. La recherche automatique dans l'historique Riot ne passe aujourd'hui qu'une fois par jour, à 05:00 UTC : un résultat de niveau 2 peut donc n'apparaître que le lendemain matin. Cette valeur sera mise à jour ici si elle change.",
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
    <main className="relative min-h-screen overflow-hidden pt-28 pb-16">
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
      <FondArene />
      <BracketBackground />
      <div className="relative mx-auto max-w-3xl px-6">
        <Reveal>
          <span className="block font-mono text-[0.66rem] tracking-[0.22em] text-ardoise uppercase">
            FAQ
          </span>
          <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight text-encre">
            Les questions de confiance.
          </h1>
          <p className="mt-3 max-w-lg text-sm text-ardoise">
            Les réponses que tu cherches avant de t&apos;inscrire — sans détour, et toutes vérifiées
            dans le fonctionnement réel du site.
          </p>
        </Reveal>

        <div className="mt-10 flex flex-col gap-4">
          {QUESTIONS.map((q, i) => (
            <Reveal key={q.question} delai={Math.min(i * 0.05, 0.25)}>
              <article className="rounded-[3px] border border-trait border-l-[3px] border-l-sceau bg-carte p-5">
                <h2 className="font-display text-base font-extrabold text-encre">{q.question}</h2>
                <p className="mt-1.5 text-sm text-ardoise">{q.reponse}</p>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delai={0.1}>
          <p className="mt-12 text-sm text-ardoise">
            Pour aller plus loin :{" "}
            {LIENS.map((l, i) => (
              <span key={l.href}>
                {i > 0 && " · "}
                <Link href={l.href} className="text-encre underline underline-offset-3">
                  {l.libelle}
                </Link>
              </span>
            ))}
            .
          </p>
        </Reveal>
      </div>
    </main>
  );
}
