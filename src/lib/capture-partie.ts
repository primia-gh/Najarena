import type { ParticipantMatchRiot } from "@/lib/riot";

// Bilan du joueur, étape 1 (05/10/2026) : ce qu'on garde d'une partie
// vérifiée, en plus des 8 chiffres d'origine. Tout vient de la fiche de
// partie que le site lit déjà chez Riot pour trouver le résultat : aucun
// appel de plus. Des valeurs choisies seulement, jamais la fiche brute.
// Logique pure, testée dans capture-partie.test.ts.

const POSTES = new Set(["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]);
const SORT_CHATIMENT = 11;
// Objet de support (« Atlas mondial ») et ses évolutions.
const OBJETS_SUPPORT = new Set([3865, 3866, 3867, 3869, 3870, 3871, 3876, 3877]);

export interface ColonnesDetailsPartie {
  champion_id: number | null;
  niveau: number | null;
  poste: string | null;
  objets: number[];
  balise: number | null;
  sorts: number[];
  style_principal: number | null;
  rune_principale: number | null;
  runes: number[];
  style_secondaire: number | null;
  fragments: number[];
  degats_champions: number | null;
  degats_subis: number | null;
  degats_attenues: number | null;
  degats_batiments: number | null;
  soins: number | null;
  controle_secondes: number | null;
  score_vision: number | null;
  balises_posees: number | null;
  balises_detruites: number | null;
  balises_controle: number | null;
  tours_detruites: number | null;
  premier_sang: boolean | null;
  premiere_tour: boolean | null;
  multi_kill_max: number | null;
  solo_kills: number | null;
  part_kills: number | null;
  part_degats: number | null;
  sbires_10: number | null;
  temps_mort_secondes: number | null;
  patch: string | null;
  joue_le: string | null;
}

/** « 15.19.715.1234 » → « 15.19 » ; nul si la version est absente ou inattendue. */
export function patchDeVersion(version: string | undefined): string | null {
  const m = /^(\d{1,2})\.(\d{1,2})(\.|$)/.exec(version ?? "");
  return m ? `${Number(m[1])}.${Number(m[2])}` : null;
}

function entier(valeur: unknown, max = 2_000_000_000): number | null {
  return typeof valeur === "number" && Number.isFinite(valeur) ? Math.min(max, Math.max(0, Math.round(valeur))) : null;
}

function petit(valeur: unknown): number | null {
  return entier(valeur, 32_767);
}

/** Part entre 0 et 1, trois décimales. */
function part(valeur: unknown): number | null {
  return typeof valeur === "number" && Number.isFinite(valeur)
    ? Math.round(Math.min(1, Math.max(0, valeur)) * 1000) / 1000
    : null;
}

function booleen(valeur: unknown): boolean | null {
  return typeof valeur === "boolean" ? valeur : null;
}

function objetsDe(p: ParticipantMatchRiot): number[] {
  return [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].filter(
    (o): o is number => typeof o === "number" && o > 0,
  );
}

/**
 * Poste de la partie. Dans les parties personnalisées, Riot ne le donne
 * souvent pas : seuls les cas sans ambiguïté sont déduits (Châtiment =
 * jungle, objet de support = support), puis l'estimation de Riot pour le
 * joueur seul (individualPosition). Sinon, aucun poste.
 */
export function posteDeLaPartie(p: ParticipantMatchRiot): string | null {
  if (p.teamPosition && POSTES.has(p.teamPosition)) return p.teamPosition;
  if (p.summoner1Id === SORT_CHATIMENT || p.summoner2Id === SORT_CHATIMENT) return "JUNGLE";
  if (objetsDe(p).some((o) => OBJETS_SUPPORT.has(o))) return "UTILITY";
  if (p.individualPosition && POSTES.has(p.individualPosition)) return p.individualPosition;
  return null;
}

export function detailsPartie(
  p: ParticipantMatchRiot,
  partie: { versionJeu?: string; debut?: number },
): ColonnesDetailsPartie {
  const styles = p.perks?.styles ?? [];
  const principal = styles.find((s) => s.description === "primaryStyle") ?? styles[0];
  const secondaire = styles.find((s) => s.description === "subStyle") ?? styles[1];
  const choix = (style: typeof principal) =>
    (style?.selections ?? []).map((s) => s.perk).filter((x): x is number => typeof x === "number" && x > 0);
  const runes = [...choix(principal), ...choix(secondaire)].slice(0, 6);
  const fragments = [p.perks?.statPerks?.offense, p.perks?.statPerks?.flex, p.perks?.statPerks?.defense].filter(
    (x): x is number => typeof x === "number" && x > 0,
  );
  const sorts = [p.summoner1Id, p.summoner2Id].filter((x): x is number => typeof x === "number" && x > 0);
  const premiereTour =
    typeof p.firstTowerKill === "boolean" || typeof p.firstTowerAssist === "boolean"
      ? Boolean(p.firstTowerKill) || Boolean(p.firstTowerAssist)
      : null;

  return {
    champion_id: entier(p.championId),
    niveau: petit(p.champLevel),
    poste: posteDeLaPartie(p),
    objets: objetsDe(p),
    balise: p.item6 && p.item6 > 0 ? p.item6 : null,
    sorts,
    style_principal: entier(principal?.style),
    rune_principale: choix(principal)[0] ?? null,
    runes,
    style_secondaire: entier(secondaire?.style),
    fragments,
    degats_champions: entier(p.totalDamageDealtToChampions),
    degats_subis: entier(p.totalDamageTaken),
    degats_attenues: entier(p.damageSelfMitigated),
    degats_batiments: entier(p.damageDealtToBuildings),
    soins: entier(p.totalHeal),
    controle_secondes: entier(p.timeCCingOthers),
    score_vision: petit(p.visionScore),
    balises_posees: petit(p.wardsPlaced),
    balises_detruites: petit(p.wardsKilled),
    balises_controle: petit(p.detectorWardsPlaced),
    tours_detruites: petit(p.turretTakedowns),
    premier_sang: booleen(p.firstBloodKill),
    premiere_tour: premiereTour,
    multi_kill_max: petit(p.largestMultiKill),
    solo_kills: petit(p.challenges?.soloKills),
    part_kills: part(p.challenges?.killParticipation),
    part_degats: part(p.challenges?.teamDamagePercentage),
    sbires_10: petit(p.challenges?.laneMinionsFirst10Minutes),
    temps_mort_secondes: entier(p.totalTimeSpentDead),
    patch: patchDeVersion(partie.versionJeu),
    joue_le: typeof partie.debut === "number" && Number.isFinite(partie.debut) ? new Date(partie.debut).toISOString() : null,
  };
}
