"use client";

import { useRef, type ReactNode } from "react";
import { useMomentFort } from "./useMomentFort";

// Moment fort de la page tournoi : « le tableau qui se remplit » (étape 5,
// validée par le porteur le 27/11/2026, durée ~2,5 s acceptée pour ce
// moment). Les tours tombent l'un après l'autre, les connecteurs se tracent,
// ceux d'une victoire lue chez Riot s'illuminent (jamais un verdict manuel),
// puis la carte du vainqueur jaillit. Les vraies cases du tableau, rendues
// par le serveur, sont l'état final (useMomentFort).
//
// Repères posés par Bracket.tsx : data-m="colonne" (avec data-tour),
// "case", "trait" (data-verifie si victoire vérifiée), "champion",
// "rayons".

export default function MomentBracket({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useMomentFort(
    ref,
    (gsap, el) => {
      const colonnes = [...el.querySelectorAll<HTMLElement>('[data-m="colonne"]')];
      const champion = el.querySelector<HTMLElement>('[data-m="champion"]');
      // Tableau long (32 joueurs et plus) : on resserre pour rester sous 3 s.
      const pas = Math.min(0.45, 1.7 / Math.max(1, colonnes.length));
      const tl = gsap.timeline();

      colonnes.forEach((colonne, r) => {
        const t0 = 0.05 + r * pas;
        const titre = colonne.querySelector("h3");
        if (titre) tl.from(titre, { opacity: 0, y: -8, duration: 0.3 }, t0);
        tl.from(
          colonne.querySelectorAll('[data-m="case"]'),
          { opacity: 0, x: -22, duration: 0.35, stagger: Math.min(0.04, 0.4 / colonne.querySelectorAll('[data-m="case"]').length), ease: "power3.out" },
          t0,
        );
        const traits = colonne.querySelectorAll<HTMLElement>('[data-m="trait"]');
        if (traits.length) {
          tl.set(traits, { transformOrigin: "left center" }, 0).from(traits, { scaleX: 0, duration: 0.4, ease: "power2.inOut" }, t0 + 0.25);
        }
        const verifies = colonne.querySelectorAll<HTMLElement>('[data-m="trait"][data-verifie]');
        if (verifies.length) {
          tl.fromTo(
            verifies,
            { filter: "drop-shadow(0 0 0 color-mix(in srgb, var(--color-accent) 0%, transparent))" },
            { filter: "drop-shadow(0 0 6px color-mix(in srgb, var(--color-accent) 90%, transparent))", duration: 0.25, yoyo: true, repeat: 1, ease: "power1.inOut" },
            t0 + 0.55,
          );
        }
      });

      if (champion) {
        const tc = 0.1 + colonnes.length * pas;
        const carte = champion.querySelector('[data-m="carte-champion"]');
        const rayons = champion.querySelector('[data-m="rayons"]');
        const titreChampion = champion.querySelector("h3");
        const traitChampion = champion.querySelector('[data-m="trait"]');
        if (titreChampion) tl.from(titreChampion, { opacity: 0, y: -8, duration: 0.3 }, tc - 0.2);
        if (traitChampion) tl.set(traitChampion, { transformOrigin: "left center" }, 0).from(traitChampion, { scaleX: 0, duration: 0.3, ease: "power2.inOut" }, tc - 0.2);
        tl.from(carte, { scale: 0.45, opacity: 0, duration: 0.5, ease: "back.out(2)" }, tc);
        if (rayons) tl.from(rayons, { scale: 0.3, rotation: -25, opacity: 0, duration: 0.7, ease: "power3.out" }, tc);
      }
      // Rien ne garde un style posé par l'animation une fois finie.
      tl.set(el.querySelectorAll("[data-m], h3"), { clearProps: "opacity,transform,filter,transformOrigin" });
      return tl;
    },
  );

  return (
    <div ref={ref} data-moment="attente" className={className}>
      {children}
    </div>
  );
}
