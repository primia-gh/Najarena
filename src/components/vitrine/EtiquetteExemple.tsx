// Étiquette « Exemple » visible (contrôle design du 21/11/2026) : les
// chiffres des illustrations de l'accueil sont fictifs, aucun visiteur ne
// doit les prendre pour un vrai joueur classé. Grise, jamais verte.
export default function EtiquetteExemple({ className = "" }: { className?: string }) {
  return (
    <span
      className={`rounded-bouton border border-line-strong px-2 py-0.5 text-mini font-semibold tracking-[1px] text-text-2 uppercase ${className}`}
    >
      Exemple
    </span>
  );
}
