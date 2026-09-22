// Remplace le sceau de fiabilité (décision du 23/09/2026, refonte « Venin ») :
// « CONFIRMÉ » / « PROVISOIRE » + pourcentage de confiance. Les deux valeurs
// viennent de la base, rien n'est recalculé ici : `estClasse` = ratings.est_classe
// (RD ≤ 150), `pct` = calibrationPct(rd) de lib/classement — le même chiffre
// que remplissait l'ancien sceau.

interface IndicateurConfianceProps {
  estClasse: boolean;
  pct: number;
  className?: string;
}

export default function IndicateurConfiance({ estClasse, pct, className = "" }: IndicateurConfianceProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span
        className={`font-texte text-xs font-semibold uppercase tracking-[2px] ${estClasse ? "text-accent" : "text-muted"}`}
      >
        {estClasse ? "Confirmé" : "Provisoire"}
      </span>
      <span className="font-texte text-xs text-muted tabular-nums">Confiance {pct} %</span>
    </div>
  );
}
