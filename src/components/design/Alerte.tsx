import type { ReactNode } from "react";
import Icone from "@/components/design/Icone";

// Message de réussite ou d'erreur après une action (revue visuelle du
// 05/10/2026) : icône + texte, jamais la couleur seule (MASTER §10). Le
// vert reste un filet discret, pas un aplat ; l'erreur garde son rouge.

interface AlerteProps {
  type: "succes" | "erreur";
  className?: string;
  children: ReactNode;
}

export default function Alerte({ type, className = "", children }: AlerteProps) {
  return (
    <p
      role={type === "erreur" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-carte border px-4 py-3 text-sm ${
        type === "erreur" ? "border-danger/40 bg-danger/[0.06] text-danger" : "border-accent/30 bg-accent/[0.05] text-text"
      } ${className}`}
    >
      <Icone nom={type === "erreur" ? "alerte" : "coche"} taille={16} className={`mt-0.5 ${type === "succes" ? "text-accent" : ""}`} />
      <span>{children}</span>
    </p>
  );
}
