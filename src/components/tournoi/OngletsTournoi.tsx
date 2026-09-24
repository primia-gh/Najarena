"use client";

import { useEffect, useRef, useState } from "react";

// Onglets de la page tournoi (maquette tournoi.dc.html) : des ancres vers
// les sections de la page — tout le contenu reste affiché et lisible par
// Google. L'onglet de la section visible est souligné en vert (vérification
// ui-ux-pro-max : « état actif visible »).

const ONGLETS = [
  { id: "bracket", libelle: "Bracket" },
  { id: "inscrits", libelle: "Inscrits" },
  { id: "deroulement", libelle: "Déroulement" },
  { id: "reglement", libelle: "Règlement" },
];

export default function OngletsTournoi() {
  const [actif, setActif] = useState(ONGLETS[0].id);
  // Après un clic, l'onglet choisi reste actif le temps du défilement :
  // « Déroulement » et « Règlement » sont côte à côte sur ordinateur, les
  // deux apparaissent en même temps à l'écran.
  const verrouJusqua = useRef(0);

  useEffect(() => {
    // On observe le bloc entier de chaque section (pour « Déroulement » et
    // « Règlement », l'ancre est sur le titre : on remonte à son bloc).
    const idParCible = new Map<Element, string>();
    for (const o of ONGLETS) {
      const ancre = document.getElementById(o.id);
      const bloc = ancre?.tagName === "SECTION" ? ancre : ancre?.closest("section");
      if (bloc) idParCible.set(bloc, o.id);
    }
    const observateur = new IntersectionObserver(
      (entrees) => {
        const visible = entrees.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        const id = visible ? idParCible.get(visible.target) : undefined;
        if (id && Date.now() > verrouJusqua.current) setActif(id);
      },
      { rootMargin: "-120px 0px -55% 0px" },
    );
    idParCible.forEach((_, bloc) => observateur.observe(bloc));
    return () => observateur.disconnect();
  }, []);

  return (
    <nav aria-label="Sections du tournoi" className="px-gouttiere">
      <ul className="mx-auto flex max-w-contenu gap-10 overflow-x-auto overflow-y-hidden border-b border-[rgba(245,245,244,0.1)]">
        {ONGLETS.map((o) => {
          const estActif = actif === o.id;
          return (
            <li key={o.id}>
              <a
                href={`#${o.id}`}
                onClick={() => {
                  verrouJusqua.current = Date.now() + 1200;
                  setActif(o.id);
                }}
                aria-current={estActif ? "location" : undefined}
                className={`inline-flex min-h-11 items-center border-b-2 py-[18px] text-[13px] font-semibold tracking-[3px] whitespace-nowrap uppercase transition-colors duration-200 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  estActif ? "border-accent text-text" : "border-transparent text-muted hover:border-line-strong"
                }`}
              >
                {o.libelle}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
