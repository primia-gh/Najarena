import type { Metadata } from "next";
import BoutonLien from "@/components/design/BoutonLien";
import FondEcailles from "@/components/design/FondEcailles";
import LibelleSection from "@/components/design/LibelleSection";

// Page introuvable (21/11/2026, contrôle design complet) : remplace la page
// 404 anglaise par défaut de Next. Rendue dans le layout du site (barre de
// navigation et pied de page). Next ajoute de lui-même « noindex ».

export const metadata: Metadata = {
  title: "Page introuvable — Najarena",
};

export default function PageIntrouvable() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-6 px-grille *:max-w-3xl">
        <LibelleSection>Erreur 404</LibelleSection>
        <h1 className="font-titre text-section font-black tracking-[1px] uppercase">Page introuvable.</h1>
        <p className="text-courant text-text-2">
          Cette adresse ne mène nulle part : le lien est peut-être ancien, ou le joueur, l&apos;équipe ou le tournoi a
          changé d&apos;adresse.
        </p>
        <div className="flex flex-wrap gap-3">
          <BoutonLien href="/lol/tournois">Voir les tournois</BoutonLien>
          <BoutonLien href="/lol/classement" variante="contour">
            Voir le classement
          </BoutonLien>
          <BoutonLien href="/" variante="contour">
            Retour à l&apos;accueil
          </BoutonLien>
        </div>
      </div>
    </main>
  );
}
