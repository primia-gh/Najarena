import type { ReactNode } from "react";

// Carte d'état vide générique — illustration décorative (voir
// Illustration*Vide.tsx) au-dessus d'un court texte, centrée. Toujours
// accent "none" comme classeCarte("none") : un état vide n'est jamais
// une alerte. Padding propre plutôt que classeCarte(), dont le p-4 est
// pensé pour du texte seul, pas pour porter une illustration.
export default function EtatVide({ illustration, children }: { illustration: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-[3px] border border-trait border-l-[3px] border-l-trait bg-carte px-6 py-10 text-center shadow-[0_1px_2px_rgba(18,22,29,0.05),0_10px_24px_-16px_rgba(18,22,29,0.15)]">
      {illustration}
      <p className="mt-4 max-w-xs text-sm text-ardoise">{children}</p>
    </div>
  );
}
