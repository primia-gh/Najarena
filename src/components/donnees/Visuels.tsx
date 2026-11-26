import type { CSSProperties, ReactNode } from "react";
import EmblemePalier, { clePalier, couleurPalier } from "@/components/design/EmblemePalier";
import { RD_INITIAL, RD_SEUIL_CLASSEMENT, arrondir, type Palier } from "@/lib/classement";
import { SEMAINES_ACTIVITE, SEUIL_REPARTITION, type Repartition, type ResultatForme } from "@/lib/apercu-donnees";
import { SEUILS_PALIERS } from "@/lib/niveau-tournoi";

// Visuels « en un coup d'œil » (étape 3 du plan « site plus visuel »,
// version 2 validée par le porteur le 27/11/2026) : anneau du palier,
// répartition des joueurs classés, activité des 12 dernières semaines,
// preuve et forme. Toujours de vraies données ; état vide soigné sinon.
// À placer dans un Apparition : les éléments apparaissent une fois, en
// cascade (globals.css : .etape-schema, .monte), puis plus rien ne bouge.
// Rendus par le serveur, sans JavaScript ni bibliothèque.

const delai = (s: number): CSSProperties => ({ ["--delai" as string]: `${s}s` });

const CADRE = "panneau relative overflow-hidden p-6 sm:p-7";

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
      <text x="95" y="128" textAnchor="middle" fill="var(--color-text)" fontSize={40} className="font-titre" fontWeight={900}>
        {centre}
      </text>
      <text x="95" y="174" textAnchor="middle" fill="var(--color-muted)" fontSize={11} letterSpacing={1.5}>
        {sous}
      </text>
    </svg>
  );
}

