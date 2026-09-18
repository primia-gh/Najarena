import Link from "next/link";
import type { Metadata } from "next";
import Badge from "@/components/ui/Badge";
import SectionTitre from "@/components/ui/SectionTitre";
import FondArene from "@/components/accueil/FondArene";
import BracketBackground from "@/components/BracketBackground";
import Reveal from "@/components/accueil/Reveal";
import { LABEL_NIVEAU, COULEUR_NIVEAU } from "@/lib/tournois";
import { RATING_INITIAL, RD_INITIAL, RD_SEUIL_CLASSEMENT } from "@/lib/classement";

export const metadata: Metadata = {
  title: "Comment ça marche — Najarena",
  description:
    "Comment un résultat de match devient une preuve sur Najarena : liaison du Riot ID, système de verdict à trois niveaux, classement Glicko-2.",
};

const ETAPES = [
  {
    n: "01",
    titre: "Lie ton Riot ID",
    texte:
      "Tu prouves que le compte t'appartient en changeant temporairement ton icône de profil — vérifié automatiquement, aucun mot de passe partagé.",
  },
  {
    n: "02",
    titre: "Rejoins un tournoi",
    texte:
      "Inscription en un clic, check-in avant le début, bracket généré automatiquement une fois les joueurs confirmés.",
  },
  {
    n: "03",
    titre: "Joue — le résultat se vérifie seul",
    texte:
      "Dès la partie terminée, Najarena cherche la partie correspondante dans l'historique Riot. Ton classement se met à jour à la clôture du tournoi.",
  },
] as const;

const NIVEAUX = [
  {
    niveau: "code_tournoi" as const,
    n: "03",
    titre: "Code de tournoi Riot",
    texte: "Lecture directe depuis un lobby officiel Riot — la preuve la plus forte possible, sans intervention humaine.",
  },
  {
    niveau: "historique" as const,
    n: "02",
    titre: "Retrouvé dans l'historique",
    texte: "La partie jouée entre les deux inscrits est retrouvée automatiquement dans l'historique Riot des deux comptes.",
  },
  {
    niveau: "manuel" as const,
    n: "01",
    titre: "Décision manuelle",
    texte: "Aucune partie correspondante trouvée : l'organisateur tranche et son motif reste affiché publiquement, pour toujours.",
  },
];

