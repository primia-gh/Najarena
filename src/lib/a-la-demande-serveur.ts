// Tournois à la demande (09/10/2026, idée en réserve n°11), côté serveur :
// à chaque passage de la tâche des tournois automatiques (toutes les 5
// minutes), la base ouvre un tournoi pour chaque heure qui a réuni assez de
// joueurs disponibles et les y inscrit (ouvrir_tournois_a_la_demande) ; on
// les prévient ici (push et message privé Discord) et on l'annonce sur le
// salon. Les rappels de check-in et le démarrage suivent ensuite le même
// chemin que les tournois quotidiens (lib/tournois-auto/).

import { creerClientAdmin } from "@/lib/supabase/admin";
import { envoyerRappel, notifierDiscord, URL_SITE } from "@/lib/notifications";
import { echapperDiscord } from "@/lib/echappement";
import { heureParis, jourLisibleParis } from "@/lib/tournois-auto/creneaux";
import { trouverOrganisateur } from "@/lib/tournois-auto/execution";

/** Nombre de tournois ouverts ce passage, ou null si la base n'est pas joignable. */
export async function ouvrirTournoisALaDemande(): Promise<number | null> {
  const admin = creerClientAdmin();
  if (!admin) return null;
  await admin.rpc("effacer_disponibilites_passees");

  const organisateurId = await trouverOrganisateur(admin);
  if (!organisateurId) return null;
  const { data: ouverts, error } = await admin.rpc("ouvrir_tournois_a_la_demande", {
    p_organisateur_id: organisateurId,
  });
  if (error) return null;

  for (const o of ouverts ?? []) {
    const { data: t } = await admin
      .from("tournaments")
      .select("nom, debute_le, capacite")
      .eq("id", o.tournament_id)
      .maybeSingle();
    if (!t) continue;
    const quand = `${jourLisibleParis(t.debute_le)} à ${heureParis(t.debute_le)}`;
    const lien = `${URL_SITE}/lol/tournois/${o.slug}`;
    await Promise.all(
      o.inscrits.map((id) =>
        envoyerRappel(
          id,
          `Ton tournoi à la demande est ouvert — ${quand}`,
          `Assez de joueurs étaient disponibles en même temps que toi : le tournoi est ouvert et tu y es inscrit. Le check-in ouvre 30 minutes avant le début.`,
          lien,
        ),
      ),
    );
    await notifierDiscord(
      `📣 Tournoi à la demande ouvert : **${echapperDiscord(t.nom)}**, ${quand} — ${o.inscrits.length} joueurs déjà inscrits, ${Math.max(0, t.capacite - o.inscrits.length)} places restantes.\n${lien}`,
    );
  }
  return ouverts?.length ?? 0;
}