interface AnneauPalierProps {
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
    const manque = palierSuivant ? Math.max(0, Math.ceil(palierSuivant.ratingMin - rating)) : 0;
    const pct = palierSuivant ? (rating - palier.ratingMin) / (palierSuivant.ratingMin - palier.ratingMin) : 1;
    return (
      <div className={CADRE}>
        <div className="grid items-center gap-6 sm:grid-cols-[11rem_minmax(0,1fr)]">
          <div className="etape-schema relative size-44" style={delai(0.1)}>
            <Anneau pct={pct} couleur={couleur} centre={palierSuivant ? String(manque) : "MAX"} sous={palierSuivant ? "POINTS À GAGNER" : "PALIER MAXIMAL"} />
            <EmblemePalier palier={palier.nom} taille={44} className="absolute top-6 left-1/2 -translate-x-1/2" />
          </div>
          <div className="etape-schema flex min-w-0 flex-col gap-2" style={delai(0.25)}>
            <Libelle>Palier</Libelle>
            <span className="font-titre text-[clamp(3rem,6vw,4.5rem)] leading-[0.85] font-black uppercase" style={{ color: couleur }}>
              {palier.nom}
            </span>
            <span className="text-sm text-text-2 tabular-nums">
              Rating <b className="font-semibold text-text">{arrondir(rating)}</b>
              {palierSuivant && (
                <>
                  {" "}· encore <b className="font-semibold text-text">{manque} points</b> pour passer
                </>
              )}
            </span>
            {palierSuivant && (
              <span className="mt-1 flex items-center gap-2.5">
                <EmblemePalier palier={palierSuivant.nom} taille={34} className="opacity-50" />
                <span
                  className="font-titre text-2xl leading-none font-black uppercase opacity-60"
                  style={{ color: couleurPalier(clePalier(palierSuivant.nom)) }}
                >
                  {palierSuivant.nom}
                </span>
                <span className="text-xs text-muted tabular-nums">à {palierSuivant.ratingMin}</span>
              </span>
            )}
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
        <div className="etape-schema relative size-44" style={delai(0.1)}>
          <Anneau pct={pct} couleur="var(--color-text)" centre={String(Math.round(rdActuel))} sous="INCERTITUDE (RD)" />
          <EmblemePalier palier={null} taille={40} className="absolute top-7 left-1/2 -translate-x-1/2" />
        </div>
        <div className="etape-schema flex min-w-0 flex-col gap-2" style={delai(0.25)}>
          <Libelle>Palier</Libelle>
          <span className="font-titre text-[clamp(2.4rem,4.2vw,3.2rem)] leading-[0.85] font-black text-muted uppercase">
            Calibration
          </span>
          <span className="text-sm text-text-2">
            Classé quand l&apos;incertitude passe <b className="font-semibold text-accent">sous {RD_SEUIL_CLASSEMENT}</b>,
            vers le 10e match vérifié.
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
  /** Rating du joueur, pour l'épingle (profil). */
  marque?: number;
  /** Nombre de joueurs par palier sous le graphique (classement). */
  comptes?: boolean;
  /** Libellé de l'épingle. */
  libelleMarque?: string;
}

export function GrapheRepartition({ repartition, marque, comptes = false, libelleMarque }: RepartitionProps) {
  const W = 640;
  const x0 = 16;
  const x1 = 624;
  const yh = 70;
  const y1 = 210;
  const H = 240;
  const fin = repartition.debut + repartition.classes.length * repartition.pas;
  const X = (v: number) => x0 + ((v - repartition.debut) / (fin - repartition.debut)) * (x1 - x0);
  const max = Math.max(1, ...repartition.classes);
  const bw = (x1 - x0) / repartition.classes.length;
  const graduations = [1200, 1400, 1600, 1800, 2000].filter((v) => v > repartition.debut && v < fin);
  const parPalier = SEUILS_PALIERS.map((p) => ({ nom: p.nom, nombre: 0 }));
  repartition.classes.forEach((n, i) => {
    const nom = palierDe(repartition.debut + i * repartition.pas);
    const ligne = parPalier.find((l) => l.nom === nom);
    if (ligne) ligne.nombre += n;
  });
  return (
    <>
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" aria-hidden="true">
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
      {graduations.map((v) => (
        <text key={v} x={X(v)} y={y1 + 26} textAnchor="middle" fill="var(--color-faint)" fontSize={18}>
          {v}
        </text>
      ))}
      {marque !== undefined && (
        <g className="etape-schema" style={delai(0.8)}>
          <line x1={X(marque)} y1={yh - 20} x2={X(marque)} y2={y1} stroke="var(--color-text)" strokeWidth={2} />
          <circle cx={X(marque)} cy={yh - 26} r={16} fill="var(--color-text)" fillOpacity={0.15} />
          <circle cx={X(marque)} cy={yh - 26} r={8} fill="var(--color-text)" />
          {libelleMarque && (
            <text
              x={X(marque) > W - 190 ? X(marque) - 20 : X(marque) + 20}
              y={yh - 19}
              textAnchor={X(marque) > W - 190 ? "end" : "start"}
              fill="var(--color-text)"
              fontSize={20}
              fontWeight={900}
              className="font-titre"
            >
              {libelleMarque}
            </text>
          )}
        </g>
      )}
    </svg>
    {comptes && (
      <ul className="mt-2 grid grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-6">
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
  rating: number | null;
  rang: number | null;
  total: number;
  saison: string | null;
}

/** Profil : top X %, rang, et répartition avec l'épingle du joueur. */
export function PlaceParmiJoueurs({ repartition, rating, rang, total, saison }: PlaceProps) {
  if (!repartition || rang === null || rating === null) {
    return (
      <div className={CADRE}>
        <Libelle>Place parmi les joueurs classés</Libelle>
        <span className="etape-schema mt-2 block font-titre text-[clamp(3rem,6vw,4.5rem)] leading-[0.85] font-black text-muted" style={delai(0.1)}>
          —
        </span>
        <p className="mt-3 max-w-md text-sm text-text-2">
          {rang === null
            ? `Le rang s'affiche une fois classé, quand l'incertitude passe sous ${RD_SEUIL_CLASSEMENT}.`
            : `Rang ${rang} sur ${total}.`}{" "}
          La répartition de tous les joueurs apparaîtra dès que {SEUIL_REPARTITION} joueurs seront classés.
        </p>
      </div>
    );
  }
  const top = Math.max(1, Math.round((rang / total) * 100));
  return (
    <div className={CADRE}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="etape-schema flex flex-col gap-2" style={delai(0.1)}>
          <Libelle>Place parmi les joueurs classés</Libelle>
          <span className="font-titre text-[clamp(3rem,6vw,4.5rem)] leading-[0.85] font-black uppercase tabular-nums">Top {top} %</span>
        </div>
        <span className="text-sm text-text-2 tabular-nums">
          Rang <b className="font-semibold text-text">{rang}</b> sur <b className="font-semibold text-text">{total}</b>
          {saison && <> · {saison}</>}
        </span>
      </div>
      <div className="mt-4">
        <GrapheRepartition repartition={repartition} marque={rating} libelleMarque={String(arrondir(rating))} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activité des 12 dernières semaines
// ---------------------------------------------------------------------------

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
          <Libelle>Matchs · 12 dernières semaines</Libelle>
          <span className={`font-titre text-[clamp(3rem,6vw,4.5rem)] leading-[0.85] font-black tabular-nums ${somme ? "" : "text-muted"}`}>{somme}</span>
        </div>
        <div className="flex flex-col gap-2">
          <Libelle>Semaines actives</Libelle>
          <span className={`font-titre text-[clamp(3rem,6vw,4.5rem)] leading-[0.85] font-black tabular-nums ${actives ? "" : "text-muted"}`}>
            {actives}
            <span className="text-[0.45em] text-muted">/{SEMAINES_ACTIVITE}</span>
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} 180`} className="mt-4 block h-auto w-full" aria-hidden="true">
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
          const enCours = i === SEMAINES_ACTIVITE - 1;
          return (
            <g key={i}>
              <rect x={x} y={y1 - 110} width={w} height={110} rx={4} fill="var(--color-text)" fillOpacity={0.04} />
              {n > 0 && (
                <g className="etape-schema" style={delai(0.15 + i * 0.04)}>
                  <rect className="monte" style={delai(0.15 + i * 0.04)} x={x} y={y1 - h} width={w} height={h} rx={4} fill="url(#activite-barre)" />
                  <text x={x + w / 2} y={y1 - h - 8} textAnchor="middle" fill="var(--color-text)" fontSize={26} fontWeight={900} className="font-titre">
                    {n}
                  </text>
                </g>
              )}
              <text
                x={i === 0 ? x : enCours ? x + w : x + w / 2}
                y={y1 + 22}
                textAnchor={i === 0 ? "start" : enCours ? "end" : "middle"}
                fill={enCours ? "var(--color-text)" : "var(--color-faint)"}
                fontSize={14}
                className={i === 0 || enCours ? undefined : "max-sm:hidden"}
              >
                {enCours ? "cette sem." : `S-${SEMAINES_ACTIVITE - 1 - i}`}
              </text>
            </g>
          );
        })}
      </svg>
      {somme === 0 && <p className="text-sm text-text-2">Les barres monteront au premier match vérifié.</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preuve et forme
// ---------------------------------------------------------------------------

const TUILE: Record<ResultatForme, string> = {
  V: "bg-[linear-gradient(180deg,rgba(182,255,59,.28),rgba(182,255,59,.1))] text-accent",
  D: "bg-[linear-gradient(180deg,rgba(255,77,79,.24),rgba(255,77,79,.08))] text-danger",
  M: "border border-dashed border-line-strong bg-text/5 text-muted",
};
const NOM_RESULTAT: Record<ResultatForme, string> = { V: "Victoire", D: "Défaite", M: "Décision manuelle" };

export function PreuveForme({ lusChezRiot, manuels, forme }: { lusChezRiot: number; manuels: number; forme: ResultatForme[] }) {
  const total = lusChezRiot + manuels;
  const r = 70;
  const c = 2 * Math.PI * r;
  const part = total ? lusChezRiot / total : 0;
  return (
    <div className={CADRE}>
      <div className="grid items-center gap-6 sm:grid-cols-[11rem_minmax(0,1fr)]">
        <svg viewBox="0 0 190 190" className="etape-schema size-44" style={delai(0.1)} aria-hidden="true">
          <g transform="rotate(-90 95 95)">
            {total ? (
              <>
                <circle cx="95" cy="95" r={r} fill="none" stroke="var(--color-faint)" strokeWidth={16} />
                {lusChezRiot > 0 && (
                  <>
                    <circle cx="95" cy="95" r={r} fill="none" stroke="var(--color-accent)" strokeOpacity={0.25} strokeWidth={26} strokeDasharray={`${part * c} ${c}`} />
                    <circle cx="95" cy="95" r={r} fill="none" stroke="var(--color-accent)" strokeWidth={16} strokeDasharray={`${part * c} ${c}`} />
                  </>
                )}
              </>
            ) : (
              <circle cx="95" cy="95" r={r} fill="none" stroke="var(--color-line-strong)" strokeWidth={16} strokeDasharray="4 8" />
            )}
          </g>
          <text x="95" y={total ? 106 : 110} textAnchor="middle" fill={total ? "var(--color-accent)" : "var(--color-muted)"} fontSize={46} fontWeight={900} className="font-titre">
            {total ? `${Math.round(part * 100)}%` : "—"}
          </text>
          {total > 0 && (
            <text x="95" y="128" textAnchor="middle" fill="var(--color-muted)" fontSize={11} letterSpacing={2}>
              LUS CHEZ RIOT
            </text>
          )}
        </svg>
        <div className="flex flex-col gap-2">
          <Libelle>Preuve</Libelle>
          {total ? (
            <p className="text-sm text-text-2 tabular-nums">
              <b className="font-semibold text-accent">
                {lusChezRiot} match{lusChezRiot > 1 ? "s" : ""}
              </b>{" "}
              lu{lusChezRiot > 1 ? "s" : ""} dans la donnée Riot
              <br />
              <b className="font-semibold text-text">{manuels}</b> tranché{manuels > 1 ? "s" : ""} à la main (hors classement)
            </p>
          ) : (
            <p className="text-sm text-text-2">Aucun match pour l&apos;instant. L&apos;anneau montrera la part de matchs lus chez Riot.</p>
          )}
        </div>
      </div>
      <div className="mt-6">
        <Libelle>
          Forme · 10 derniers <span className="text-faint">(le plus récent à droite)</span>
        </Libelle>
        <ol className="mt-3 grid grid-cols-10 gap-1.5">
          {Array.from({ length: 10 }, (_, i) => {
            const decalage = 10 - forme.length;
            const res = i >= decalage ? forme[i - decalage] : null;
            return (
              <li
                key={i}
                className={`etape-schema grid aspect-square place-items-center rounded-carte font-titre text-[clamp(1rem,2.4vw,1.5rem)] font-black ${
                  res ? TUILE[res] : "border border-dashed border-line"
                }`}
                style={delai(0.4 + i * 0.05)}
              >
                {res && (
                  <>
                    <span aria-hidden="true">{res}</span>
                    <span className="sr-only">{NOM_RESULTAT[res]}</span>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