export default function CommentCaMarchePage() {
  return (
    <main className="relative min-h-screen overflow-hidden pt-28 pb-16">
      <FondArene />
      <BracketBackground />
      <div className="relative mx-auto max-w-3xl px-6">
        <Reveal>
          <span className="block font-mono text-[0.66rem] tracking-[0.22em] text-ardoise uppercase">
            Guide
          </span>
          <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight text-encre">
            Comment ça marche.
          </h1>
          <p className="mt-3 max-w-lg text-sm text-ardoise">
            Aucune capture d&apos;écran à envoyer, aucun litige à trancher entre joueurs — voici exactement
            comment un résultat devient une preuve sur Najarena.
          </p>
        </Reveal>

        <Reveal delai={0.1}>
          <section className="mt-12">
            <SectionTitre>Du premier tournoi au classement</SectionTitre>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {ETAPES.map((e) => (
                <div key={e.n} className="rounded-[3px] border border-trait border-t-[3px] border-t-sceau bg-carte p-5">
                  <span className="font-mono text-[0.64rem] tracking-[0.1em] text-sceau-texte uppercase">
                    {e.n}
                  </span>
                  <h3 className="mt-1.5 font-display text-base font-extrabold text-encre">{e.titre}</h3>
                  <p className="mt-1.5 text-sm text-ardoise">{e.texte}</p>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal delai={0.15}>
          <section className="mt-12">
            <SectionTitre>Le système de verdict</SectionTitre>
            <p className="mt-3 max-w-lg text-sm text-ardoise">
              Un match ne connaît pas son résultat tant qu&apos;il n&apos;a pas consommé un verdict — et ce
              verdict porte son propre niveau de fiabilité, affiché publiquement sur chaque match. On
              n&apos;invente jamais un résultat : en cas de doute, on escalade vers l&apos;organisateur.
            </p>
            <div className="mt-4 flex flex-col gap-2.5">
              {NIVEAUX.map((niv) => (
                <div
                  key={niv.niveau}
                  className="flex items-center gap-3.5 rounded-[3px] border border-trait bg-carte px-4 py-3.5"
                >
                  <span className={`w-6 shrink-0 font-mono text-lg font-bold ${COULEUR_NIVEAU[niv.niveau]}`}>
                    {niv.n}
                  </span>
                  <span className="text-sm text-encre">
                    {niv.titre}
                    <small className="mt-0.5 block text-[0.78rem] text-ardoise">{niv.texte}</small>
                  </span>
                  <span className="ml-auto shrink-0">
                    <Badge couleur={COULEUR_NIVEAU[niv.niveau]}>
                      {niv.niveau === "manuel" ? "Hors classement" : "Compte"}
                    </Badge>
                  </span>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal delai={0.2}>
          <section className="mt-12">
            <SectionTitre>Le classement</SectionTitre>
            <p className="mt-3 max-w-lg text-sm text-ardoise">
              Glicko-2 — pas un simple compteur de victoires. Chaque joueur a un rating (ton niveau estimé)
              et un RD, l&apos;incertitude sur ce niveau. Plus tu joues, plus le RD descend — c&apos;est ce qui
              referme le sceau de fiabilité sur ton profil. Un joueur non calibré n&apos;entre pas dans le
              classement tant que le RD n&apos;est pas descendu sous {RD_SEUIL_CLASSEMENT}.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[3px] border border-trait bg-trait sm:grid-cols-4">
              <div className="bg-carte px-4 py-5 text-center">
                <div className="font-mono text-xl font-bold text-encre">{RATING_INITIAL}</div>
                <div className="mt-1 font-mono text-[0.6rem] tracking-[0.08em] text-ardoise uppercase">
                  Rating de départ
                </div>
              </div>
              <div className="bg-carte px-4 py-5 text-center">
                <div className="font-mono text-xl font-bold text-encre">
                  {RD_INITIAL} → {RD_SEUIL_CLASSEMENT}
                </div>
                <div className="mt-1 font-mono text-[0.6rem] tracking-[0.08em] text-ardoise uppercase">
                  RD à calibrer
                </div>
              </div>
              <div className="bg-carte px-4 py-5 text-center">
                <div className="font-mono text-xl font-bold text-encre">~10</div>
                <div className="mt-1 font-mono text-[0.6rem] tracking-[0.08em] text-ardoise uppercase">
                  Matchs avant classement
                </div>
              </div>
              <div className="bg-carte px-4 py-5 text-center">
                <div className="font-mono text-xl font-bold text-encre">Jamais</div>
                <div className="mt-1 font-mono text-[0.6rem] tracking-[0.08em] text-ardoise uppercase">
                  De remise à zéro
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal delai={0.22}>
          <section className="mt-12">
            <SectionTitre>La sécurité, pas une case cochée</SectionTitre>
            <p className="mt-3 max-w-lg text-sm text-ardoise">
              Un classement n&apos;a de valeur que si personne — pas même Najarena — ne peut le
              trafiquer après coup. Ces règles ne sont pas négociables.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                {
                  titre: "Ta clé n'est jamais exposée",
                  texte: "Aucun appel à l'API Riot n'est fait depuis ton navigateur — tout passe par le serveur.",
                },
                {
                  titre: "Personne ne modifie un résultat après coup",
                  texte: "Ni un autre joueur, ni le site lui-même : l'écriture du classement est réservée à une fonction serveur, jamais au client.",
                },
                {
                  titre: "Chaque point est journalisé, pour toujours",
                  texte: "Rating avant et après chaque variation, jamais modifié — visible dans le journal des points du profil de chaque joueur.",
                },
                {
                  titre: "Chacun n'écrit que ce qui lui appartient",
                  texte: "La base de données applique des règles de sécurité au niveau de chaque ligne (RLS, sur Supabase/Postgres) : un joueur ne peut modifier que ses propres données — jamais celles d'un autre, ni son propre classement. Profils et résultats sont publics par conception ; tes messages ne sont lisibles que par toi et ton interlocuteur.",
                },
              ].map((s) => (
                <div key={s.titre} className="rounded-[3px] border border-trait border-t-[3px] border-t-sceau bg-carte p-5">
                  <h3 className="font-display text-base font-extrabold text-encre">{s.titre}</h3>
                  <p className="mt-1.5 text-sm text-ardoise">{s.texte}</p>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal delai={0.25}>
          <p className="mt-12 text-sm text-ardoise">
            Envie de voir à quoi ressemble un bracket réel ?{" "}
            <Link href="/lol/tournois/demo" className="text-encre underline underline-offset-3">
              Voir un tournoi d&apos;exemple
            </Link>
            . Une question de confiance ?{" "}
            <Link href="/faq" className="text-encre underline underline-offset-3">
              Voir la FAQ
            </Link>
            .
          </p>
        </Reveal>
      </div>
    </main>
  );
}
