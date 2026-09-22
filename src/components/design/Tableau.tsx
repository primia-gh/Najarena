import type { ReactNode } from "react";

// Tableau de la nouvelle identité (MASTER §6) — styles dans globals.css
// (.tableau). Sur petit écran, le tableau défile dans son propre cadre,
// jamais la page entière. `legende` est lue par les lecteurs d'écran.

interface TableauProps {
  legende: string;
  className?: string;
  children: ReactNode;
}

export default function Tableau({ legende, className = "", children }: TableauProps) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="tableau">
        <caption className="sr-only">{legende}</caption>
        {children}
      </table>
    </div>
  );
}
