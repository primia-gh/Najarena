import type { CSSProperties, ReactNode } from "react";
import { RATING_INITIAL, RD_INITIAL, RD_SEUIL_CLASSEMENT } from "@/lib/classement";
import {
  MATCH_SEUIL_ILLUSTRATION,
  MATCHS_ILLUSTRATION,
  RD_MAX_ILLUSTRATION,
  rdIllustration,
} from "@/lib/schemas-calibration";

// Schémas explicatifs (étape 2 du plan « site plus visuel », validés par le
// porteur le 26/11/2026) : ils remplacent des paragraphes par une image.
// À placer DANS un Apparition : chaque élément apparaît une seule fois, en
// cascade, quand le bloc entre à l'écran (globals.css : .etape-schema,
// .trace, .trace-v), en moins de 3 s, puis plus rien ne bouge. Sans
// JavaScript ou avec « réduire les animations » : schéma fini d'emblée.
// Rendus par le serveur, sans bibliothèque. Le vert ne marque que ce qui
// est vérifié et compte au classement ; le manuel est gris ; la retouche
// du registre est rouge (erreur).

function delai(s: number): CSSProperties {
  return { ["--delai" as string]: `${s}s` };
}

// ---------------------------------------------------------------------------
// 1. Le trajet d'un résultat
// ---------------------------------------------------------------------------

const TRAIT = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const ICONES_TRAJET: ReactNode[] = [
  <path key="0" {...TRAIT} d="M3 6h18v11H3zM9 21h6" />,
  <g key="1" {...TRAIT}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="M15 15l5 5" />
  </g>,
  <path key="2" {...TRAIT} strokeWidth={2.6} d="M5 12.5l4.5 4.5L19 7.5" />,
  <path key="3" {...TRAIT} d="M6 3h12M6 21h12M7 3c0 5 10 8 10 18M17 3c0 5-10 8-10 18" />,
  <path key="4" {...TRAIT} d="M3 18l6-7 4 3 8-10" />,
  <g key="5" {...TRAIT}>
    <rect x="5" y="10.5" width="14" height="10" rx="1.5" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </g>,
];

const ETAPES_TRAJET = [
  { titre: "Partie jouée", texte: "Partie personnalisée dans le client" },
  { titre: "Lecture chez Riot", texte: "Historique des deux comptes" },
  { titre: "Verdict", texte: "Niveau de preuve 1 à 3, affiché" },
  { titre: "Clôture", texte: "Fin du tournoi" },
  { titre: "Glicko-2", texte: "Rating et RD recalculés" },
  { titre: "Registre", texte: "Ligne scellée, publique" },
];

