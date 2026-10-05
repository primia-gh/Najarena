import { FUSEAU_PARIS } from "@/lib/tournois-auto/creneaux";
import { formaterIndicateur, INDICATEURS, type SerieProgression } from "@/lib/bilan";

// Un indicateur du bilan, partie par partie : chaque partie est un point
// (plein = victoire, creux = défaite), la ligne verte est la moyenne des 5
// dernières parties (à partir de la 5e), le pointillé la moyenne des
// vainqueurs quand elle existe. Dessiné côté serveur en SVG, sans
// JavaScript ; chaque point donne sa date, sa valeur et le résultat au
// survol. Les libellés sont en HTML, posés sur le dessin : ils gardent la
// même taille quelle que soit la largeur de l'écran.

const LARGEUR = 360;
const HAUTEUR = 150;
const MARGE_X = 6; // les points ne débordent pas du cadre
const MARGE_Y = 8;

const JOUR = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", timeZone: FUSEAU_PARIS });

export function dateCourte(iso: string): string {
  return JOUR.format(new Date(iso));
}

const LIBELLE = "pointer-events-none absolute font-texte text-[11px] leading-none tabular-nums";

export default function CourbeIndicateur({ serie }: { serie: SerieProgression }) {
  const def = INDICATEURS[serie.indicateur];
  const points = serie.points;
  const valeurs = points.flatMap((p) => (p.moyenne === null ? [p.valeur] : [p.valeur, p.moyenne]));
  if (serie.repere !== null) valeurs.push(serie.repere);
  let bas = Math.min(...valeurs);
  let haut = Math.max(...valeurs);
  if (def.pourcentage) {
    bas = 0;
    haut = 1;
  } else {
    const marge = (haut - bas) * 0.12 || Math.max(Math.abs(haut) * 0.1, 1);
    bas = Math.max(0, bas - marge);
    haut += marge;
  }
  const largeurUtile = LARGEUR - 2 * MARGE_X;
  const x = (i: number) => MARGE_X + (points.length === 1 ? largeurUtile : (i / (points.length - 1)) * largeurUtile);
  const y = (v: number) => MARGE_Y + (1 - (v - bas) / (haut - bas)) * (HAUTEUR - 2 * MARGE_Y);
  const enPourcent = (v: number) => `${((y(v) / HAUTEUR) * 100).toFixed(2)}%`;
  const fmt = (v: number) => formaterIndicateur(serie.indicateur, v);
  const moyennes = points.flatMap((p, i) => (p.moyenne === null ? [] : [{ i, v: p.moyenne }]));
  const trace = moyennes.map(({ i, v }) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const fin = moyennes[moyennes.length - 1];
  const dernier = points[points.length - 1];

  const resume =
    `${def.libelle}, ${points.length} parties` +
    (fin ? ` : ${fmt(fin.v)} en moyenne sur les 5 dernières` : "") +
    (serie.precedente !== null ? `, contre ${fmt(serie.precedente)} sur les 5 d'avant` : "") +
    (serie.repere !== null ? ` ; moyenne des vainqueurs ${fmt(serie.repere)}.` : ".");

  return (
    <div className="flex flex-col gap-2 pl-10">
      <div className="relative">
        <svg viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} className="block h-auto w-full" role="img" aria-label={resume}>
          {/* Bas et haut de l'échelle : traits fins, en retrait. */}
          <line x1={0} x2={LARGEUR} y1={y(bas)} y2={y(bas)} className="stroke-line-strong" strokeWidth="1" />
          <line x1={0} x2={LARGEUR} y1={y(haut)} y2={y(haut)} className="stroke-line" strokeWidth="1" />
          {serie.repere !== null && (
            <line
              x1={0}
              x2={LARGEUR}
              y1={y(serie.repere)}
              y2={y(serie.repere)}
              className="stroke-text-2"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          )}
          {points.map((p, i) => (
            <circle
              key={`p${i}`}
              cx={x(i)}
              cy={y(p.valeur)}
              r="4"
              className={p.gagne ? "fill-muted stroke-bg" : "fill-bg stroke-muted"}
              strokeWidth={p.gagne ? 1 : 1.5}
            />
          ))}
          {moyennes.length > 1 && (
            <polyline
              points={trace}
              fill="none"
              className="stroke-accent"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {fin && <circle cx={x(fin.i)} cy={y(fin.v)} r="4" className="fill-accent stroke-bg" strokeWidth="2" />}
          {/* Zones de survol plus grandes que les points (24 unités). */}
          {points.map((p, i) => (
            <circle key={`s${i}`} cx={x(i)} cy={y(p.valeur)} r="12" fill="transparent">
              <title>
                {`${dateCourte(p.joueLe)} · ${fmt(p.valeur)} · ${p.gagne ? "victoire" : "défaite"}` +
                  (p.moyenne === null ? "" : ` (moyenne sur 5 parties : ${fmt(p.moyenne)})`)}
              </title>
            </circle>
          ))}
        </svg>
        <div aria-hidden="true">
          {[bas, haut].map((v, n) => (
            <span
              key={n}
              className={`${LIBELLE} -left-10 w-8 -translate-y-1/2 text-right text-faint`}
              style={{ top: enPourcent(v) }}
            >
              {fmt(v)}
            </span>
          ))}
          {serie.repere !== null && (
            <span
              className={`${LIBELLE} right-0 -translate-y-full rounded-bouton bg-bg/70 px-1 pb-1 text-text-2`}
              style={{ top: enPourcent(serie.repere) }}
            >
              Vainqueurs : {fmt(serie.repere)}
            </span>
          )}
        </div>
      </div>
      <div aria-hidden="true" className="flex justify-between font-texte text-[11px] text-faint tabular-nums">
        <span>{dateCourte(points[0].joueLe)}</span>
        <span>{dateCourte(dernier.joueLe)}</span>
      </div>
    </div>
  );
}
