import "server-only";
import type Stripe from "stripe";
import type { creerClientAdmin } from "@/lib/supabase/admin";
import { ORDRE_OFFRE, type Offre } from "@/lib/offres";
import {
  abonnementCourant,
  abonnementEnVie,
  abonnementPaye,
  decisionVerification,
  offreDepuisPrix,
  prixConfigures,
  prixParOffre,
} from "@/lib/offre-stripe";

// Offre accordée par un abonnement Stripe : écrite par le webhook
// (src/app/api/stripe/webhook/route.ts) et, au cas où un de ses messages se
// serait perdu, par la vérification quotidienne (/api/cron/abonnements-stripe).
// Les deux passent par les mêmes fonctions, avec le client service_role :
// comptes_offres n'a aucune policy d'écriture côté client.
//
// Une offre accordée par Stripe a `attribue_par` vide ; une offre donnée à
// la main par un administrateur (attribuerOffreAdmin) porte son identifiant.
// Seules les premières sont retirées quand un abonnement prend fin
// (23/11/2026) : la fin d'un ancien abonnement n'efface pas une offre
// offerte depuis par un administrateur.

export type ClientAdmin = NonNullable<ReturnType<typeof creerClientAdmin>>;

function identifiant(objet: string | { id: string } | null | undefined): string | null {
  if (!objet) return null;
  return typeof objet === "string" ? objet : objet.id;
}

// L'abonnement tel qu'il est maintenant chez Stripe (contrôle de sécurité
// du 21/11/2026, F1) : les événements peuvent arriver en retard ou dans le
// désordre (un « active » ancien après une résiliation), et un paiement
// différé laisse l'abonnement « incomplete » après le paiement en ligne.
// On n'écrit donc jamais d'après le contenu de l'événement, seulement
// d'après l'état relu. Nul si Stripe ne répond pas : l'événement est
// refusé et Stripe le renverra.
export async function relireAbonnement(client: Stripe, id: string): Promise<Stripe.Subscription | null> {
  try {
    return await client.subscriptions.retrieve(id);
  } catch {
    return null;
  }
}

// État de l'abonnement (active, past_due, canceled…), gardé pour le
// tableau de bord et la suppression de compte. Faux si l'écriture a
// échoué : l'événement est alors refusé et Stripe le renverra (contrôle de
// sécurité du 22/11/2026 — un « reçu » après une écriture ratée laissait
// par exemple son offre à un abonné résilié).
async function suivreAbonnement(admin: ClientAdmin, profileId: string, abonnement: Stripe.Subscription): Promise<boolean> {
  const clientId = identifiant(abonnement.customer);
  if (!clientId) return true;
  const { error } = await admin.from("abonnements_stripe").upsert({
    profile_id: profileId,
    client_stripe_id: clientId,
    abonnement_stripe_id: abonnement.id,
    statut: abonnement.status,
    maj_le: new Date().toISOString(),
  });
  return !error;
}

// Retire l'offre accordée par Stripe, jamais une offre donnée à la main.
async function retirerOffreStripe(admin: ClientAdmin, profileId: string): Promise<boolean> {
  const { error } = await admin.from("comptes_offres").delete().eq("profile_id", profileId).is("attribue_par", null);
  return !error;
}

