import type { ReactNode } from "react";
import Panneau from "./Panneau";
import Illustration, { type NomDessin } from "@/components/illustrations/Illustration";

// Message « rien pour l'instant » d'une page (harmonisation du 26/11/2026,
// validée par le porteur) : un seul modèle, celui du classement — panneau à
// repères de visée, titre court, une phrase, et une action utile quand il y
// en a une. Le site est jeune : ce message est souvent ce que le visiteur
// voit en premier, il doit être aussi soigné qu'une liste pleine.
//
// Pour un bloc vide À L'INTÉRIEUR d'un panneau (historique du profil,
// sous-partie d'une page), garder une simple phrase : pas de panneau dans
// un panneau.

interface EtatVideProps {
  titre: ReactNode;
  children?: ReactNode;
  /** Boutons ou liens (BoutonLien variante « secondaire » de préférence). */
  actions?: ReactNode;
  className?: string;
  /** Petit dessin maison à gauche (décoratif). */
  illustration?: NomDessin;
}

export default function EtatVide({ titre, children, actions, className = "", illustration }: EtatVideProps) {
  const contenu = (
    <>
      <p className="font-titre text-sous-titre font-black text-balance uppercase">{titre}</p>
      {children && <div className="max-w-xl text-text-2">{children}</div>}
      {actions && <div className="flex flex-wrap items-center gap-x-8 gap-y-3">{actions}</div>}
    </>
  );
  if (!illustration) {
    return <Panneau reperes className={`flex flex-col items-start gap-4 p-8 sm:p-10 ${className}`}>{contenu}</Panneau>;
  }
  return (
    <Panneau reperes className={`grid items-center gap-6 p-8 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:p-10 ${className}`}>
      <Illustration nom={illustration} className="w-16 sm:w-26" />
      <div className="flex flex-col items-start gap-4">{contenu}</div>
    </Panneau>
  );
}
