import Link from "next/link";
import type { ReactNode } from "react";
import Illustration, { type NomDessin } from "@/components/illustrations/Illustration";
import Apparition from "./Apparition";
import Icone from "./Icone";
import LibelleSection from "./LibelleSection";

// En-tête de page unique (harmonisation du 26/11/2026, validée par le
// porteur) : lien de retour facultatif, surtitre, titre, introduction,
// boutons, et un bloc facultatif à droite (chiffres clés, bouton).
// Mêmes écarts sur toutes les pages : avant, chaque page écrivait son titre
// à la main avec quatre marges différentes.
//
// `intro` est rendu dans un <p> : n'y mettre que du texte et des liens.

interface EnTetePageProps {
  titre: ReactNode;
  surtitre?: ReactNode;
  intro?: ReactNode;
  retour?: { href: string; libelle: string };
  /** Boutons ou liens sous l'introduction. */
  actions?: ReactNode;
  /** Bloc aligné en bas à droite sur grand écran (chiffres, bouton). */
  aside?: ReactNode;
  /** Classes ajoutées au titre (couleur d'une seconde ligne, taille). */
  classeTitre?: string;
  /** Classes ajoutées à l'introduction (largeur). */
  classeIntro?: string;
  /** Sans fondu d'apparition : titre visible dès le premier affichage
   *  (pages légales, où il est l'élément principal). */
  sansApparition?: boolean;
  /** Illustration maison à droite du titre, sur grand écran seulement. */
  illustration?: NomDessin;
  /** Page de formulaire (profil, création d'équipe, de tournoi…) : titre
   *  en text-sous-titre, règle du 09/10/2026 (jamais text-section),
   *  et introduction en taille de base comme avant la migration. */
  formulaire?: boolean;
}

export default function EnTetePage({
  titre,
  surtitre,
  intro,
  retour,
  actions,
  aside,
  classeTitre = "",
  classeIntro = "",
  sansApparition = false,
  formulaire = false,
  illustration,
}: EnTetePageProps) {
  const Conteneur = sansApparition ? "div" : Apparition;
  return (
    <Conteneur
      className={`flex flex-wrap items-end justify-between gap-x-10 gap-y-8 ${illustration ? "lg:flex-nowrap" : ""}`}
    >
      <div className={`min-w-0 max-w-full ${illustration ? "lg:flex-1" : ""}`}>
        {retour && (
          <Link
            href={retour.href}
            className="-mt-3 mb-3 inline-flex min-h-11 items-center gap-2 font-texte text-xs tracking-[3px] text-muted uppercase transition-colors duration-200 hover:text-text"
          >
            <Icone nom="fleche-gauche" taille={14} />
            {retour.libelle}
          </Link>
        )}
        {surtitre && <LibelleSection>{surtitre}</LibelleSection>}
        <h1
          className={`${surtitre ? "mt-4" : ""} font-titre ${formulaire ? "text-sous-titre" : "text-section"} font-black tracking-[1px] text-balance uppercase hyphens-auto [overflow-wrap:anywhere] ${classeTitre}`}
        >
          {titre}
        </h1>
        {intro && <p className={`mt-5 max-w-2xl ${formulaire ? "" : "text-courant"} text-text-2 ${classeIntro}`}>{intro}</p>}
        {actions && <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">{actions}</div>}
      </div>
      {illustration ? (
        <div className="flex shrink-0 flex-col items-end gap-6">
          {/* Le bouton ou les chiffres passent avant le dessin, qui se fait plus petit. */}
          {aside}
          <Illustration
            nom={illustration}
            className={`hidden lg:block ${aside ? "w-[18rem] xl:w-[20rem]" : "w-[23rem] xl:w-[26rem]"}`}
          />
        </div>
      ) : (
        aside
      )}
    </Conteneur>
  );
}
