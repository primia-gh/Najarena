// Icône d'app générée à partir du même motif que le sceau de fiabilité
// (SceauFiabilite.tsx, CLAUDE.md §7 : élément signature du site) — jamais
// un logo inventé séparément. Couronne pleine (calibrage 100%) sur fond
// encre, aux couleurs exactes de la direction artistique.

export function sceauIconSvg(taille: number) {
  const nombreCrans = 32;
  const centre = 60;
  const rayonInterieur = 40;
  const rayonExterieur = 54;

  const crans = Array.from({ length: nombreCrans }, (_, i) => {
    const angle = (i / nombreCrans) * Math.PI * 2 - Math.PI / 2;
    return {
      x1: centre + Math.cos(angle) * rayonInterieur,
      y1: centre + Math.sin(angle) * rayonInterieur,
      x2: centre + Math.cos(angle) * rayonExterieur,
      y2: centre + Math.sin(angle) * rayonExterieur,
    };
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#12161D",
      }}
    >
      <svg width={taille * 0.82} height={taille * 0.82} viewBox="0 0 120 120">
        {crans.map((c, i) => (
          <line
            key={i}
            x1={c.x1}
            y1={c.y1}
            x2={c.x2}
            y2={c.y2}
            stroke="#7E2233"
            strokeWidth={3}
          />
        ))}
        <circle cx={centre} cy={centre} r={33} fill="none" stroke="#7E2233" strokeWidth={4} />
      </svg>
    </div>
  );
}
