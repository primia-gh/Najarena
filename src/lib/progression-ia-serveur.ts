import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  COLONNES_INDICATEURS,
  COLONNES_INDICATEURS_CLASSEES,
  construireBilan,
  partieClasseeDepuisLigne,
  partieDepuisLigne,
  posteCompare,
  repereDepuisLigne,
  type Bilan,
  type FormatBilan,
} from "@/lib/bilan";
import { estPalierRiot } from "@/lib/analyse-classees";
import { demanderJson, iaDisponible, MODELE_IA } from "@/lib/claude";
import { construireDemandeProgression, progressionMesurable, SCHEMA_PROGRESSION, validerProgression } from "@/lib/progression-ia";

// Analyse de progression rédigée par l'IA (18/11/2026), côté serveur. Le
// bilan est recalculé ici à partir des parties vérifiées du joueur (même
// calcul que /moi/bilan), jamais repris du formulaire ; l'analyse est
// écrite par le client du serveur (service) dans analyses_progression_ia,
// qu'aucun joueur ne peut écrire lui-même.

type Client = SupabaseClient<Database>;

export type IssueProgression = "ok" | "insuffisant" | "a-jour" | "limite" | "indisponible" | "refus" | "invalide";

/** Bilan d'un format, calculé comme sur /moi/bilan (client du joueur : ses seules données). */
export async function bilanPourAnalyse(supabase: Client, moi: string, format: FormatBilan): Promise<Bilan | null> {
  let parties;
  let palier: string | null = null;
  if (format === "classees") {
    const [{ data: reglages }, { data: lignes }] = await Promise.all([
      supabase.from("analyse_reglages").select("classees, palier").eq("profile_id", moi).maybeSingle(),
      supabase
        .from("indicateurs_classees")
        .select(COLONNES_INDICATEURS_CLASSEES)
        .eq("profile_id", moi)
        .order("joue_le", { ascending: true })
        .limit(100),
    ]);
    // Sans accord en cours, rien n'est lu (l'accord retiré efface tout).
    if (!reglages?.classees) return null;
    palier = estPalierRiot(reglages.palier) ? reglages.palier : null;
    parties = (lignes ?? []).map(partieClasseeDepuisLigne);
  } else {
    const { data: lignes } = await supabase
      .from("indicateurs_partie")
      .select(COLONNES_INDICATEURS)
      .eq("profile_id", moi)
      .order("joue_le", { ascending: true })
      .limit(1000);
    parties = (lignes ?? []).flatMap((l) => {
      const p = partieDepuisLigne(l);
      return p ? [p] : [];
    });
  }

  const duFormat = parties.filter((p) => p.format === format);
  if (duFormat.length === 0) return null;
  const poste = format === "1v1" ? null : posteCompare(duFormat);
  const { data: lignesReperes } =
    format !== "1v1" && !poste
      ? { data: [] }
      : format === "classees"
        ? await supabase.rpc("reperes_classees", { p_palier: palier ?? undefined, p_poste: poste ?? undefined })
        : await supabase.rpc("reperes_bilan", { p_format: format, p_poste: poste ?? undefined, p_sauf: moi });
  const reperes = (lignesReperes ?? []).flatMap((l) => {
    const r = repereDepuisLigne(l);
    return r ? [r] : [];
  });
  return construireBilan(parties, format, reperes);
}

/**
 * Rédige (ou refait) l'analyse d'un format. `supabase` : client du joueur
 * (lecture de ses parties, réservation d'une demande à l'IA) ; `admin` :
 * client du serveur (écriture). L'offre Elite est vérifiée par l'appelant.
 */
export async function redigerAnalyseProgression(
  supabase: Client,
  admin: Client,
  moi: string,
  format: FormatBilan,
): Promise<IssueProgression> {
  if (!iaDisponible()) return "indisponible";
  const bilan = await bilanPourAnalyse(supabase, moi, format);
  if (!bilan || !progressionMesurable(bilan)) return "insuffisant";

  // Rien de nouveau depuis la dernière analyse : pas de nouvelle demande.
  const { data: existante } = await supabase
    .from("analyses_progression_ia")
    .select("parties, derniere_partie")
    .eq("profile_id", moi)
    .eq("format", format)
    .maybeSingle();
  if (existante && existante.parties === bilan.partiesComparees && existante.derniere_partie === bilan.derniere) {
    return "a-jour";
  }

  const { data: autorise } = await supabase.rpc("reserver_appel_assistant_ia");
  if (!autorise) return "limite";

  const resultat = await demanderJson({
    ...construireDemandeProgression(bilan),
    schema: SCHEMA_PROGRESSION,
    valider: validerProgression,
  });
  if (!resultat.ok) return resultat.raison;

  const { error } = await admin.from("analyses_progression_ia").upsert({
    profile_id: moi,
    format,
    resume: resultat.valeur.resume,
    progres: resultat.valeur.progres,
    reculs: resultat.valeur.reculs,
    priorites: resultat.valeur.priorites,
    parties: bilan.partiesComparees,
    derniere_partie: bilan.derniere,
    modele: MODELE_IA,
    cree_le: new Date().toISOString(),
  });
  return error ? "indisponible" : "ok";
}