export function SchemaTrajet() {
  return (
    <figure className="panneau relative overflow-hidden px-6 py-8 sm:px-8">
      <figcaption className="sr-only">
        Le trajet d&apos;un résultat : partie jouée, lecture chez Riot, verdict, clôture du tournoi, calcul Glicko-2, ligne
        scellée dans le registre.
      </figcaption>
      <ol className="relative grid gap-7 xl:grid-cols-6 xl:gap-3">
        {/* Ligne qui relie les étapes : verticale sur téléphone, horizontale ensuite. */}
        <span aria-hidden="true" className="absolute top-6 bottom-6 left-6 w-px bg-line-strong xl:hidden" />
        <span
          aria-hidden="true"
          className="trace-v absolute top-6 bottom-6 left-6 w-px bg-accent/60 xl:hidden"
          style={delai(0.1)}
        />
        <span aria-hidden="true" className="absolute top-6 right-[8.33%] left-[8.33%] hidden h-px bg-line-strong xl:block" />
        <span
          aria-hidden="true"
          className="trace absolute top-6 right-[8.33%] left-[8.33%] hidden h-px bg-accent/60 xl:block"
          style={{ ...delai(0.1), transitionDuration: "2s" }}
        />
        {ETAPES_TRAJET.map((e, i) => (
          <li
            key={e.titre}
            className="etape-schema relative grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-x-4 xl:flex xl:flex-col xl:items-center xl:gap-3 xl:text-center"
            style={delai(0.1 + i * 0.35)}
          >
            <span
              className="relative flex size-12 items-center justify-center rounded-full border border-line-strong bg-surface-fin text-text"
            >
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
                {ICONES_TRAJET[i]}
              </svg>
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="font-texte text-mini font-medium text-faint tabular-nums">0{i + 1}</span>
              <span className="font-titre text-xl leading-none font-black uppercase">{e.titre}</span>
              <span className="text-xs text-muted">{e.texte}</span>
            </span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// 2. Les niveaux de verdict
// ---------------------------------------------------------------------------

const QUESTIONS_VERDICT = [
  {
    question: "Lobby avec code de tournoi ?",
    detail: "Lecture directe depuis un lobby officiel Riot, la preuve la plus forte. Il demande un accès que Riot accorde plus tard (voir la FAQ).",
    niveau: "3",
    resultat: "Vérifié",
    source: "Code de tournoi Riot · compte au classement",
    compte: true,
    actif: false,
  },
  {
    question: "Partie retrouvée chez Riot ?",
    detail: "La partie jouée entre les deux inscrits, dans l'historique des deux comptes.",
    niveau: "2",
    resultat: "Vérifié",
    source: "Retrouvé dans l'historique · compte au classement",
    compte: true,
    actif: true,
  },
  {
    question: "L'organisateur tranche",
    detail:
      "Aucune partie trouvée : l'organisateur décide. Les forfaits (joueur pas prêt à temps) et les exemptions (place vide) sont aussi des décisions manuelles, appliquées automatiquement. Le motif reste affiché, pour toujours.",
    niveau: "1",
    resultat: "Manuel",
    source: "Hors classement",
    compte: false,
    actif: true,
  },
];

export function SchemaVerdict() {
  return (
    <figure className="panneau relative overflow-hidden px-6 py-8 sm:px-8">
      <figcaption className="sr-only">
        Arbre de décision du verdict : un lobby avec code de tournoi donne le niveau 3, vérifié ; sinon une partie retrouvée
        dans l&apos;historique Riot donne le niveau 2, vérifié ; sinon l&apos;organisateur tranche : niveau 1, manuel, hors
        classement.
      </figcaption>
      <p className="etape-schema font-texte text-mini font-medium text-muted uppercase" style={delai(0.05)}>
        Match terminé · Najarena cherche la preuve
      </p>
      <ol className="mt-6 flex flex-col">
        {QUESTIONS_VERDICT.map((q, i) => (
          <li
            key={q.niveau}
            className="etape-schema grid gap-x-6 gap-y-3 border-t border-line py-5 first:border-t-0 first:pt-0 last:pb-0 xl:grid-cols-[minmax(0,1fr)_4rem_minmax(0,15rem)] xl:items-center"
            style={delai(0.3 + i * 0.55)}
          >
            <span className="flex flex-col gap-1">
              <span className="font-semibold">
                {i > 0 && <span className="mr-2 font-texte text-mini font-medium text-faint uppercase">Sinon</span>}
                {q.question}
                {!q.actif && (
                  <span className="ml-2 inline-block rounded-bouton border border-line-strong px-1.5 py-0.5 align-middle font-texte text-mini font-medium text-muted uppercase">
                    Pas encore actif
                  </span>
                )}
              </span>
              <span className="text-sm text-text-2">{q.detail}</span>
            </span>
            <span aria-hidden="true" className="relative hidden h-px xl:block">
              <span className="absolute inset-0 bg-line-strong" />
              <span
                className={`trace absolute inset-0 ${q.compte && q.actif ? "bg-accent" : "bg-faint"}`}
                style={delai(0.55 + i * 0.55)}
              />
            </span>
            <span className="flex items-center gap-4">
              <span
                className={`font-titre text-5xl leading-none font-black tabular-nums ${q.compte && q.actif ? "text-accent" : "text-faint"}`}
              >
                {q.niveau}
              </span>
              <span className="flex flex-col gap-1">
                <span
                  className={`inline-flex items-center gap-1.5 font-texte text-mini font-semibold uppercase ${
                    q.compte && q.actif ? "text-accent" : "text-muted"
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden="true">
                    {q.compte ? (
                      <path {...TRAIT} strokeWidth={3} d="M5 12.5l4.5 4.5L19 7.5" />
                    ) : (
                      <path {...TRAIT} d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    )}
                  </svg>
                  {q.resultat}
                </span>
                <span className="text-xs text-muted">{q.source}</span>
              </span>
            </span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// 3. La calibration (illustration de la règle, pas des données réelles)
// ---------------------------------------------------------------------------

const RD_MAX = RD_MAX_ILLUSTRATION;
const MATCHS = MATCHS_ILLUSTRATION;
const M_SEUIL = MATCH_SEUIL_ILLUSTRATION;

/** Gabarits : ordinateur (large) et téléphone (étroit, textes à taille réelle). */
const GABARITS = {
  large: { l: 600, h: 300, x0: 62, x1: 580, y0: 34, y1: 250, petit: 12, moyen: 14, fort: 16, etroit: false, espace: 3 },
  etroit: { l: 340, h: 300, x0: 40, x1: 326, y0: 40, y1: 244, petit: 11, moyen: 13, fort: 15, etroit: true, espace: 1.5 },
} as const;

function GrapheCalibration({ g, className }: { g: (typeof GABARITS)[keyof typeof GABARITS]; className: string }) {
  const px = (m: number) => g.x0 + ((g.x1 - g.x0) * m) / MATCHS;
  const py = (rd: number) => g.y1 - ((g.y1 - g.y0) * rd) / RD_MAX;
  const points = Array.from({ length: MATCHS + 1 }, (_, m) => `${px(m).toFixed(1)} ${py(rdIllustration(m)).toFixed(1)}`);
  const courbe = `M${points.join(" L")}`;
  const aire = `${courbe} L${g.x1} ${g.y1} L${g.x0} ${g.y1} Z`;
  const ySeuil = py(RD_SEUIL_CLASSEMENT);
  // Téléphone : « Classé » centré sous le point, étiquette courte au-dessus
  // de la ligne ; ordinateur : « Classé » à droite du point, étiquette
  // complète sous la ligne. Les textes ne touchent jamais la courbe.
  const xClasse = g.etroit ? px(M_SEUIL) : px(M_SEUIL) + 12;
  const ancreClasse = g.etroit ? "middle" : "start";
  const ySeuilTexte = g.etroit ? ySeuil - 10 : ySeuil + 22;
  const libelleSeuil = g.etroit
    ? `SEUIL · RD ${RD_SEUIL_CLASSEMENT}`
    : `ENTRÉE AU CLASSEMENT · RD ${RD_SEUIL_CLASSEMENT}`;
  return (
    <svg viewBox={`0 0 ${g.l} ${g.h}`} className={className} aria-hidden="true">
      <text x={g.x0} y={g.y0 - 18} fill="var(--color-faint)" fontSize={g.petit} letterSpacing={g.espace}>
        ILLUSTRATION · INCERTITUDE (RD)
      </text>
      {[0, RD_SEUIL_CLASSEMENT, RD_INITIAL].map((v) => (
        <text key={v} x={g.x0 - 10} y={py(v) + 5} textAnchor="end" fill="var(--color-faint)" fontSize={g.moyen}>
          {v}
        </text>
      ))}
      <line x1={g.x0} y1={g.y1} x2={g.x1} y2={g.y1} stroke="var(--color-line-strong)" />
      {[0, 2, 4, 6, 8, 10, 12, 14].map((m) => (
        <text key={m} x={px(m)} y={g.y1 + 22} textAnchor="middle" fill="var(--color-faint)" fontSize={g.moyen}>
          {m}
        </text>
      ))}
      <text x={g.x1} y={g.y1 + 44} textAnchor="end" fill="var(--color-faint)" fontSize={g.petit} letterSpacing={3}>
        MATCHS VÉRIFIÉS
      </text>
      <path className="etape-schema" style={delai(0.2)} d={aire} fill="var(--color-text)" fillOpacity={0.05} />
      <path
        className="trace"
        style={delai(0.2)}
        d={courbe}
        fill="none"
        stroke="var(--color-text)"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <g className="etape-schema" style={delai(0.9)}>
        <line
          x1={g.x0}
          y1={ySeuil}
          x2={g.x1}
          y2={ySeuil}
          stroke="var(--color-accent)"
          strokeWidth={1.5}
          strokeDasharray="6 6"
        />
        <text x={g.x0 + 8} y={ySeuilTexte} fill="var(--color-accent)" fontSize={g.petit + 1} fontWeight={600} letterSpacing={2}>
          {libelleSeuil}
        </text>
      </g>
      <g className="etape-schema" style={delai(1.3)}>
        <circle cx={px(M_SEUIL)} cy={ySeuil} r={7} fill="var(--color-accent)" />
        <text x={xClasse} y={ySeuil + 26} textAnchor={ancreClasse} fill="var(--color-text)" fontSize={g.fort} fontWeight={600}>
          Classé
        </text>
        <text x={xClasse} y={ySeuil + 46} textAnchor={ancreClasse} fill="var(--color-muted)" fontSize={g.moyen}>
          vers le 10e match
        </text>
      </g>
      <g className="etape-schema" style={delai(0.2)}>
        <circle cx={px(0)} cy={py(RD_INITIAL)} r={5} fill="var(--color-text)" />
        <text x={px(0) + 12} y={py(RD_INITIAL) + 5} fill="var(--color-muted)" fontSize={g.moyen}>
          Départ : {RATING_INITIAL} de rating, RD {RD_INITIAL}
        </text>
      </g>
    </svg>
  );
}

export function SchemaCalibration() {
  return (
    <figure className="panneau relative overflow-hidden px-4 py-6 sm:px-8">
      <figcaption className="sr-only">
        Illustration : l&apos;incertitude (RD) part de {RD_INITIAL} et descend avec les matchs vérifiés ; le joueur entre
        au classement quand elle passe sous {RD_SEUIL_CLASSEMENT}, vers le dixième match.
      </figcaption>
      <GrapheCalibration g={GABARITS.etroit} className="block h-auto w-full sm:hidden" />
      <GrapheCalibration g={GABARITS.large} className="hidden h-auto w-full sm:block" />
      <p className="mt-3 text-xs text-muted">
        Illustration : le calcul se fait à la clôture de chaque tournoi, pas après chaque match.
      </p>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// 4. La chaîne du registre (exemple de lignes, marqué comme tel)
// ---------------------------------------------------------------------------

const LIGNES_EXEMPLE = [
  { n: "1041", empreinte: "9f2c…a71" },
  { n: "1042", empreinte: "3b8e…04d" },
  { n: "1043", empreinte: "c51a…e92" },
  { n: "1044", empreinte: "77d0…b3f" },
  { n: "1045", empreinte: "e4a9…61c" },
];

export function SchemaRegistre() {
  return (
    <figure className="panneau relative overflow-hidden px-6 py-8 sm:px-8">
      <figcaption className="sr-only">
        Exemple : chaque ligne du registre porte une empreinte calculée à partir de son contenu et de l&apos;empreinte
        précédente. Si une ligne passée est retouchée, son empreinte change et toutes celles qui suivent ne correspondent
        plus.
      </figcaption>
      <p className="etape-schema text-sm text-text-2" style={delai(0.05)}>
        <span className="mr-2 rounded-bouton bg-text px-1.5 py-0.5 font-texte text-mini font-semibold text-on-accent uppercase">
          Exemple
        </span>
        Chaque empreinte est calculée à partir de la ligne <em>et</em> de l&apos;empreinte précédente.
      </p>
      <ol className="mt-6 grid gap-3 xl:grid-cols-5 xl:gap-8">
        {LIGNES_EXEMPLE.map((l, i) => {
          const retouchee = i === 1;
          const invalide = i >= 1;
          return (
            <li key={l.n} className="etape-schema relative" style={delai(0.1 + i * 0.15)}>
              <div className="relative rounded-carte border border-line-strong bg-surface-fin px-4 py-3">
                <span className="block font-texte text-mini font-medium text-faint uppercase">Ligne #{l.n}</span>
                <span className="mt-1 block text-sm text-text tabular-nums">
                  {retouchee ? "1612 → 1648" : "Rating avant → après"}
                </span>
                <span className="mt-2 flex gap-2 text-xs text-muted">
                  empreinte <span className="font-texte text-text tabular-nums">{l.empreinte}</span>
                </span>
                {invalide && (
                  <span
                    aria-hidden="true"
                    className="etape-schema pointer-events-none absolute -inset-px rounded-carte border-2 border-danger"
                    style={delai(1.3 + (i - 1) * 0.18)}
                  />
                )}
              </div>
              {invalide && (
                <span
                  className="etape-schema mt-1.5 block font-texte text-mini font-semibold text-danger uppercase"
                  style={delai(1.3 + (i - 1) * 0.18)}
                >
                  {retouchee ? "Retouchée" : "Invalide"}
                </span>
              )}
              {i < LIGNES_EXEMPLE.length - 1 && (
                <span aria-hidden="true" className="absolute top-[2.4rem] -right-8 hidden h-0.5 w-8 bg-accent/60 xl:block">
                  {invalide && (
                    <span className="etape-schema absolute inset-0 bg-danger" style={delai(1.3 + (i - 1) * 0.18)} />
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="etape-schema mt-6 font-semibold text-text" style={delai(2.2)}>
        Une seule retouche, et toute la suite est fausse : n&apos;importe qui peut le voir en refaisant le calcul.
      </p>
    </figure>
  );
}
