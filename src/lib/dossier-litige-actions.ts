"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { recupererDetailsMatch, recupererIdsMatchsRecents, trouverRegion, type DetailsMatchRiot } from "@/lib/riot";
import { QUEUE_ID_PERSONNALISEE } from "@/lib/serie";
import { demanderJson, iaDisponible, MODELE_IA } from "@/lib/claude";
import {
  construireDemandeDossier,
  faitsEnLignes,
  SCHEMA_DOSSIER,
  validerDossier,
  type FaitsLitige,
  type PartieRiotDossier,
  type SyntheseDossier,
} from "@/lib/dossier-litige";

// Dossier de litige préparé (03/10/2026, audit N28) : à la demande de
// l'organisateur du tournoi (cockpit) ou d'un administrateur (/admin). Les
// faits sont rassemblés par le serveur ; la synthèse est rédigée par l'IA
// dans la limite des demandes (10 par 24 h). Sans IA ou au-delà de la
// limite, le dossier garde les faits seuls. Il ne tranche jamais.

const PARTIES_RIOT_MAX = 5;

export async function preparerDossierLitige(formData: FormData) {
  const disputeId = String(formData.get("dispute_id") ?? "");
  const depuisAdmin = formData.get("depuis") === "admin";

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }
  const moi = userData.user.id;

  const [{ data: litige }, { data: estAdmin }] = await Promise.all([
    supabase
      .from("disputes")
      .select(
        "id, motif, cree_le, ouvert_par:profiles!disputes_ouvert_par_fkey(pseudo), match:matches(id, tour, statut, demarre_le, defaite_reconnue_par, defaite_reconnue_le, tournament_id, tournament:tournaments(nom, format, best_of, condition_victoire, organisateur_id, game_id))",
      )
      .eq("id", disputeId)
      .maybeSingle(),
    supabase.from("admins").select("profile_id").eq("profile_id", moi).maybeSingle(),
  ]);
  const match = litige?.match;
  const tournoi = match?.tournament;
  const page = depuisAdmin ? "/admin" : `/moi/organisation/${match?.tournament_id ?? ""}`;
  const retour: (cle: "message" | "erreur", texte: string) => never = (cle, texte) =>
    redirect(`${page}?${cle}=${encodeURIComponent(texte)}`);

  if (!litige || !match || !tournoi) return retour("erreur", "Litige introuvable.");
  if (tournoi.organisateur_id !== moi && !estAdmin)
    return retour("erreur", "Seuls l'organisateur et les administrateurs préparent un dossier.");

  const admin = creerClientAdmin();
  if (!admin) return retour("erreur", "Dossier indisponible pour l'instant.");
  const { data: existant } = await admin
    .from("dossiers_litige")
    .select("dispute_id")
    .eq("dispute_id", disputeId)
    .maybeSingle();
  if (existant) return retour("message", "Le dossier de ce litige est déjà prêt.");

  // ----- Faits Najarena -----
  const [{ data: participants }, { data: verdict }] = await Promise.all([
    admin
      .from("match_participants")
      .select("profile_id, slot, pret_le, profile:profiles(pseudo)")
      .eq("match_id", match.id)
      .order("slot", { ascending: true }),
    admin
      .from("match_verdicts")
      .select("niveau, gagnant_id, motif, riot_match_id, cree_le")
      .eq("match_id", match.id)
      .eq("est_definitif", true)
      .maybeSingle(),
  ]);
  const joueurs = participants ?? [];
  const ids = joueurs.map((j) => j.profile_id);
  const pseudo = (id: string | null) => joueurs.find((j) => j.profile_id === id)?.profile?.pseudo ?? "un joueur";

  const { data: comptes } =
    ids.length > 0
      ? await admin
          .from("game_accounts")
          .select("profile_id, puuid, riot_game_name, riot_tag_line, region, verifie_le")
          .in("profile_id", ids)
          .eq("game_id", tournoi.game_id)
          .eq("est_principal", true)
      : { data: [] };
  const compteDe = (id: string) => (comptes ?? []).find((c) => c.profile_id === id && c.verifie_le);

  // ----- Historique Riot : parties personnalisées depuis l'ouverture -----
  const cache = new Map<string, Promise<DetailsMatchRiot>>();
  const partiesRiot: FaitsLitige["partiesRiot"] = await Promise.all(
    joueurs.map(async (j) => {
      const compte = compteDe(j.profile_id);
      const region = compte ? trouverRegion(compte.region) : undefined;
      if (!compte || !region || !match.demarre_le) return { pseudo: pseudo(j.profile_id), parties: null };
      try {
        const idsRiot = await recupererIdsMatchsRecents(
          compte.puuid,
          region.continent,
          Math.floor(new Date(match.demarre_le).getTime() / 1000),
          QUEUE_ID_PERSONNALISEE,
        );
        const parties: PartieRiotDossier[] = [];
        for (const idRiot of idsRiot.slice(0, PARTIES_RIOT_MAX)) {
          let details = cache.get(idRiot);
          if (!details) {
            details = recupererDetailsMatch(idRiot, region.continent);
            cache.set(idRiot, details);
          }
          const { info } = await details;
          const moiDansPartie = info.participants.find((p) => p.puuid === compte.puuid);
          const autre = joueurs.find((x) => x.profile_id !== j.profile_id);
          const compteAutre = autre ? compteDe(autre.profile_id) : undefined;
          const adversaire = compteAutre ? info.participants.find((p) => p.puuid === compteAutre.puuid) : undefined;
          const opposes = Boolean(moiDansPartie && adversaire && moiDansPartie.win !== adversaire.win);
          parties.push({
            debut: new Date(info.gameStartTimestamp).toISOString(),
            dureeSecondes: info.gameDuration,
            nbJoueurs: info.participants.length,
            adversairePresent: Boolean(adversaire),
            vainqueur: opposes ? (moiDansPartie!.win ? pseudo(j.profile_id) : pseudo(autre!.profile_id)) : null,
          });
        }
        return { pseudo: pseudo(j.profile_id), parties };
      } catch {
        return { pseudo: pseudo(j.profile_id), parties: null };
      }
    }),
  );

  // ----- Antécédents publics -----
  const antecedents = await Promise.all(
    joueurs.map(async (j) => {
      const [{ data: matchs }, { count: litiges }] = await Promise.all([
        admin
          .from("match_participants")
          .select("match:matches(match_verdicts(niveau, est_definitif))")
          .eq("profile_id", j.profile_id)
          .limit(300),
        admin.from("disputes").select("id", { count: "exact", head: true }).eq("ouvert_par", j.profile_id),
      ]);
      const matchsVerifies = (matchs ?? []).filter((m) =>
        (m.match?.match_verdicts ?? []).some((v) => v.est_definitif && v.niveau !== "manuel"),
      ).length;
      return { pseudo: pseudo(j.profile_id), matchsVerifies, litigesOuverts: litiges ?? 0 };
    }),
  );

  const lignes = faitsEnLignes({
    tournoi: {
      nom: tournoi.nom,
      format: tournoi.format,
      bestOf: tournoi.best_of,
      condition: tournoi.condition_victoire,
    },
    match: { tour: match.tour, statut: match.statut, demarreLe: match.demarre_le },
    joueurs: joueurs.map((j) => {
      const compte = compteDe(j.profile_id);
      return {
        pseudo: pseudo(j.profile_id),
        riotId: compte ? `${compte.riot_game_name}#${compte.riot_tag_line}` : null,
        pretLe: j.pret_le,
        creeLaPartie: j.slot === 1,
      };
    }),
    defaiteReconnue:
      match.defaite_reconnue_par && match.defaite_reconnue_le
        ? { pseudo: pseudo(match.defaite_reconnue_par), le: match.defaite_reconnue_le }
        : null,
    verdict: verdict
      ? {
          niveau: verdict.niveau,
          gagnant: verdict.gagnant_id ? pseudo(verdict.gagnant_id) : null,
          motif: verdict.motif,
          parties: verdict.riot_match_id ? verdict.riot_match_id.split(",").length : 0,
          le: verdict.cree_le,
        }
      : null,
    litige: { ouvertPar: litige.ouvert_par?.pseudo ?? "un joueur", le: litige.cree_le },
    partiesRiot,
    antecedents,
  });

  // ----- Synthèse par l'IA (facultative) -----
  let synthese: SyntheseDossier | null = null;
  if (iaDisponible()) {
    const { data: autorise } = await supabase.rpc("reserver_appel_assistant_ia");
    if (autorise) {
      const resultat = await demanderJson({
        ...construireDemandeDossier(lignes, litige.motif),
        schema: SCHEMA_DOSSIER,
        valider: validerDossier,
      });
      if (resultat.ok) synthese = resultat.valeur;
    }
  }

  const { error } = await admin.from("dossiers_litige").insert({
    dispute_id: disputeId,
    faits: lignes,
    synthese: synthese ? { ...synthese } : {},
    modele: synthese ? MODELE_IA : "aucun",
    cree_par: moi,
  });
  if (error) return retour("erreur", "Impossible d'enregistrer le dossier pour l'instant.");
  return retour(
    "message",
    synthese
      ? "Dossier prêt : faits et synthèse sous le litige."
      : "Dossier prêt (faits seuls : synthèse IA indisponible).",
  );
}
