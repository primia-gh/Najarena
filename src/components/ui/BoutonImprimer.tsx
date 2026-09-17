"use client";

// Export CV premium (offre Elite) — "PDF" au sens du site veut dire
// impression navigateur, pas de dépendance PDF ajoutée : chaque
// navigateur propose déjà "Enregistrer en PDF" dans sa boîte d'impression.
export default function BoutonImprimer() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden rounded-[3px] bg-sceau px-4 py-2 text-sm font-semibold text-papier transition hover:brightness-110"
    >
      Imprimer / Enregistrer en PDF
    </button>
  );
}
