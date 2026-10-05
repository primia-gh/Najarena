import type { creerClientAdmin } from "@/lib/supabase/admin";
import {
  ErreurRiot,
  recupererChronologieMatch,
  recupererDetailsMatch,
  recupererIdsClassees,
  recupererRangs,
  trouverRegion,
} from "@/lib/riot";
import {
  chronologiePartieClassee,
  estPalierRiot,
  fenetreLecture,
  fichePartieClassee,
  joueursARelire,
  rangARelire,
  rangDepuisEntrees,
  type ColonnesChronologie,
  type ColonnesPartieClassee,
} from "@/lib/analyse-classees";

// Lecture des parties classées chez Riot (bilan du joueur, étape 2), pour
// les joueurs qui l'ont demandé. Appelée par la tâche planifiée
// /api/cron/analyse-classees, décalée de 2 minutes sur la recherche des
// résultats de tournoi : la clé de développement Riot n'accepte que 100
// appels toutes les 2 minutes, et les résultats de tournoi passent avant
// tout. D'où un budget d'appels par passage (ANALYSE_APPELS_PAR_PASSAGE,
// 20 par défaut, à relever avec la clé production) et un arrêt immédiat
// dès que Riot signale une limite : le passage suivant reprend où celui-ci
// s'est arrêté.

type ClientAdmin = NonNullable<ReturnType<typeof creerClientAdmin>>;

export type RaisonArret = "budget" | "temps" | "limite_riot" | "cle_riot" | "reseau";

export interface BilanLecture {
  appels: number;
  joueursRelus: number;
  partiesLues: number;
  partiesIgnorees: number;
  arret: RaisonArret | null;
}

class Arret extends Error {
  constructor(public raison: RaisonArret) {
    super(raison);
  }
}

const JOUEURS_PAR_PASSAGE = 5;

export async function lireClassees(
  admin: ClientAdmin,
  options: { budget: number; finAu: number; maintenant?: Date },
): Promise<BilanLecture> {
  const maintenant = options.maintenant ?? new Date();
  const bilan: BilanLecture = { appels: 0, joueursRelus: 0, partiesLues: 0, partiesIgnorees: 0, arret: null };

  // Chaque appel Riot passe ici : budget, temps restant, erreurs qui arrêtent le passage.
  const appel = async <T>(requete: () => Promise<T>): Promise<T> => {
    if (bilan.appels >= options.budget) throw new Arret("budget");
    if (Date.now() >= options.finAu) throw new Arret("temps");
    bilan.appels += 1;
    try {
      return await requete();
    } catch (e) {
      if (e instanceof ErreurRiot && e.code === "limite") throw new Arret("limite_riot");
      if (e instanceof ErreurRiot && (e.code === "cle_absente" || e.code === "cle_invalide")) throw new Arret("cle_riot");
      if (e instanceof ErreurRiot && e.code === "reseau") throw new Arret("reseau");
      throw e;
    }
  };
  const introuvable = (e: unknown) => e instanceof ErreurRiot && e.code === "introuvable";

  try {
    await relireJoueurs(admin, maintenant, appel, bilan);
    await lirePartiesEnAttente(admin, appel, introuvable, bilan);
  } catch (e) {
    if (!(e instanceof Arret)) throw e;
    bilan.arret = e.raison;
  }
  return bilan;
}

type Appel = <T>(requete: () => Promise<T>) => Promise<T>;

