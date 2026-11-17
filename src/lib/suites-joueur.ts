// Ce qui suit une action d'un joueur — qu'il ait cliqué sur le site ou sur
// un bouton d'un message privé Discord (09/10/2026, idée en réserve n°10) :
// prévenir l'adversaire, le lanceur d'un défi… Serveur uniquement : lit la
// base avec le client service_role, après que l'action a été écrite par une
// fonction contrôlée de la base. Comme toute notification, n'échoue jamais.

import { creerClientAdmin } from "@/lib/supabase/admin";
import { envoyerRappel, URL_SITE } from "@/lib/notifications";
import { limiteForfait } from "@/lib/forfait";
import { heureParis } from "@/lib/tournois-auto/creneaux";
import { chargerEquipesDesTournois, cleEquipe } from "@/lib/equipes-tournoi";
import type { BoutonDiscord } from "@/lib/boutons-discord";

/** Bouton « Je suis prêt » d'un match. */
export function boutonPret(matchId: string): BoutonDiscord {
  return { action: "pret", cible: matchId, libelle: "Je suis prêt" };
}

/** Bouton « Je confirme ma présence » d'un tournoi en check-in. */
export function boutonCheckin(tournoiId: string): BoutonDiscord {
  return { action: "checkin", cible: tournoiId, libelle: "Je confirme ma présence" };
}

async function pseudoDe(id: string): Promise<string> {
  const admin = creerClientAdmin();
  if (!admin) return "Un joueur";
  const { data } = await admin.from("profiles").select("pseudo").eq("id", id).maybeSingle();
  return data?.pseudo ?? "Un joueur";
}

/** Le match unique d'un duel (défi accepté, arène), par l'adresse du duel. */
export async function matchDuDuel(slug: string): Promise<string | null> {
  const admin = creerClientAdmin();
  if (!admin) return null;
  const { data } = await admin
    .from("matches")
    .select("id, tournament:tournaments!inner(slug)")
    .eq("tournament.slug", slug)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Après « Je suis prêt » : à la première déclaration, l'adversaire est
 * prévenu (push et Discord, avec son propre bouton « Je suis prêt »). En
 * 5v5 (audit N21), toute l'équipe adverse est prévenue, mais seul son
 * capitaine reçoit le bouton : lui seul peut déclarer l'équipe prête.
 * Renvoie si l'adversaire était déjà prêt.
 */
export async function apresDeclarationPret(
  matchId: string,
  joueurId: string,
  nouveau: boolean,
): Promise<{ adversairePret: boolean }> {
  const admin = creerClientAdmin();
  if (!admin) return { adversairePret: false };

  const { data: match } = await admin
    .from("matches")
    .select(
      "tournament_id, tournament:tournaments(nom, slug, format), match_participants(profile_id, pret_le, profile:profiles(pseudo))",
    )
    .eq("id", matchId)
    .maybeSingle();
  const moi = match?.match_participants.find((p) => p.profile_id === joueurId);
  const adversaire = match?.match_participants.find((p) => p.profile_id !== joueurId);
  if (adversaire?.pret_le) return { adversairePret: true };

  if (nouveau && match?.tournament && moi?.pret_le && adversaire) {
    const tournoi = match.tournament;
    const equipes = tournoi.format === "5v5" ? await chargerEquipesDesTournois(admin, [match.tournament_id]) : null;
    const monEquipe = equipes?.get(cleEquipe(match.tournament_id, moi.profile_id));
    const equipeAdverse = equipes?.get(cleEquipe(match.tournament_id, adversaire.profile_id));
    const limite = heureParis(limiteForfait(moi.pret_le).toISOString());
    await Promise.all(
      (equipeAdverse?.joueurs ?? [adversaire.profile_id]).map((id) =>
        envoyerRappel(
          id,
          `${monEquipe?.libelle ?? moi.profile?.pseudo ?? "Ton adversaire"} est prêt — ${tournoi.nom}`,
          equipeAdverse
            ? `Ton capitaine doit déclarer l'équipe prête dans la salle de match avant ${limite} (heure de Paris), sinon elle perd ce match par forfait.`
            : `Déclare-toi prêt avant ${limite} (heure de Paris), sinon tu perds ce match par forfait.`,
          `${URL_SITE}/lol/tournois/${tournoi.slug}#ton-match`,
          { boutons: id === adversaire.profile_id ? [boutonPret(matchId)] : [] },
        ),
      ),
    );
  }
  return { adversairePret: false };
}

/** Un défi vient d'être lancé : l'adversaire peut répondre depuis Discord. */
export async function prevenirDefiLance(lanceurId: string, adversaireId: string, defiId: string | null): Promise<void> {
  await envoyerRappel(
    adversaireId,
    `${await pseudoDe(lanceurId)} te défie en 1v1`,
    "Une partie, résultat lu chez Riot. Accepte ou refuse dans les 24 h.",
    `${URL_SITE}/moi#defis`,
    {
      boutons: defiId
        ? [
            { action: "defi_oui", cible: defiId, libelle: "Accepter" },
            { action: "defi_non", cible: defiId, libelle: "Refuser", style: "secondaire" },
          ]
        : [],
    },
  );
}

/**
 * Réponse à un défi : le lanceur est prévenu ; si le défi est accepté, avec
 * le bouton « Je suis prêt » du duel qui vient de s'ouvrir.
 */
export async function prevenirReponseDefi(
  defiId: string,
  repondantId: string,
  accepte: boolean,
  slug: string | null,
): Promise<void> {
  const admin = creerClientAdmin();
  if (!admin) return;
  const { data: defi } = await admin.from("defis").select("lanceur_id").eq("id", defiId).maybeSingle();
  if (!defi) return;
  const pseudo = await pseudoDe(repondantId);
  const matchId = accepte && slug ? await matchDuDuel(slug) : null;
  await envoyerRappel(
    defi.lanceur_id,
    accepte ? `${pseudo} relève ton défi` : `${pseudo} a refusé ton défi`,
    accepte ? "Le duel est ouvert : déclare-toi prêt dans la salle de match." : "Tu peux défier un autre joueur depuis son profil.",
    accepte && slug ? `${URL_SITE}/lol/tournois/${slug}#ton-match` : `${URL_SITE}/moi#defis`,
    { boutons: matchId ? [boutonPret(matchId)] : [] },
  );
}
