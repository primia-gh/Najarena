// Préférence « animations en pause », posée sur <html data-animations="pause">
// (globals.css fige alors toutes les animations CSS). Exigence d'accessibilité
// relevée par la vérification ui-ux-pro-max du 23/09/2026 : un contenu qui
// bouge seul plus de 5 s (bandeau défilant, boucles de l'accueil) doit
// pouvoir être mis en pause (WCAG 2.2.2). Mémorisée dans le navigateur du
// visiteur uniquement (confort personnel, jamais une donnée à conserver).
// Module client : n'utiliser que depuis des composants "use client".

const CLE = "najarena-animations";

export function animationsEnPause(): boolean {
  return document.documentElement.dataset.animations === "pause";
}

export function definirPause(pause: boolean) {
  if (pause) document.documentElement.dataset.animations = "pause";
  else delete document.documentElement.dataset.animations;
  try {
    if (pause) localStorage.setItem(CLE, "pause");
    else localStorage.removeItem(CLE);
  } catch {
    // Stockage indisponible (navigation privée...) : la pause vaut pour la page en cours.
  }
}

/** Réapplique la préférence mémorisée (au premier affichage). */
export function restaurerPause() {
  try {
    if (localStorage.getItem(CLE) === "pause") document.documentElement.dataset.animations = "pause";
  } catch {
    // Stockage indisponible : animations actives par défaut.
  }
}

/** Abonnement pour useSyncExternalStore : prévient à chaque bascule. */
export function abonnerPause(rappel: () => void) {
  const observateur = new MutationObserver(rappel);
  observateur.observe(document.documentElement, { attributes: true, attributeFilter: ["data-animations"] });
  return () => observateur.disconnect();
}
