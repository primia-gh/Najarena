import type { creerClientAdmin } from "@/lib/supabase/admin";
import { ajouterJours, heureParis, jourParis } from "@/lib/tournois-auto/creneaux";
import { bornesSemaine, lundiDeLaSemaine } from "@/lib/recap-semaine";
import {
  COLONNES_INDICATEURS,
  COLONNES_INDICATEURS_CLASSEES,
  partieClasseeDepuisLigne,
  partieDepuisLigne,
  type PartieBilan,
} from "@/lib/bilan";
import { hygieneDeJeu } from "@/lib/hygiene-jeu";
import { messageBilanHebdo } from "@/lib/bilan-hebdo";
import { envoyerMessagePriveDiscord, URL_SITE } from "@/lib/notifications";

// Envoi du bilan de la semaine (bilan du joueur, étape 2, 05/10/2026) : le
// lundi à partir de 10 h (heure de Paris), en message privé Discord, aux
// joueurs qui l'ont demandé, ont l'offre Elite et Discord lié — une seule
// fois par joueur et par semaine (ligne de bilans_hebdo, écrite avant
// l'envoi), jamais pour une semaine sans partie. Appelé par la tâche
// /api/cron/analyse-classees, dans le temps qui reste après la lecture des
// parties classées.

type ClientAdmin = NonNullable<ReturnType<typeof creerClientAdmin>>;

const BILANS_PAR_PASSAGE = 20;

export async function envoyerBilansHebdo(admin: ClientAdmin, maintenant: Date, finAu: number): Promise<string[]> {
  const lundi = lundiDeLaSemaine(maintenant);
  if (jourParis(maintenant) !== lundi || heureParis(maintenant.toISOString()) < "10:00") return [];
  const semaine = ajouterJours(lundi, -7);

  const { data: reglages } = await admin.from("analyse_reglages").select("profile_id").eq("bilan_hebdo", true);
  const ids = (reglages ?? []).map((r) => r.profile_id);
  if (ids.length === 0) return [];
  const [{ data: deja }, { data: offres }, { data: profils }] = await Promise.all([
    admin.from("bilans_hebdo").select("profile_id").eq("semaine", semaine).in("profile_id", ids),
    admin.from("comptes_offres").select("profile_id, offre").in("profile_id", ids),
    admin.from("profiles").select("id, discord_id").in("id", ids),
  ]);
  const traites = new Set((deja ?? []).map((d) => d.profile_id));
  const elite = new Set(
    (offres ?? []).filter((o) => o.offre === "elite" || o.offre === "organisateur").map((o) => o.profile_id),
  );
  const discord = new Map((profils ?? []).flatMap((p) => (p.discord_id ? [[p.id, p.discord_id] as const] : [])));
  const candidats = ids.filter((id) => !traites.has(id) && elite.has(id) && discord.has(id)).slice(0, BILANS_PAR_PASSAGE);

  // Deux semaines de parties de tournoi (cette semaine et la précédente) et
  // les 100 dernières parties classées (pour l'hygiène de jeu).
  const depuis = bornesSemaine(ajouterJours(semaine, -7)).debut.toISOString();
  let envoyes = 0;
  for (const id of candidats) {
    if (Date.now() >= finAu) break;
    const { data: inseree } = await admin
      .from("bilans_hebdo")
      .insert({ profile_id: id, semaine })
      .select("profile_id")
      .maybeSingle();
    if (!inseree) continue;

    const [{ data: tournoi }, { data: classees }] = await Promise.all([
      admin.from("indicateurs_partie").select(COLONNES_INDICATEURS).eq("profile_id", id).gte("joue_le", depuis),
      admin
        .from("indicateurs_classees")
        .select(COLONNES_INDICATEURS_CLASSEES)
        .eq("profile_id", id)
        .order("joue_le", { ascending: false })
        .limit(100),
    ]);
    const parties: PartieBilan[] = [
      ...(tournoi ?? []).flatMap((l) => {
        const p = partieDepuisLigne(l);
        return p ? [p] : [];
      }),
      ...(classees ?? []).map(partieClasseeDepuisLigne),
    ];
    const hygiene = hygieneDeJeu(
      (classees ?? []).map((c) => ({ joueLe: c.joue_le, dureeSecondes: c.duree_secondes, gagne: c.gagne })),
    );
    const message = messageBilanHebdo({
      lundi: semaine,
      parties,
      regle: hygiene?.regles[0]?.texte ?? null,
      lien: `${URL_SITE}/moi/bilan`,
    });
    const discordId = discord.get(id);
    if (!message || !discordId) continue;
    await envoyerMessagePriveDiscord(discordId, message);
    envoyes += 1;
  }
  return envoyes > 0 ? [`bilans de la semaine du ${semaine} : ${envoyes} envoyé${envoyes > 1 ? "s" : ""}`] : [];
}
