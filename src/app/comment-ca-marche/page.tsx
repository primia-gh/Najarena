import type { Metadata } from "next";
import type { ReactNode } from "react";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";
import BoutonLien from "@/components/design/BoutonLien";
import Icone, { type NomIcone } from "@/components/design/Icone";
import LibelleSection from "@/components/design/LibelleSection";
import { RATING_INITIAL, RD_INITIAL, RD_SEUIL_CLASSEMENT } from "@/lib/classement";
import { JOUEURS_MIN_TOURNOI_CLASSE, PREAVIS_TOURNOI_CLASSE_HEURES } from "@/lib/tournoi-classe";

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
      "Inscription en un clic une fois ton compte Riot vérifié, check-in avant le début, bracket généré automatiquement une fois les joueurs confirmés.",
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

const TOURNOIS_CLASSES = [
  {
    titre: "Tournois officiels",
    texte: "Les tournois quotidiens créés par Najarena, ouverts à tous, sont toujours classés.",
  },
  {
    titre: "Tournois d'organisateurs",
    texte: `Classés s'ils réunissent au moins ${JOUEURS_MIN_TOURNOI_CLASSE} joueurs au départ, ont été publiés au moins ${PREAVIS_TOURNOI_CLASSE_HEURES} h avant leur début, et si leur organisateur ne joue pas dedans. Un organisateur peut aussi déclarer son tournoi amical : aucun point en jeu.`,
  },
];

const SECURITE: { icone: NomIcone; titre: string; texte: string }[] = [
  {
    icone: "cadenas",
    titre: "Ta clé n'est jamais exposée",
    texte: "Aucun appel à l'API Riot n'est fait depuis ton navigateur — tout passe par le serveur.",
  },
  {
    icone: "bouclier",
    titre: "Personne ne modifie un résultat après coup",
    texte:
      "Ni un autre joueur, ni le site lui-même : l'écriture du classement est réservée à une fonction serveur, jamais au client.",
  },
  {
    icone: "coche",
    titre: "Chaque point est journalisé, pour toujours",
    texte:
      "Rating avant et après chaque variation, jamais modifié — visible dans le journal des points du profil de chaque joueur. Chaque ligne est scellée par une empreinte qui dépend de la précédente : le registre des points (/registre) peut être vérifié par n'importe qui, et son empreinte est publiée chaque soir sur Discord.",
  },
  {
    icone: "joueur",
    titre: "Chacun n'écrit que ce qui lui appartient",
    texte:
      "La base de données applique des règles de sécurité au niveau de chaque ligne (RLS, sur Supabase/Postgres) : un joueur ne peut modifier que ses propres données — jamais celles d'un autre, ni son propre classement. Profils et résultats sont publics par conception ; tes messages ne sont lisibles que par toi et ton interlocuteur.",
  },
];

// Mise en page éditoriale (revue visuelle du 05/10/2026) : chaque partie
// numérotée, son titre à gauche et le texte à droite sur grand écran,
// texte courant en 17–20 px. Les textes sont inchangés ; les huit cartes
// à liseré vert deviennent des filets (MASTER §5 : « préférer les
// séparateurs aux boîtes »), le vert reste aux numéros et à « Compte ».
function Partie({
  numero,
  libelle,
  titre,
  id,
  delai,
  children,
}: {
  numero: string;
  libelle: string;
  titre: string;
  id: string;
  delai: number;
  children: ReactNode;
}) {
  return (
    <Apparition delai={delai}>
      <section
        id={id}
        aria-labelledby={`${id}-titre`}
        className="grid scroll-mt-28 gap-6 border-t border-line-strong pt-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-16"
      >
        <div className="flex flex-col gap-4">
          <LibelleSection numero={numero}>{libelle}</LibelleSection>
          <h2 id={`${id}-titre`} className="font-titre text-[clamp(2rem,3vw,2.75rem)] leading-[0.95] font-black uppercase">
            {titre}
          </h2>
        </div>
        <div className="flex min-w-0 flex-col gap-6">{children}</div>
      </section>
    </Apparition>
  );
}

