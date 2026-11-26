import type { CSSProperties, ReactNode } from "react";
import BoutonLien from "@/components/design/BoutonLien";
import EmblemePalier, { clePalier, couleurPalier } from "@/components/design/EmblemePalier";
import { RD_INITIAL, RD_SEUIL_CLASSEMENT, arrondir, type Palier } from "@/lib/classement";
import { SEMAINES_ACTIVITE, SEUIL_REPARTITION, type Repartition, type ResultatForme } from "@/lib/apercu-donnees";
import { SEUILS_PALIERS } from "@/lib/niveau-tournoi";

// Visuels « en un coup d'œil » (étape 3 du plan « site plus visuel »,
// version 2 validée par le porteur le 27/11/2026) : anneau du palier,
// répartition des joueurs classés, activité des 12 dernières semaines,
// preuve et forme. Toujours de vraies données ; état vide soigné sinon.
// Les catégories sont celles des chiffres clés du profil (chiffresCV) :
// « matchs vérifiés » = lus chez Riot et comptés ; les matchs « sans
// points » (compte Riot sous le niveau 30) et les décisions manuelles sont
// dits à part, jamais mélangés.
// À placer dans un Apparition : les éléments apparaissent une fois, en
// cascade (globals.css : .etape-schema, .monte), puis plus rien ne bouge.
// Les textes sont en HTML (lisibles sur téléphone) ; les dessins SVG sont
// décoratifs et leurs valeurs sont aussi dites en texte.

const delai = (s: number): CSSProperties => ({ ["--delai" as string]: `${s}s` });

const CADRE = "panneau relative overflow-hidden p-6 sm:p-7";
const GEANT = "font-titre text-[clamp(3rem,6vw,4.5rem)] leading-[0.85] font-black tabular-nums";

function Libelle({ children }: { children: ReactNode }) {
  return <span className="font-texte text-mini font-medium text-muted uppercase">{children}</span>;
}

// ---------------------------------------------------------------------------
// Anneau (palier, calibration)
// ---------------------------------------------------------------------------

function Anneau({ pct, couleur, centre, sous }: { pct: number; couleur: string; centre: string; sous: string }) {
  const r = 78;
  const c = 2 * Math.PI * r;
  const arc = c * 0.8;
  const plein = Math.max(0, Math.min(1, pct)) * arc;
  return (
    <div className="relative size-44">
      <svg viewBox="0 0 190 190" className="size-full" aria-hidden="true">
        <g transform="rotate(126 95 95)">
          <circle cx="95" cy="95" r={r} fill="none" stroke="var(--color-line-strong)" strokeWidth={12} strokeLinecap="round" strokeDasharray={`${arc} ${c}`} />
          {plein > 0 && (
            <>
              <circle cx="95" cy="95" r={r} fill="none" stroke={couleur} strokeOpacity={0.25} strokeWidth={22} strokeLinecap="round" strokeDasharray={`${plein} ${c}`} />
              <circle cx="95" cy="95" r={r} fill="none" stroke={couleur} strokeWidth={12} strokeLinecap="round" strokeDasharray={`${plein} ${c}`} />
            </>
          )}
        </g>
      </svg>
      <span className="absolute inset-x-0 top-[3.9rem] text-center font-titre text-[2.6rem] leading-none font-black tabular-nums">{centre}</span>
      <span className="absolute inset-x-0 bottom-1 text-center font-texte text-[0.6875rem] font-medium tracking-[1.5px] text-muted uppercase">{sous}</span>
    </div>
  );
}

interface AnneauPalierProps {
  /** Rating de la saison courante, non arrondi (palier et seuils calculés dessus). */
  rating: number | null;
  rd: number | null;
  estClasse: boolean;
  palier: Palier | null;
  palierSuivant: Palier | null;
}