// Offre accordée d'après l'état relu : payé (active, trialing, sans pause
// des paiements) → offre du prix facturé ; sinon (paiement échoué, en
// attente, en pause, résilié…) → offre retirée, quel que soit le prix —
// retirer est toujours sans risque. Une offre donnée à la main par un
// administrateur qui vaut au moins l'offre payée n'est pas remplacée.
// Faux si une écriture a échoué (l'événement sera renvoyé par Stripe).
export async function appliquerAbonnement(
  client: Stripe,
  admin: ClientAdmin,
  profileId: string,
  abonnement: Stripe.Subscription,
): Promise<boolean> {
  if (!abonnementPaye(abonnement)) {
    // Un ancien abonnement qui se termine (renvoi tardif, doublon) ne touche
    // ni l'offre ni le suivi de l'abonnement actuel du joueur, s'il en a un
    // autre (contrôle de sécurité du 22/11/2026).
    const { data: suivi, error: erreurSuivi } = await admin
      .from("abonnements_stripe")
      .select("abonnement_stripe_id")
      .eq("profile_id", profileId)
      .maybeSingle();
    if (erreurSuivi) return false;
    if (suivi?.abonnement_stripe_id && suivi.abonnement_stripe_id !== abonnement.id) return true;
    if (!(await suivreAbonnement(admin, profileId, abonnement))) return false;
    return retirerOffreStripe(admin, profileId);
  }
  if (!(await suivreAbonnement(admin, profileId, abonnement))) return false;
  // Offre lue dans le prix facturé, pas dans les métadonnées (un
  // changement de formule dans le portail Stripe ne les met pas à jour).
  const prixFacture = abonnement.items?.data?.[0]?.price?.id;
  const offre = offreDepuisPrix(prixFacture, prixParOffre());
  if (!offre) {
    // Prix qui n'est celui d'aucune offre : réglage à revoir (variables
    // STRIPE_PRICE_*, ancien prix compris). Rien n'est accordé, et une
    // offre déjà accordée est retirée (contrôle de sécurité du 22/11/2026).
    console.error(`Abonnement Stripe : prix ${prixFacture ?? "absent"} sans offre correspondante.`);
    return retirerOffreStripe(admin, profileId);
  }
  // Offre offerte par un administrateur, au moins aussi haute : elle reste
  // telle quelle (contrôle de sécurité du 23/11/2026 ; le renouvellement
  // mensuel ne doit pas défaire un cadeau).
  const { data: enPlace, error: erreurEnPlace } = await admin
    .from("comptes_offres")
    .select("offre, attribue_par")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (erreurEnPlace) return false;
  if (enPlace?.attribue_par && ORDRE_OFFRE[enPlace.offre as Offre] >= ORDRE_OFFRE[offre]) return true;
  const { error } = await admin.from("comptes_offres").upsert({
    profile_id: profileId,
    offre,
    attribue_le: new Date().toISOString(),
    // Désormais accordée par Stripe : retirée à la fin de l'abonnement.
    attribue_par: null,
  });
  if (error) return false;
  // Seconde lecture après avoir accordé l'offre (contrôle de sécurité du
  // 22/11/2026) : si une résiliation a été traitée entre la première
  // lecture et l'écriture, l'offre écrite à l'instant ne doit pas rester.
  const relu = await relireAbonnement(client, abonnement.id);
  if (!relu) return false;
  if (!abonnementPaye(relu)) return retirerOffreStripe(admin, profileId);
  return true;
}

export type BilanVerificationAbonnements =
  | { actif: false; raison: string }
  | {
      actif: true;
      /** Abonnements non résiliés lus chez Stripe. */
      abonnementsLus: number;
      /** Joueurs suivis en base, passés en revue. */
      examines: number;
      accordees: number;
      retirees: number;
      /** Cas à regarder par un administrateur (prix inconnu, offre Stripe sans abonnement). */
      signales: number;
      /** Stripe ou la base n'a pas répondu : réessayé au prochain passage. */
      erreurs: number;
      /** Heure limite atteinte : la suite au prochain passage. */
      restants: boolean;
    };

// Taille des paquets passés à la base (adresse de requête de taille
// raisonnable, et au plus ce que l'API de la base rend en une fois).
const PAQUET = 100;
const PAGE_BASE = 1000;
// Au-delà, la liste des abonnements n'est pas lue en entier : la tâche ne
// fait rien plutôt que de croire résilié un abonnement qu'elle n'a pas lu.
const ABONNEMENTS_MAX = 10_000;

type Suivi = { profile_id: string; abonnement_stripe_id: string | null; statut: string | null; maj_le: string };

// Le suivi n'a pas bougé depuis la lecture du début : sinon le webhook vient
// de passer, et c'est lui qui a raison (contrôle de sécurité du 23/11/2026).
async function suiviInchange(admin: ClientAdmin, suivi: Suivi): Promise<boolean> {
  const { data, error } = await admin
    .from("abonnements_stripe")
    .select("maj_le")
    .eq("profile_id", suivi.profile_id)
    .maybeSingle();
  return !error && data?.maj_le === suivi.maj_le;
}

/**
 * Vérification quotidienne (23/11/2026) : corrige l'offre d'un abonné si un
 * message du webhook s'est perdu — offre retirée à un abonnement impayé,
 * en pause ou résilié, accordée à un abonnement payé (premier abonnement et
 * réabonnement compris).
 * 1. Tous les abonnements non résiliés du compte Stripe, cent par appel,
 *    rangés par joueur d'après l'étiquette posée par notre serveur.
 * 2. Pour chaque joueur suivi en base, l'abonnement qui compte
 *    (abonnementCourant). Seuls les cas suspects coûtent un appel de plus :
 *    offre accordée par Stripe ou abonnement que la base croit en vie, sans
 *    abonnement non résilié chez Stripe — on relit alors l'abonnement connu.
 * 3. Écriture seulement si quelque chose change, et si le webhook n'est pas
 *    passé entre-temps.
 */