export default function CommentCaMarchePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-16 px-grille">
        <Apparition>
          <LibelleSection>Guide</LibelleSection>
          <h1 className="mt-4 font-titre text-section font-black tracking-[1px] uppercase">Comment ça marche.</h1>
          <p className="mt-6 max-w-2xl text-courant text-text-2">
            Aucune capture d&apos;écran à envoyer, aucun litige à trancher entre joueurs — voici exactement comment un
            résultat devient une preuve sur Najarena.
          </p>
        </Apparition>

        <Partie numero="01" libelle="Parcours" titre="Du premier tournoi au classement" id="parcours" delai={0.05}>
          <ol className="grid gap-8 md:grid-cols-3">
            {ETAPES.map((e) => (
              <li key={e.n} className="flex flex-col gap-3">
                <span className="font-titre text-5xl leading-none font-black text-faint tabular-nums">{e.n}</span>
                <h3 className="font-titre text-2xl leading-none font-black uppercase">{e.titre}</h3>
                <p className="text-text-2">{e.texte}</p>
              </li>
            ))}
          </ol>
        </Partie>

        <Partie numero="02" libelle="Verdict" titre="Le système de verdict" id="verdict" delai={0.08}>
          <p className="max-w-2xl text-courant text-text-2">
            Un match ne connaît pas son résultat tant qu&apos;il n&apos;a pas consommé un verdict — et ce verdict porte son
            propre niveau de fiabilité, affiché publiquement sur chaque match. On n&apos;invente jamais un résultat : en cas
            de doute, on escalade vers l&apos;organisateur.
          </p>
          <ul className="flex flex-col">
            {NIVEAUX.map((niv) => {
              const compte = niv.niveau !== "manuel";
              return (
                <li
                  key={niv.niveau}
                  className="grid grid-cols-[3rem_minmax(0,1fr)] items-start gap-x-4 gap-y-2 border-b border-line py-5 sm:grid-cols-[3rem_minmax(0,1fr)_auto]"
                >
                  <span
                    className={`font-titre text-4xl leading-none font-black tabular-nums ${compte ? "text-accent" : "text-faint"}`}
                  >
                    {niv.n}
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="font-semibold">{niv.titre}</span>
                    <span className="text-sm text-text-2">{niv.texte}</span>
                  </span>
                  <span
                    className={`col-start-2 inline-flex items-center gap-1.5 font-texte text-mini font-semibold whitespace-nowrap uppercase sm:col-start-auto ${
                      compte ? "text-accent" : "text-muted"
                    }`}
                  >
                    {compte ? (
                      <>
                        <Icone nom="coche" taille={13} epaisseur={3} />
                        Compte au classement
                      </>
                    ) : (
                      <>
                        <Icone nom="crayon" taille={13} />
                        Hors classement
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </Partie>

        <Partie numero="03" libelle="Classement" titre="Le classement" id="classement" delai={0.08}>
          <p className="max-w-2xl text-courant text-text-2">
            Glicko-2 — pas un simple compteur de victoires. Chaque joueur a un rating (ton niveau estimé) et un RD,
            l&apos;incertitude sur ce niveau. Plus tu joues, plus le RD descend — c&apos;est ce qui fait monter l&apos;indice
            de confiance de ton profil, jusqu&apos;à « Confirmé ». Un joueur non calibré n&apos;entre pas dans le classement
            tant que le RD n&apos;est pas descendu sous {RD_SEUIL_CLASSEMENT}.
          </p>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-8 border-t border-line pt-8 sm:grid-cols-4">
            {[
              { valeur: String(RATING_INITIAL), libelle: "Rating de départ" },
              { valeur: `${RD_INITIAL} → ${RD_SEUIL_CLASSEMENT}`, libelle: "RD à calibrer" },
              { valeur: "~10", libelle: "Matchs avant classement" },
              { valeur: "Jamais", libelle: "De remise à zéro" },
            ].map((c) => (
              <div key={c.libelle} className="flex flex-col gap-2">
                <dt className="font-texte text-mini font-medium text-faint uppercase">{c.libelle}</dt>
                <dd className="font-titre text-4xl leading-none font-black tabular-nums">{c.valeur}</dd>
              </div>
            ))}
          </dl>
        </Partie>

        <Partie numero="04" libelle="Tournois classés" titre="Quels tournois comptent" id="tournois-classes" delai={0.08}>
          <p className="max-w-2xl text-courant text-text-2">
            Une partie vérifiée prouve qui a gagné, pas que la rencontre était loyale : quatre amis qui s&apos;arrangent
            dans un tournoi créé la veille joueraient de vraies parties. Seuls les tournois « classés » rapportent donc
            des points. Chaque page de tournoi affiche ces critères, et la base de données les applique à la clôture —
            personne ne peut les contourner, pas même l&apos;organisateur.
          </p>
          <div className="grid gap-8 border-t border-line pt-8 md:grid-cols-2">
            {TOURNOIS_CLASSES.map((t) => (
              <div key={t.titre} className="flex flex-col gap-2">
                <h3 className="font-titre text-2xl leading-none font-black uppercase">{t.titre}</h3>
                <p className="text-text-2">{t.texte}</p>
              </div>
            ))}
          </div>
          <div className="flex max-w-2xl flex-col gap-3 text-sm text-muted">
            <p>
              Dans tous les cas, seuls les matchs vérifiés dans la donnée Riot comptent, et au-delà de 3 victoires contre
              le même adversaire en 24 h, les suivantes sont ignorées.
            </p>
            <p>
              Les tournois 5v5 ne comptent jamais au classement individuel : un résultat d&apos;équipe ne dit pas le niveau
              de chacun. Ils sont vérifiés de la même façon — la partie doit réunir les dix joueurs inscrits, chaque équipe
              de son côté — et s&apos;inscrivent au palmarès de l&apos;équipe et au parcours de chaque joueur aligné.
            </p>
          </div>
        </Partie>

        <Partie numero="05" libelle="Sécurité" titre="La sécurité, pas une case cochée" id="securite" delai={0.08}>
          <p className="max-w-2xl text-courant text-text-2">
            Un classement n&apos;a de valeur que si personne — pas même Najarena — ne peut le trafiquer après coup. Ces
            règles ne sont pas négociables.
          </p>
          <ul className="grid gap-8 border-t border-line pt-8 md:grid-cols-2">
            {SECURITE.map((s) => (
              <li key={s.titre} className="flex gap-4">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-bouton border border-line-strong">
                  <Icone nom={s.icone} taille={18} />
                </span>
                <span className="flex flex-col gap-2">
                  <span className="font-semibold">{s.titre}</span>
                  <span className="text-sm text-text-2">{s.texte}</span>
                </span>
              </li>
            ))}
          </ul>
        </Partie>

        <Apparition className="flex flex-wrap items-center gap-x-10 gap-y-3 border-t border-line-strong pt-10">
          <BoutonLien href="/lol/tournois/demo" variante="secondaire">
            Voir un tournoi d&apos;exemple
          </BoutonLien>
          <BoutonLien href="/faq" variante="secondaire">
            Une question de confiance ? La FAQ
          </BoutonLien>
        </Apparition>
      </div>
    </main>
  );
}
