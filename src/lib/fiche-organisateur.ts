// Fiche publique de l'organisateur (03/10/2026, audit N13) : son sérieux en
// chiffres, calculés par la base (fiche_organisateur, docs/schema.sql) sur
// ses seuls tournois. Logique pure d'affichage, testée dans
// fiche-organisateur.test.ts. Un chiffre sur trop peu de données n'est pas
// affiché comme une proportion.

export interface DonneesFiche {
  tournois_publies: number;
  tournois_termines: number;
  tournois_annules: number;
  matchs_decides: number;
  matchs_verifies: number;
  litiges: number;
  litiges_resolus: number;
  resolution_mediane_heures: number | null;
}

/** En dessous, une proportion ne veut rien dire : on donne le compte brut. */
export const MATCHS_MIN_PROPORTION = 5;

export interface LigneFiche {
  libelle: string;
  valeur: string;
}

function pluriel(n: number, mot: string): string {
  return `${n} ${mot}${n > 1 ? "s" : ""}`;
}

export function lignesFiche(d: DonneesFiche): LigneFiche[] {
  const lignes: LigneFiche[] = [
    {
      libelle: "Tournois",
      valeur: `${pluriel(d.tournois_publies, "publié")} · ${pluriel(d.tournois_termines, "mené")} à terme · ${pluriel(d.tournois_annules, "annulé")}`,
    },
  ];
  if (d.matchs_decides > 0) {
    lignes.push({
      libelle: "Résultats lus chez Riot",
      valeur:
        d.matchs_decides >= MATCHS_MIN_PROPORTION
          ? `${Math.round((d.matchs_verifies / d.matchs_decides) * 100)} % des matchs (${d.matchs_verifies} sur ${d.matchs_decides})`
          : `${d.matchs_verifies} match${d.matchs_verifies > 1 ? "s" : ""} sur ${d.matchs_decides}`,
    });
  }
  lignes.push({
    libelle: "Litiges",
    valeur:
      d.litiges === 0
        ? "aucun"
        : `${d.litiges_resolus} tranché${d.litiges_resolus > 1 ? "s" : ""} sur ${d.litiges}${
            d.resolution_mediane_heures !== null ? ` · délai médian ${formaterHeures(d.resolution_mediane_heures)}` : ""
          }`,
  });
  return lignes;
}

function formaterHeures(heures: number): string {
  if (heures < 1) return `${Math.max(1, Math.round(heures * 60))} min`;
  if (heures < 48) return `${Math.round(heures)} h`;
  return `${Math.round(heures / 24)} jours`;
}

/** Version d'une ligne, pour la page d'un tournoi. */
export function resumeFiche(d: DonneesFiche): string | null {
  if (d.tournois_publies === 0) return null;
  const termines = `${pluriel(d.tournois_termines, "tournoi")} mené${d.tournois_termines > 1 ? "s" : ""} à terme`;
  if (d.matchs_decides < MATCHS_MIN_PROPORTION) return termines;
  return `${termines}, ${Math.round((d.matchs_verifies / d.matchs_decides) * 100)} % des matchs lus chez Riot`;
}