export async function verifierAbonnementsStripe(
  client: Stripe,
  admin: ClientAdmin,
  options: { finAu?: number } = {},
): Promise<BilanVerificationAbonnements> {
  const prix = prixParOffre();
  if (!prixConfigures(prix)) return { actif: false, raison: "Aucun prix d'offre réglé (STRIPE_PRICE_*)." };

  let vivants: Stripe.Subscription[];
  try {
    vivants = await client.subscriptions.list({ limit: 100 }).autoPagingToArray({ limit: ABONNEMENTS_MAX });
  } catch {
    return { actif: false, raison: "Stripe ne répond pas." };
  }
  if (vivants.length >= ABONNEMENTS_MAX) {
    console.error("Vérification Stripe : trop d'abonnements pour une lecture complète, rien n'est corrigé.");
    return { actif: false, raison: "Trop d'abonnements pour une lecture complète." };
  }
  const parJoueur = new Map<string, Stripe.Subscription[]>();
  for (const abonnement of vivants) {
    const joueur = abonnement.metadata?.profile_id;
    if (joueur) parJoueur.set(joueur, [...(parJoueur.get(joueur) ?? []), abonnement]);
  }

  const suivis: Suivi[] = [];
  for (let page = 0; ; page += 1) {
    const { data, error } = await admin
      .from("abonnements_stripe")
      .select("profile_id, abonnement_stripe_id, statut, maj_le")
      .order("profile_id", { ascending: true })
      .range(page * PAGE_BASE, (page + 1) * PAGE_BASE - 1);
    if (error || !data) return { actif: false, raison: "Lecture des abonnements impossible." };
    suivis.push(...data);
    if (data.length < PAGE_BASE) break;
  }

  const offres = new Map<string, { offre: string; manuelle: boolean }>();
  for (let i = 0; i < suivis.length; i += PAQUET) {
    const ids = suivis.slice(i, i + PAQUET).map((s) => s.profile_id);
    const { data, error } = await admin.from("comptes_offres").select("profile_id, offre, attribue_par").in("profile_id", ids);
    if (error || !data) return { actif: false, raison: "Lecture des offres impossible." };
    for (const ligne of data) offres.set(ligne.profile_id, { offre: ligne.offre, manuelle: ligne.attribue_par !== null });
  }

  const bilan = { examines: 0, accordees: 0, retirees: 0, signales: 0, erreurs: 0 };
  let restants = false;
  for (const suivi of suivis) {
    if (options.finAu !== undefined && Date.now() > options.finAu) {
      restants = true;
      break;
    }
    bilan.examines += 1;
    const offreActuelle = offres.get(suivi.profile_id) ?? null;
    const offreStripe = offreActuelle !== null && !offreActuelle.manuelle;

    let candidats = parJoueur.get(suivi.profile_id) ?? [];
    if (candidats.length === 0) {
      // Aucun abonnement non résilié chez Stripe. Rien à faire, sauf si la
      // base croit encore à une offre Stripe ou à un abonnement en vie : on
      // relit alors l'abonnement connu (résilié, sans doute).
      if (!offreStripe && !(suivi.statut && abonnementEnVie(suivi.statut))) continue;
      const connu = suivi.abonnement_stripe_id ? await relireAbonnement(client, suivi.abonnement_stripe_id) : null;
      if (!connu) {
        if (offreStripe) {
          // Jamais retirée d'office : un abonnement que Stripe ne connaît
          // pas (autre clé, supprimé) se regarde à la main.
          console.error(`Vérification Stripe : offre accordée par Stripe sans abonnement retrouvé (joueur ${suivi.profile_id}).`);
          bilan.signales += 1;
        } else {
          bilan.erreurs += 1;
        }
        continue;
      }
      candidats = [connu];
    }

    const abonnement = abonnementCourant(candidats, suivi.profile_id, suivi.abonnement_stripe_id);
    if (!abonnement) {
      if (offreStripe) {
        console.error(`Vérification Stripe : offre accordée par Stripe sans abonnement étiqueté (joueur ${suivi.profile_id}).`);
        bilan.signales += 1;
      }
      continue;
    }
    const decision = decisionVerification({
      statutStripe: abonnement.status,
      enPause: Boolean(abonnement.pause_collection),
      prixFacture: abonnement.items?.data?.[0]?.price?.id,
      prix,
      offreActuelle,
    });
    const suiviChange = abonnement.id !== suivi.abonnement_stripe_id || abonnement.status !== suivi.statut;
    if (decision.action === "signaler") {
      console.error(`Vérification Stripe : prix de l'abonnement ${abonnement.id} sans offre correspondante.`);
      bilan.signales += 1;
    }
    if (decision.action === "aucune" && !suiviChange) continue;
    if (decision.action === "signaler" && !suiviChange) continue;
    if (!(await suiviInchange(admin, suivi))) continue;

    if (decision.action === "accorder" || decision.action === "retirer") {
      if (await appliquerAbonnement(client, admin, suivi.profile_id, abonnement)) {
        if (decision.action === "accorder") bilan.accordees += 1;
        else bilan.retirees += 1;
      } else {
        bilan.erreurs += 1;
      }
      continue;
    }
    // Seul le suivi (statut, abonnement courant) est à mettre à jour.
    if (!(await suivreAbonnement(admin, suivi.profile_id, abonnement))) bilan.erreurs += 1;
  }

  return { actif: true, abonnementsLus: vivants.length, ...bilan, restants };
}
