import type { ReactNode } from "react";
import LibelleSection from "@/components/design/LibelleSection";

// Briques des formulaires longs (revue visuelle du 09/10/2026) : création de
// tournoi, d'équipe, de communauté, profil. Avant : une colonne de champs
// identiques, sans regroupement, et des choix en petits boutons radio.
// Désormais : groupes numérotés (« 01 — Le tournoi »), un libellé et une aide
// par champ, et les choix exclusifs en cartes cliquables — le choix retenu
// se lit à sa bordure claire et à son bouton coché, jamais à la couleur seule.

/** Groupe de champs titré : « 01 — Le tournoi ». */
export function GroupeFormulaire({
  numero,
  titre,
  id,
  children,
}: {
  numero?: string;
  titre: string;
  /** Identifiant du titre (aria-labelledby de la section). */
  id: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-5">
      <LibelleSection as="h2" id={id} numero={numero} className="border-b border-line-strong pb-4">
        {titre}
      </LibelleSection>
      {children}
    </section>
  );
}

/**
 * Champ : libellé au-dessus, aide en dessous. Le champ lui-même est passé en
 * enfant. L'aide reste hors du <label> (elle n'allonge pas le nom du champ) ;
 * `idAide` la relie au champ par aria-describedby.
 */
export function Champ({
  libelle,
  aide,
  idAide,
  children,
}: {
  libelle: ReactNode;
  aide?: ReactNode;
  idAide?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1.5">
        <span className="font-texte text-mini font-medium text-muted uppercase">{libelle}</span>
        {children}
      </label>
      {aide && (
        <span id={idAide} className="text-xs leading-normal text-muted">
          {aide}
        </span>
      )}
    </div>
  );
}

/** Choix en carte (bouton radio ou case à cocher). */
export function Choix({
  type = "radio",
  name,
  value,
  defaultChecked,
  titre,
  detail,
}: {
  type?: "radio" | "checkbox";
  name: string;
  value: string;
  defaultChecked?: boolean;
  titre: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-carte border border-line-strong p-4 transition-colors duration-200 hover:border-[rgba(245,245,244,0.25)] has-[:checked]:border-text has-[:checked]:bg-[rgba(245,245,244,0.03)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
      <input
        type={type}
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-accent"
      />
      <span className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-text">{titre}</span>
        {detail && <span className="text-xs leading-normal text-muted">{detail}</span>}
      </span>
    </label>
  );
}