/** Rang (une fois par jour) et nouvelles parties classées des joueurs à relire. */
async function relireJoueurs(admin: ClientAdmin, maintenant: Date, appel: Appel, bilan: BilanLecture): Promise<void> {
  const { data: reglages } = await admin
    .from("analyse_reglages")
    .select("profile_id, derniere_synchro, rang_lu_le")
    .eq("classees", true);

  for (const r of joueursARelire(reglages ?? [], maintenant, JOUEURS_PAR_PASSAGE)) {
    const { data: compte } = await admin
      .from("game_accounts")
      .select("puuid, region")
      .eq("profile_id", r.profile_id)
      .eq("game_id", 1)
      .eq("est_principal", true)
      .not("verifie_le", "is", null)
      .maybeSingle();
    const region = compte ? trouverRegion(compte.region) : undefined;

    if (compte && region) {
      if (rangARelire(r.rang_lu_le, maintenant)) {
        const rang = rangDepuisEntrees(await appel(() => recupererRangs(compte.puuid, region.plateforme)));
        await admin
          .from("analyse_reglages")
          .update({
            palier: rang?.palier ?? null,
            division: rang?.division ?? null,
            points_ligue: rang?.points ?? null,
            rang_lu_le: maintenant.toISOString(),
          })
          .eq("profile_id", r.profile_id)
          .eq("classees", true);
      }

      const { data: derniere } = await admin
        .from("parties_classees")
        .select("joue_le")
        .eq("profile_id", r.profile_id)
        .not("joue_le", "is", null)
        .order("joue_le", { ascending: false })
        .limit(1)
        .maybeSingle();
      const fenetre = fenetreLecture(derniere?.joue_le ?? null, maintenant);
      const ids = await appel(() =>
        recupererIdsClassees(compte.puuid, region.continent, fenetre.depuisSecondes, fenetre.nombre),
      );
      if (ids.length > 0) {
        // Refusé par la base si le joueur a retiré son accord entre-temps.
        await admin.from("parties_classees").upsert(
          ids.map((id) => ({ profile_id: r.profile_id, riot_match_id: id, puuid: compte.puuid, region: compte.region })),
          { onConflict: "profile_id,riot_match_id", ignoreDuplicates: true },
        );
      }
    }

    // Même sans compte vérifié : on ne repasse pas sur ce joueur avant 6 heures.
    await admin
      .from("analyse_reglages")
      .update({ derniere_synchro: maintenant.toISOString() })
      .eq("profile_id", r.profile_id)
      .eq("classees", true);
    bilan.joueursRelus += 1;
  }
}

/** Fiche et chronologie des parties en attente : 2 appels par partie. */
async function lirePartiesEnAttente(
  admin: ClientAdmin,
  appel: Appel,
  introuvable: (e: unknown) => boolean,
  bilan: BilanLecture,
): Promise<void> {
  const { data: enAttente } = await admin
    .from("parties_classees")
    .select("id, profile_id, riot_match_id, puuid, region")
    .in("etat", ["a_lire", "lue"])
    .order("cree_le", { ascending: true })
    .limit(50);
  if (!enAttente || enAttente.length === 0) return;

  const { data: paliers } = await admin
    .from("analyse_reglages")
    .select("profile_id, palier")
    .in("profile_id", [...new Set(enAttente.map((p) => p.profile_id))]);
  const palierDe = (profileId: string) => {
    const palier = paliers?.find((x) => x.profile_id === profileId)?.palier ?? null;
    return estPalierRiot(palier) ? palier : null;
  };

  const enregistrer = async (
    id: number,
    colonnes: ColonnesPartieClassee,
    chronologie: ColonnesChronologie | null,
    complete: boolean,
  ) => {
    await admin
      .from("parties_classees")
      .update({ ...colonnes, ...(chronologie ?? {}), etat: complete ? "complete" : "lue" })
      .eq("id", id);
  };
  const ignorer = async (id: number) => {
    await admin.from("parties_classees").update({ etat: "ignoree" }).eq("id", id);
    bilan.partiesIgnorees += 1;
  };

  for (const p of enAttente) {
    const region = trouverRegion(p.region);
    if (!region) {
      await ignorer(p.id);
      continue;
    }

    let details;
    try {
      details = await appel(() => recupererDetailsMatch(p.riot_match_id, region.continent));
    } catch (e) {
      if (!introuvable(e)) throw e;
      await ignorer(p.id);
      continue;
    }
    const fiche = fichePartieClassee(details, p.puuid, palierDe(p.profile_id));
    if (fiche.ignoree) {
      await ignorer(p.id);
      continue;
    }

    let chronologie: ColonnesChronologie | null = null;
    try {
      chronologie = chronologiePartieClassee(
        await appel(() => recupererChronologieMatch(p.riot_match_id, region.continent)),
        details,
        p.puuid,
      );
    } catch (e) {
      if (e instanceof Arret) {
        // La fiche est gardée ; la chronologie sera relue au prochain passage.
        await enregistrer(p.id, fiche.colonnes, null, false);
        bilan.partiesLues += 1;
        throw e;
      }
      if (!introuvable(e)) throw e;
    }
    // Chronologie introuvable chez Riot : la partie reste, sans ses détails de chronologie.
    await enregistrer(p.id, fiche.colonnes, chronologie, true);
    bilan.partiesLues += 1;
  }
}
