"use client";

// Moments forts animés (étape 5 du plan « site plus visuel », validée par le
// porteur le 27/11/2026) : le rating qui monte (accueil), le tableau qui se
// remplit (page tournoi), le verdict qui se scelle (page de preuve).
//
// Règles :
// - GSAP n'est chargé QUE par ce crochet, à la demande (import dynamique) :
//   les autres pages ne téléchargent rien.
// - Le HTML rendu par le serveur est l'état FINAL (vraies données, page
//   complète sans JavaScript). L'élément porte data-moment="attente" : la
//   feuille de style le masque le temps que l'animation démarre (pas de
//   flash de l'état final), sauf mouvement réduit ou JavaScript coupé
//   (<noscript> du layout), où il s'affiche directement.
// - Une seule fois, à l'entrée à l'écran, moins de 3 s, puis plus rien ne
//   bouge : pas de bouton Pause nécessaire (CLAUDE.md §7, 5 s).
// - Ne jamais rendre un élément différent selon le mouvement réduit pendant
//   le rendu : la décision se prend ici, après l'hydratation.

import { useEffect, type RefObject } from "react";

type Gsap = typeof import("gsap").gsap;
type Timeline = ReturnType<Gsap["timeline"]>;

/** Filet de sécurité : si l'outil ne se charge pas, l'élément s'affiche. */
const DELAI_SECOURS_MS = 2500;

export function useMomentFort(
  ref: RefObject<HTMLElement | null>,
  construire: (gsap: Gsap, element: HTMLElement) => Timeline,
  options: { marge?: string } = {},
) {
  // Déclenché dès que le haut de l'élément passe la ligne des 85 % de
  // l'écran : un seuil en part de surface ne marche pas pour un grand
  // tableau qui défile de côté (sa partie hors cadre compte comme cachée).
  const marge = options.marge ?? "0px 0px -15% 0px";
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const afficher = () => {
      element.dataset.moment = "fini";
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      afficher();
      return;
    }
    let timeline: Timeline | null = null;
    let annule = false;
    let secours: ReturnType<typeof setTimeout> | null = null;

    const lancer = () => {
      secours = setTimeout(afficher, DELAI_SECOURS_MS);
      import("gsap")
        .then(({ gsap }) => {
          if (annule) return;
          if (secours) clearTimeout(secours);
          element.dataset.moment = "joue";
          timeline = construire(gsap, element);
          timeline.eventCallback("onComplete", afficher);
        })
        .catch(afficher);
    };

    const observateur = new IntersectionObserver(
      (entrees) => {
        if (!entrees.some((e) => e.isIntersecting)) return;
        observateur.disconnect();
        lancer();
      },
      { threshold: 0, rootMargin: marge },
    );
    observateur.observe(element);

    return () => {
      annule = true;
      observateur.disconnect();
      if (secours) clearTimeout(secours);
      // Départ de la page en pleine animation : on la termine, rien ne reste
      // à mi-chemin si le composant est réutilisé.
      timeline?.progress(1).kill();
    };
    // construire est défini une fois par composant ; marge est une constante.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);
}

/** Brouille une empreinte puis la fige, caractère par caractère (effet). */
export function brouillerEmpreinte(gsap: Gsap, element: HTMLElement, duree: number): Timeline {
  const cible = element.textContent ?? "";
  const hex = "0123456789abcdef";
  const etat = { p: 0 };
  return gsap.timeline().to(etat, {
    p: 1,
    duration: duree,
    ease: "none",
    onUpdate: () => {
      const n = Math.floor(etat.p * cible.length);
      let s = cible.slice(0, n);
      for (let i = n; i < cible.length; i++) s += /[0-9a-f]/.test(cible[i]) ? hex[(Math.random() * 16) | 0] : cible[i];
      element.textContent = s;
    },
    onComplete: () => {
      element.textContent = cible;
    },
  });
}
