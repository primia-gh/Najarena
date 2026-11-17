import { LIBELLE_PHASE, LIBELLE_ZONE, TAILLE_CARTE, type CarteMorts as DonneesCarte } from "@/lib/carte-morts";

// Carte des morts du bilan (étape 2, 05/10/2026) : une carte schématique de
// la Faille de l'invocateur dessinée par nos soins — un carré, la rivière,
// trois voies, deux bases ; aucun visuel Riot. Vue du côté du joueur : sa
// base en bas à gauche. Chaque point est une mort ; son lieu et sa minute
// s'affichent au survol. La répartition chiffrée suit en texte, lisible
// sans la carte.

const LARGEUR_RIVIERE = (1500 / TAILLE_CARTE) * 100;

function versSvg(x: number, y: number): { cx: number; cy: number } {
  return { cx: (x / TAILLE_CARTE) * 100, cy: 100 - (y / TAILLE_CARTE) * 100 };
}

export default function CarteMorts({ carte }: { carte: DonneesCarte }) {
  const r = LARGEUR_RIVIERE;
  const zonePrincipale = carte.parZone[0];
  const phasePrincipale = carte.parPhase[0];
  const resume = `${carte.morts.length} morts sur ${carte.parties} parties : ${Math.round(zonePrincipale.part * 100)} % dans ${LIBELLE_ZONE[zonePrincipale.cle]}, ${Math.round(phasePrincipale.part * 100)} % ${LIBELLE_PHASE[phasePrincipale.cle]}.`;
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,22rem)_1fr]">
      <svg viewBox="0 0 100 100" className="h-auto w-full max-w-[22rem]" role="img" aria-label={resume}>
        <rect x="0.5" y="0.5" width="99" height="99" rx="2" className="fill-surface stroke-line-strong" strokeWidth="0.5" />
        {/* Rivière : bande diagonale du coin haut gauche au coin bas droit. */}
        <polygon
          points={`0,0 ${r},0 100,${100 - r} 100,100 ${100 - r},100 0,${r}`}
          className="fill-text-2"
          fillOpacity="0.07"
        />
        {/* Voies : haut (bord gauche puis haut), milieu (diagonale), bas (bord bas puis droit). */}
        <g className="stroke-line-strong" strokeWidth="2.4" strokeLinecap="round" fill="none">
          <polyline points="7,74 7,7 74,7" />
          <line x1="20" y1="80" x2="80" y2="20" />
          <polyline points="26,93 93,93 93,26" />
        </g>
        {/* Bases. */}
        <path d="M0.5,74 L26,74 L26,99.5 L0.5,99.5 Z" className="fill-text-2" fillOpacity="0.1" />
        <path d="M74,0.5 L99.5,0.5 L99.5,26 L74,26 Z" className="fill-text-2" fillOpacity="0.1" />
        {carte.morts.map((m, i) => {
          const { cx, cy } = versSvg(m.x, m.y);
          return (
            <circle key={i} cx={cx} cy={cy} r="1.3" className="fill-danger" fillOpacity="0.6">
              <title>{`${LIBELLE_ZONE[m.zone]}, ${Math.floor(m.seconde / 60)} min — partie ${m.gagne ? "gagnée" : "perdue"}`}</title>
            </circle>
          );
        })}
        <text x="3" y="97" fontSize="3.2" className="fill-faint font-texte">
          Ta base
        </text>
        <text x="97" y="5.5" fontSize="3.2" textAnchor="end" className="fill-faint font-texte">
          Base adverse
        </text>
      </svg>
      <div className="flex flex-col gap-5 text-sm">
        <p className="text-text-2">{resume}</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="font-texte text-mini font-medium tracking-[3px] text-faint uppercase">Où</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {carte.parZone
                .filter((z) => z.nombre > 0)
                .map((z) => (
                  <li key={z.cle} className="flex justify-between gap-4 tabular-nums">
                    <span className="text-text-2 first-letter:uppercase">{LIBELLE_ZONE[z.cle]}</span>
                    <span className="text-text">{Math.round(z.part * 100)} %</span>
                  </li>
                ))}
            </ul>
          </div>
          <div>
            <p className="font-texte text-mini font-medium tracking-[3px] text-faint uppercase">Quand</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {carte.parPhase
                .filter((p) => p.nombre > 0)
                .map((p) => (
                  <li key={p.cle} className="flex justify-between gap-4 tabular-nums">
                    <span className="text-text-2 first-letter:uppercase">{LIBELLE_PHASE[p.cle]}</span>
                    <span className="text-text">{Math.round(p.part * 100)} %</span>
                  </li>
                ))}
            </ul>
          </div>
        </div>
        <p className="text-xs text-faint">
          Vue de ton côté : ta base en bas à gauche, quel que soit ton côté dans la partie. Zones approximatives, d&apos;après
          le lieu de chaque mort dans la chronologie Riot.
        </p>
      </div>
    </div>
  );
}
