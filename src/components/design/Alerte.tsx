import type { ReactNode } from "react";
import Icone from "@/components/design/Icone";
import { typographie } from "@/lib/typographie";

// Message de réussite ou d'erreur après une action (revue visuelle du
// 05/10/2026) : icône + texte, jamais la couleur seule (MASTER §10). Le
// vert reste un filet discret, pas un aplat ; l'erreur garde son rouge.
// « info » (22/11/2026) : une réserve à connaître, ni réussite ni erreur —
// jamais de vert ni de coche (le vert reste réservé à la preuve).

interface AlerteProps {
  type: "succes" | "erreur" | "info";
  className?: string;
  children: ReactNode;
}

export default function Alerte({ type, className = "", children }: AlerteProps) {
  return (
    <p
      role={type === "erreur" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-carte border px-4 py-3 text-sm ${
        type === "erreur"
          ? "border-danger/40 bg-danger/[0.06] text-danger"
          : type === "info"
            ? "border-line-strong bg-surface text-text"
            : "border-accent/30 bg-accent/[0.05] text-text"
      } ${className}`}
    >
      <Icone
        nom={type === "succes" ? "coche" : "alerte"}
        taille={16}
        className={`mt-0.5 ${type === "succes" ? "text-accent" : type === "info" ? "text-muted" : ""}`}
      />
      {/* Espaces insécables (« : », « ; », guillemets) pour tous les
          messages du site, souvent écrits dans le code avec des espaces
          simples. */}
      <span>{typeof children === "string" ? typographie(children) : children}</span>
    </p>
  );
}
