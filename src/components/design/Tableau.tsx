import type { ReactNode } from "react";

// Tableau de la nouvelle identité (MASTER §6) — styles dans globals.css
// (.tableau). Sur petit écran, le tableau défile dans son propre cadre,
// jamais la page entière. `legende` est lue par les lecteurs d'écran.
// Le cadre qui défile est atteignable au clavier (tabIndex + région
// nommée) : sinon un utilisateur sans souris ne peut pas faire défiler
// les colonnes masquées (vérification ui-ux-pro-max du 23/09/2026).

interface TableauProps {
  legende: string;
  className?: string;
  children: ReactNode;
}

export default function Tableau({ legende, className = "", children }: TableauProps) {
  return (
    <div
      role="region"
      aria-label={legende}
      tabIndex={0}
      className={`overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${className}`}
    >
      <table className="tableau">
        <caption className="sr-only">{legende}</caption>
        {children}
      </table>
    </div>
  );
}
