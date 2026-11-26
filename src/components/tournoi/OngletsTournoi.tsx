"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Onglets de la page tournoi (maquette tournoi.dc.html) : des ancres vers
// les sections de la page — tout le contenu reste affiché et lisible par
// Google. L'onglet de la section visible est souligné en vert (vérification
// ui-ux-pro-max : « état actif visible »).
//
// Trait qui glisse (26/11/2026, validé par le porteur) : un seul trait vert,
// déplacé d'un onglet à l'autre en 0,25 s (transform seulement). Tant qu'il
// n'est pas mesuré (rendu serveur, avant hydratation), chaque onglet garde
// sa propre bordure : même rendu serveur et client, pas d'échec
// d'hydratation. Le premier placement ne s'anime pas.

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
  const listeRef = useRef<HTMLUListElement>(null);
  const [trait, setTrait] = useState<{ x: number; largeur: number; anime: boolean } | null>(null);

  useLayoutEffect(() => {
    const placer = () => {
      const lien = listeRef.current?.querySelector<HTMLElement>(`a[href="#${actif}"]`);
      if (!lien) return;
      setTrait((avant) => ({ x: lien.offsetLeft, largeur: lien.offsetWidth, anime: avant !== null }));
    };
    placer();
    window.addEventListener("resize", placer);
    return () => window.removeEventListener("resize", placer);
  }, [actif]);

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
      <ul
        ref={listeRef}
        className="relative mx-auto flex max-w-contenu gap-10 overflow-x-auto overflow-y-hidden border-b border-[rgba(245,245,244,0.1)]"
      >
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
                  estActif
                    ? `${trait ? "border-transparent" : "border-accent"} text-text`
                    : "border-transparent text-muted hover:border-line-strong"
                }`}
              >
                {o.libelle}
              </a>
            </li>
          );
        })}
        {trait && (
          <li
            aria-hidden="true"
            className={`pointer-events-none absolute bottom-0 left-0 h-0.5 w-px origin-left bg-accent ${
              trait.anime ? "transition-transform duration-[250ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none" : ""
            }`}
            style={{ transform: `translateX(${trait.x}px) scaleX(${trait.largeur})` }}
          />
        )}
      </ul>
    </nav>
  );
}