/** Classé : progression vers le palier suivant. Sinon : progression de la calibration (RD vers 150). */
export function AnneauPalier({ rating, rd, estClasse, palier, palierSuivant }: AnneauPalierProps) {
  if (estClasse && palier && rating !== null) {
    const couleur = couleurPalier(clePalier(palier.nom));
    const manque = palierSuivant ? Math.max(1, Math.ceil(palierSuivant.ratingMin - rating)) : 0;
    const pct = palierSuivant ? (rating - palier.ratingMin) / (palierSuivant.ratingMin - palier.ratingMin) : 1;
    return (
      <div className={CADRE}>
        <div className="grid items-center gap-6 sm:grid-cols-[11rem_minmax(0,1fr)]">
          <div className="etape-schema relative" style={delai(0.1)}>
            <Anneau pct={pct} couleur={couleur} centre={palierSuivant ? String(manque) : "MAX"} sous={palierSuivant ? "points à gagner" : "palier maximal"} />
            <EmblemePalier palier={palier.nom} taille={44} className="absolute top-6 left-[5.5rem] -translate-x-1/2" />
          </div>
          <div className="etape-schema flex min-w-0 flex-col gap-2" style={delai(0.25)}>
            <Libelle>Palier</Libelle>
            <span className="font-titre text-[clamp(3rem,6vw,4.5rem)] leading-[0.85] font-black uppercase" style={{ color: couleur }}>
              {palier.nom}
            </span>
            <span className="text-sm text-text-2 tabular-nums">
              Rating <b className="font-semibold text-text">{arrondir(rating)}</b>
              {palierSuivant ? (
                <>
                  {" "}· encore <b className="font-semibold text-text">{manque} point{manque > 1 ? "s" : ""}</b> pour {palierSuivant.nom} (
                  {palierSuivant.ratingMin})
                </>
              ) : (
                <> · palier le plus haut</>
              )}
            </span>
          </div>
        </div>
      </div>
    );
  }
  const rdActuel = rd ?? RD_INITIAL;
  const pct = (RD_INITIAL - rdActuel) / (RD_INITIAL - RD_SEUIL_CLASSEMENT);
  return (
    <div className={CADRE}>
      <div className="grid items-center gap-6 sm:grid-cols-[11rem_minmax(0,1fr)]">
        <div className="etape-schema relative" style={delai(0.1)}>
          <Anneau pct={pct} couleur="var(--color-text)" centre={String(Math.round(rdActuel))} sous="incertitude (RD)" />
          <EmblemePalier palier={null} taille={40} className="absolute top-7 left-[5.5rem] -translate-x-1/2" />
        </div>
        <div className="etape-schema flex min-w-0 flex-col gap-2" style={delai(0.25)}>
          <Libelle>Palier</Libelle>
          <span className="font-titre text-[clamp(2.4rem,4.2vw,3.2rem)] leading-[0.85] font-black text-muted uppercase">Calibration</span>
          <span className="text-sm text-text-2">
            Incertitude actuelle : <b className="font-semibold text-text tabular-nums">{Math.round(rdActuel)}</b>. Classé quand elle
            passe <b className="font-semibold text-accent">sous {RD_SEUIL_CLASSEMENT}</b>, après une dizaine de matchs vérifiés.
            {palier && <> Palier provisoire : {palier.nom}.</>}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Répartition des joueurs classés
// ---------------------------------------------------------------------------

const SEUILS = SEUILS_PALIERS.map((p) => p.min);
const palierDe = (v: number) => SEUILS_PALIERS.reduce((nom, p) => (v >= p.min ? p.nom : nom), SEUILS_PALIERS[0].nom);

interface RepartitionProps {
  repartition: Repartition;
  /** Rating du joueur (non arrondi), pour l'épingle (profil). */
  marque?: number;
  /** Nombre de joueurs par palier sous le graphique (classement). */
  comptes?: boolean;
}

export function GrapheRepartition({ repartition, marque, comptes = false }: RepartitionProps) {
  const W = 640;
  const x0 = 16;
  const x1 = 624;
  const yh = 40;
  const y1 = 190;
  const fin = repartition.debut + repartition.classes.length * repartition.pas;
  const X = (v: number) => x0 + ((v - repartition.debut) / (fin - repartition.debut)) * (x1 - x0);
  const pourcent = (v: number) => `${((X(v) / W) * 100).toFixed(2)}%`;
  const max = Math.max(1, ...repartition.classes);
  const bw = (x1 - x0) / repartition.classes.length;
  const graduations = [1200, 1400, 1600, 1800, 2000].filter((v) => v > repartition.debut && v < fin);
  const parPalier = SEUILS_PALIERS.map((p) => ({ nom: p.nom, nombre: 0 }));
  repartition.classes.forEach((n, i) => {
    const nom = palierDe(repartition.debut + i * repartition.pas);
    const ligne = parPalier.find((l) => l.nom === nom);
    if (ligne) ligne.nombre += n;
  });
  const enMarge = marque !== undefined && X(marque) > W * 0.72;
  return (
    <>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${y1 + 2}`} className="block h-auto w-full" aria-hidden="true">
          <defs>
            {SEUILS_PALIERS.map((p) => (
              <linearGradient key={p.nom} id={`rep-${clePalier(p.nom)}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={couleurPalier(clePalier(p.nom))} />
                <stop offset="1" stopColor={couleurPalier(clePalier(p.nom))} stopOpacity={0.25} />
              </linearGradient>
            ))}
          </defs>
          {SEUILS_PALIERS.map((p, i) => {
            const a = Math.max(repartition.debut, i === 0 ? repartition.debut : p.min);
            const b = Math.min(fin, SEUILS[i + 1] ?? fin);
            if (b <= a) return null;
            const c = couleurPalier(clePalier(p.nom));
            return (
              <g key={p.nom}>
                <rect x={X(a)} y={yh - 14} width={X(b) - X(a)} height={y1 - yh + 14} fill={c} fillOpacity={0.05} />
                {i > 0 && <line x1={X(a)} y1={yh - 14} x2={X(a)} y2={y1} stroke={c} strokeOpacity={0.3} strokeDasharray="3 4" />}
              </g>
            );
          })}
          {repartition.classes.map((n, i) => {
            if (n === 0) return null;
            const v = repartition.debut + i * repartition.pas;
            const h = (n / max) * (y1 - yh);
            const proche = marque === undefined || (marque >= v && marque < v + repartition.pas);
            return (
              <rect
                key={v}
                className="monte"
                style={delai(0.1 + i * 0.02)}
                x={x0 + i * bw + 1.5}
                y={y1 - h}
                width={Math.max(1, bw - 3)}
                height={h}
                rx={3}
                fill={`url(#rep-${clePalier(palierDe(v))})`}
                fillOpacity={proche ? 1 : 0.45}
              />
            );
          })}
          <line x1={x0} y1={y1} x2={x1} y2={y1} stroke="var(--color-line-strong)" />
          {marque !== undefined && (
            <g className="etape-schema" style={delai(0.8)}>
              <line x1={X(marque)} y1={yh - 20} x2={X(marque)} y2={y1} stroke="var(--color-text)" strokeWidth={2} />
              <circle cx={X(marque)} cy={yh - 26} r={14} fill="var(--color-text)" fillOpacity={0.15} />
              <circle cx={X(marque)} cy={yh - 26} r={7} fill="var(--color-text)" />
            </g>
          )}
        </svg>
        {marque !== undefined && (
          <span
            className={`etape-schema absolute top-0 font-titre text-xl leading-none font-black tabular-nums ${enMarge ? "-translate-x-[calc(100%+1.25rem)]" : "translate-x-5"}`}
            style={{ ...delai(0.8), left: pourcent(marque) }}
          >
            {arrondir(marque)}
          </span>
        )}
      </div>
      {/* Graduations en texte : lisibles à toutes les tailles d'écran. */}
      <div aria-hidden="true" className="relative mt-1.5 h-5 text-xs text-faint tabular-nums">
        {graduations.map((v) => (
          <span key={v} className="absolute -translate-x-1/2" style={{ left: pourcent(v) }}>
            {v}
          </span>
        ))}
      </div>
      {comptes && (
        <ul className="mt-4 grid grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-6" aria-label="Joueurs classés par palier">
          {parPalier.map((p, i) => (
            <li key={p.nom} className="etape-schema flex items-center gap-2.5" style={delai(0.6 + i * 0.06)}>
              <EmblemePalier palier={p.nom} taille={34} />
              <span className="flex flex-col">
                <span className="font-titre text-3xl leading-none font-black tabular-nums">{p.nombre}</span>
                <span className="font-texte text-mini font-semibold uppercase" style={{ color: couleurPalier(clePalier(p.nom)) }}>
                  {p.nom}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

interface PlaceProps {
  repartition: Repartition | null;
  /** Rating de la saison courante, non arrondi. */
  rating: number | null;
  rang: number | null;
  total: number;
  saison: string | null;
}

/** Profil : top X %, rang, et répartition avec l'épingle du joueur. */
export function PlaceParmiJoueurs({ repartition, rating, rang, total, saison }: PlaceProps) {
  const top = rang !== null && total > 0 ? Math.max(1, Math.round((rang / total) * 100)) : null;
  return (
    <div className={CADRE}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="etape-schema flex flex-col gap-2" style={delai(0.1)}>
          <Libelle>Place parmi les joueurs classés</Libelle>
          <span className={`${GEANT} uppercase ${top === null ? "text-muted" : ""}`}>{top === null ? "—" : `Top ${top} %`}</span>
        </div>
        {rang !== null && (
          <span className="text-sm text-text-2 tabular-nums">
            Rang <b className="font-semibold text-text">{rang}</b> sur <b className="font-semibold text-text">{total}</b>
            {saison && <> · {saison}</>}
          </span>
        )}
      </div>
      {repartition && rating !== null && rang !== null ? (
        <div className="mt-4">
          <GrapheRepartition repartition={repartition} marque={rating} />
        </div>
      ) : (
        <p className="mt-4 max-w-md text-sm text-text-2">
          {rang === null && `Le rang s'affiche une fois classé, quand l'incertitude passe sous ${RD_SEUIL_CLASSEMENT}. `}
          {total < SEUIL_REPARTITION
            ? `La répartition de tous les joueurs apparaîtra dès que ${SEUIL_REPARTITION} joueurs seront classés.`
            : rang !== null && "La répartition de tous les joueurs n'est pas disponible pour l'instant."}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activité des 12 dernières semaines
// ---------------------------------------------------------------------------

/** semaines : matchs vérifiés par semaine glissante, la plus ancienne d'abord. */
export function ActiviteSemaines({ semaines }: { semaines: number[] }) {
  const somme = semaines.reduce((a, b) => a + b, 0);
  const actives = semaines.filter((n) => n > 0).length;
  const max = Math.max(4, ...semaines);
  const W = 600;
  const x0 = 10;
  const x1 = 590;
  const y1 = 150;
  const bw = (x1 - x0) / SEMAINES_ACTIVITE;
  return (
    <div className={CADRE}>
      <div className="flex flex-wrap gap-8">
        <div className="flex flex-col gap-2">
          <Libelle>Matchs vérifiés · 12 semaines</Libelle>
          <span className={`${GEANT} ${somme ? "" : "text-muted"}`}>{somme}</span>
        </div>
        <div className="flex flex-col gap-2">
          <Libelle>Semaines actives</Libelle>
          <span className={`${GEANT} ${actives ? "" : "text-muted"}`}>
            {actives}
            <span className="text-[0.45em] text-muted">/{SEMAINES_ACTIVITE}</span>
          </span>
        </div>
      </div>
      <p className="sr-only">
        Matchs vérifiés par semaine, de la plus ancienne à la semaine en cours : {semaines.join(", ")}.
      </p>
      <svg viewBox={`0 0 ${W} ${y1 + 4}`} className="mt-4 block h-auto w-full" aria-hidden="true">
        <defs>
          <linearGradient id="activite-barre" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--color-text)" />
            <stop offset="1" stopColor="var(--color-text)" stopOpacity={0.25} />
          </linearGradient>
        </defs>
        {semaines.map((n, i) => {
          const x = x0 + i * bw + 4;
          const w = bw - 8;
          const h = (n / max) * 110;
          return (
            <g key={i}>
              <rect x={x} y={y1 - 110} width={w} height={110} rx={4} fill="var(--color-text)" fillOpacity={0.04} />
              {n > 0 && (
                <g className="etape-schema" style={delai(0.15 + i * 0.04)}>
                  <rect className="monte" style={delai(0.15 + i * 0.04)} x={x} y={y1 - h} width={w} height={h} rx={4} fill="url(#activite-barre)" />
                  <text x={x + w / 2} y={y1 - h - 8} textAnchor="middle" fill="var(--color-text)" fontSize={30} fontWeight={900} className="font-titre">
                    {n}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
      <div aria-hidden="true" className="mt-1.5 flex justify-between text-xs text-faint">
        <span>il y a 12 semaines</span>
        <span className="text-text">cette semaine</span>
      </div>
      {somme === 0 && <p className="mt-3 text-sm text-text-2">Les barres monteront au premier match vérifié.</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preuve et forme
// ---------------------------------------------------------------------------

const TUILE: Record<ResultatForme, string> = {
  V: "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-accent)_28%,transparent),color-mix(in_srgb,var(--color-accent)_10%,transparent))] text-accent",
  D: "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-danger)_24%,transparent),color-mix(in_srgb,var(--color-danger)_8%,transparent))] text-danger",
  M: "border border-dashed border-line-strong bg-text/5 text-muted",
};
const NOM_RESULTAT: Record<ResultatForme, string> = { V: "Victoire", D: "Défaite", M: "Décision manuelle" };
/** En dessous, l'anneau n'est pas mis en vert : une faible part prouvée n'est pas à valoriser. */
const PART_FORTE = 0.8;

interface PreuveProps {
  verifies: number;
  manuels: number;
  sansPoints: number;
  forme: ResultatForme[];
}

export function PreuveForme({ verifies, manuels, sansPoints, forme }: PreuveProps) {
  const total = verifies + manuels;
  const r = 70;
  const c = 2 * Math.PI * r;
  const part = total ? verifies / total : 0;
  const couleur = part >= PART_FORTE ? "var(--color-accent)" : "var(--color-text)";
  return (
    <div className={CADRE}>
      <div className="grid items-center gap-6 sm:grid-cols-[11rem_minmax(0,1fr)]">
        <div className="etape-schema relative size-44" style={delai(0.1)}>
          <svg viewBox="0 0 190 190" className="size-full" aria-hidden="true">
            <g transform="rotate(-90 95 95)">
              <circle cx="95" cy="95" r={r} fill="none" stroke="var(--color-faint)" strokeOpacity={0.6} strokeWidth={16} />
              {verifies > 0 && (
                <>
                  <circle cx="95" cy="95" r={r} fill="none" stroke={couleur} strokeOpacity={0.22} strokeWidth={26} strokeDasharray={`${part * c} ${c}`} />
                  <circle cx="95" cy="95" r={r} fill="none" stroke={couleur} strokeWidth={16} strokeDasharray={`${part * c} ${c}`} />
                </>
              )}
            </g>
          </svg>
          <span className="absolute inset-x-0 top-[4.6rem] text-center font-titre text-[2.6rem] leading-none font-black tabular-nums" style={{ color: couleur }}>
            {Math.round(part * 100)}%
          </span>
          <span className="absolute inset-x-0 top-[7.4rem] text-center font-texte text-[0.6875rem] font-medium tracking-[1.5px] text-muted uppercase">
            vérifiés
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <Libelle>Preuve</Libelle>
          <p className="text-sm text-text-2 tabular-nums">
            <b className="font-semibold text-text">
              {verifies} match{verifies > 1 ? "s" : ""} vérifié{verifies > 1 ? "s" : ""}
            </b>{" "}
            : lu{verifies > 1 ? "s" : ""} dans la donnée Riot
            <br />
            <b className="font-semibold text-text">{manuels}</b> décision{manuels > 1 ? "s" : ""} manuelle{manuels > 1 ? "s" : ""} (hors classement)
            {sansPoints > 0 && (
              <>
                <br />+ {sansPoints} sans points (compte Riot sous le niveau requis)
              </>
            )}
          </p>
        </div>
      </div>
      <div className="mt-6">
        <Libelle>
          Forme · {forme.length} dernier{forme.length > 1 ? "s" : ""} <span className="text-faint">(le plus récent à droite)</span>
        </Libelle>
        <ol className="mt-3 grid grid-cols-10 gap-1.5" aria-label="Derniers résultats, du plus ancien au plus récent">
          {Array.from({ length: 10 }, (_, i) => {
            const decalage = 10 - forme.length;
            const res = i >= decalage ? forme[i - decalage] : null;
            return res ? (
              <li
                key={i}
                className={`etape-schema grid aspect-square place-items-center rounded-carte font-titre text-[clamp(1rem,2.4vw,1.5rem)] font-black ${TUILE[res]}`}
                style={delai(0.4 + i * 0.05)}
              >
                <span aria-hidden="true">{res}</span>
                <span className="sr-only">{NOM_RESULTAT[res]}</span>
              </li>
            ) : (
              <li key={i} aria-hidden="true" className="aspect-square rounded-carte border border-dashed border-line" />
            );
          })}
        </ol>
        <p className="mt-2 text-xs text-muted">
          <span className="text-accent">V</span> victoire · <span className="text-danger">D</span> défaite · M décision manuelle
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profil sans aucun match : une invitation plutôt que trois blocs vides
// ---------------------------------------------------------------------------

export function InvitationPremierTournoi({ proprietaire }: { proprietaire: boolean }) {
  return (
    <div className={`${CADRE} flex flex-col justify-center gap-4`}>
      <Libelle>Activité, place et preuve</Libelle>
      <span className="font-titre text-[clamp(2.2rem,4vw,3rem)] leading-[0.9] font-black uppercase">
        {proprietaire ? "Ton premier tournoi remplira tout ça." : "Pas encore de match vérifié."}
      </span>
      <p className="max-w-md text-sm text-text-2">
        {proprietaire
          ? "Ta place parmi les joueurs, ton activité semaine par semaine et la part de tes matchs prouvés s'afficheront ici dès ton premier match lu chez Riot."
          : "Sa place parmi les joueurs, son activité semaine par semaine et la part de matchs prouvés s'afficheront ici dès son premier match lu chez Riot."}
      </p>
      {proprietaire && (
        <BoutonLien href="/lol/tournois" variante="secondaire">
          Voir les tournois
        </BoutonLien>
      )}
    </div>
  );
}
