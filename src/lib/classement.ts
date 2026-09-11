// Constantes du moteur de classement (Glicko-2) — voir CLAUDE.md §4.
// Le moteur lui-même n'existe pas encore (Phase 1) : ces valeurs servent
// uniquement à représenter honnêtement l'état "non calibré" partout où
// aucune ligne `ratings` n'existe encore pour un joueur.
export const RATING_INITIAL = 1500;
export const RD_INITIAL = 350;
export const RD_SEUIL_CLASSEMENT = 150;

// Le moteur calcule en `numeric(7,2)` (précision nécessaire au calcul,
// cf. CLAUDE.md §11), mais aucun affichage public n'a besoin des
// décimales — un rating ou un RD arrondi reste tout aussi vérifiable
// (le détail exact reste dans `rating_events`, jamais caché).
export function arrondir(n: number): number {
  return Math.round(n);
}

export function calibrationPct(rd: number): number {
  const pct = ((RD_INITIAL - rd) / (RD_INITIAL - RD_SEUIL_CLASSEMENT)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export interface Palier {
  nom: string;
  ratingMin: number;
}

// `paliers` doit contenir tous les paliers du jeu, dans n'importe quel
// ordre — le tri se fait ici. Seuils fixes définis dans CLAUDE.md §4.
export function trouverPalier(rating: number, paliers: Palier[]): Palier | null {
  const tries = [...paliers].sort((a, b) => b.ratingMin - a.ratingMin);
  return tries.find((p) => rating >= p.ratingMin) ?? null;
}
