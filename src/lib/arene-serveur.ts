import { creerClientAdmin } from "@/lib/supabase/admin";
import { envoyerRappel, URL_SITE } from "@/lib/notifications";
import { boutonPret, matchDuDuel } from "@/lib/suites-joueur";

// Arène 1v1 (03/10/2026, audit N19), côté serveur : passage périodique de
// l'appariement (tâche des tournois automatiques, toutes les 5 minutes) et
// message aux joueurs d'un duel trouvé (push + message privé Discord).

/** Prévient les joueurs d'un duel d'arène, sauf celui qui vient de le déclencher. */
export async function prevenirDuelArene(slug: string, sauf?: string): Promise<void> {
  const admin = creerClientAdmin();
  if (!admin) return;
  const { data: tournoi } = await admin.from("tournaments").select("id").eq("slug", slug).maybeSingle();
  if (!tournoi) return;
  const { data: inscrits } = await admin.from("registrations").select("profile_id").eq("tournament_id", tournoi.id);
  const ids = (inscrits ?? []).map((r) => r.profile_id);
  const { data: profils } = await admin.from("profiles").select("id, pseudo").in("id", ids);
  const pseudo = (id: string) => profils?.find((p) => p.id === id)?.pseudo ?? "un joueur";
  const matchId = await matchDuDuel(slug);

  await Promise.all(
    ids
      .filter((id) => id !== sauf)
      .map((id) =>
        envoyerRappel(
          id,
          "Adversaire trouvé dans l'arène",
          `Ton duel contre ${pseudo(ids.find((autre) => autre !== id) ?? "")} est ouvert : déclare-toi prêt dans la salle de match.`,
          `${URL_SITE}/lol/tournois/${slug}#ton-match`,
          { boutons: matchId ? [boutonPret(matchId)] : [] },
        ),
      ),
  );
}

/**
 * Apparie les joueurs devenus compatibles avec l'attente et retire les
 * places expirées (public.apparier_arene). Renvoie le nombre de duels
 * créés, ou null si la base n'est pas joignable.
 */
export async function apparierArene(): Promise<number | null> {
  const admin = creerClientAdmin();
  if (!admin) return null;
  const { data, error } = await admin.rpc("apparier_arene");
  if (error) return null;
  await Promise.all((data ?? []).map((d) => prevenirDuelArene(d.slug)));
  return data?.length ?? 0;
}
