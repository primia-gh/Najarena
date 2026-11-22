"use client";

import BoutonLien from "@/components/design/BoutonLien";
import FondEcailles from "@/components/design/FondEcailles";
import LibelleSection from "@/components/design/LibelleSection";
import { classeBoutonPrincipal } from "@/lib/design";

// Erreur inattendue (21/11/2026, contrôle design complet) : page en
// français aux couleurs du site, avec « Réessayer » (dans cette version de
// Next, la relance s'appelle `retry`). Le détail de l'erreur n'est jamais
// affiché : en production, Next n'envoie au navigateur qu'un identifiant.

export default function ErreurInattendue({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-6 px-grille *:max-w-3xl">
        <LibelleSection>Erreur</LibelleSection>
        <h1 className="font-titre text-section font-black tracking-[1px] uppercase">Quelque chose a coincé.</h1>
        <p className="text-courant text-text-2">
          La page n&apos;a pas pu s&apos;afficher. Aucun résultat ni aucun point n&apos;est touché par cette erreur :
          réessaie dans un instant.
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => retry()} className={`cursor-pointer ${classeBoutonPrincipal()}`}>
            Réessayer
          </button>
          <BoutonLien href="/" variante="contour">
            Retour à l&apos;accueil
          </BoutonLien>
        </div>
      </div>
    </main>
  );
}
