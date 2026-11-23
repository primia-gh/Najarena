import "server-only";
import type Stripe from "stripe";
import type { creerClientAdmin } from "@/lib/supabase/admin";
import { ORDRE_OFFRE, type Offre } from "@/lib/offres";
import {
  abonnementCourant,
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
      /** Clients relus chez Stripe pendant ce passage. */
      examines: number;
      accordees: number;
      retirees: number;
      /** Cas à regarder par un administrateur (prix inconnu, offre Stripe sans abonnement). */
      signales: number;
      /** Stripe ou la base n'a pas répondu : réessayé au prochain passage. */
      erreurs: number;
      /** D'autres clients restent à relire (au prochain passage). */
      restants: boolean;
    };

// Taille des paquets d'identifiants passés à la base (adresse de requête
// de taille raisonnable).
const PAQUET = 100;

// Abonnements d'un client chez Stripe (résiliés compris). Nul si Stripe ne
// répond pas, ou ne connaît pas ce client (clé de test contre clé réelle…) :
// on ne retire rien sur une absence de réponse.
async function abonnementsDuClient(client: Stripe, clientId: string): Promise<Stripe.Subscription[] | null> {
  try {
    const liste = await client.subscriptions.list({ customer: clientId, status: "all", limit: 20 });
    return liste.data;
  } catch {
    return null;
  }
}

// Date de relecture seule (rotation de la vérification quotidienne).
async function noterRelu(admin: ClientAdmin, profileId: string): Promise<boolean> {
  const { error } = await admin
    .from("abonnements_stripe")
    .update({ maj_le: new Date().toISOString() })
    .eq("profile_id", profileId);
  return !error;
}

/**
 * Vérification quotidienne (23/11/2026) : relit chez Stripe les abonnements
 * de chaque client et corrige l'offre si un message du webhook s'est perdu —
 * offre retirée à un abonnement impayé ou résilié, accordée à un abonnement
 * payé (premier abonnement et réabonnement compris : on relit le client, pas
 * seulement l'abonnement déjà connu). Simple rotation : passent d'abord les
 * clients relus le moins récemment, chaque client relu est daté, personne
 * n'est oublié (tous relus chaque jour jusqu'à `max` clients). `max` borne
 * les clients relus, `finAu` l'heure à laquelle on n'en commence plus.
 */
export async function verifierAbonnementsStripe(
  client: Stripe,
  admin: ClientAdmin,
  options: { max?: number; finAu?: number } = {},
): Promise<BilanVerificationAbonnements> {
  const prix = prixParOffre();
  if (!prixConfigures(prix)) return { actif: false, raison: "Aucun prix d'offre réglé (STRIPE_PRICE_*)." };
  const max = options.max ?? 100;

  const { data: suivis, error: erreurSuivis } = await admin
    .from("abonnements_stripe")
    .select("profile_id, client_stripe_id, abonnement_stripe_id, statut, maj_le")
    .order("maj_le", { ascending: true })
    // Au plus ce que l'API de la base rend en une fois ; la rotation fait
    // passer les suivants les jours d'après.
    .limit(1000);
  if (erreurSuivis || !suivis) return { actif: false, raison: "Lecture des abonnements impossible." };

  const offres = new Map<string, { offre: string; manuelle: boolean }>();
  for (let i = 0; i < suivis.length; i += PAQUET) {
    const ids = suivis.slice(i, i + PAQUET).map((s) => s.profile_id);
    const { data, error } = await admin.from("comptes_offres").select("profile_id, offre, attribue_par").in("profile_id", ids);
    if (error || !data) return { actif: false, raison: "Lecture des offres impossible." };
    for (const ligne of data) offres.set(ligne.profile_id, { offre: ligne.offre, manuelle: ligne.attribue_par !== null });
  }

  const bilan = { examines: 0, accordees: 0, retirees: 0, signales: 0, erreurs: 0 };
  for (const suivi of suivis) {
    if (bilan.examines >= max || (options.finAu !== undefined && Date.now() > options.finAu)) break;
    bilan.examines += 1;
    const abonnements = await abonnementsDuClient(client, suivi.client_stripe_id);
    if (!abonnements) {
      // Daté quand même : un client que Stripe ne connaît pas (créé avec
      // l'autre clé) ne repasse pas en tête chaque jour devant les autres.
      bilan.erreurs += 1;
      await noterRelu(admin, suivi.profile_id);
      continue;
    }
    const offreActuelle = offres.get(suivi.profile_id) ?? null;
    const abonnement = abonnementCourant(abonnements, suivi.profile_id, suivi.abonnement_stripe_id);
    if (!abonnement) {
      // Aucun abonnement étiqueté pour ce compte chez ce client. Une offre
      // accordée par Stripe sans abonnement est signalée, jamais retirée
      // d'office (un client lu avec la mauvaise clé n'a aucun abonnement).
      if (offreActuelle && !offreActuelle.manuelle) {
        console.error("Vérification Stripe : offre accordée par Stripe sans abonnement chez ce client.");
        bilan.signales += 1;
      }
      if (!(await noterRelu(admin, suivi.profile_id))) bilan.erreurs += 1;
      continue;
    }
    const decision = decisionVerification({
      statutStripe: abonnement.status,
      enPause: Boolean(abonnement.pause_collection),
      prixFacture: abonnement.items?.data?.[0]?.price?.id,
      prix,
      offreActuelle,
    });
    if (decision.action === "accorder" || decision.action === "retirer") {
      if (await appliquerAbonnement(client, admin, suivi.profile_id, abonnement)) {
        if (decision.action === "accorder") bilan.accordees += 1;
        else bilan.retirees += 1;
      } else {
        bilan.erreurs += 1;
      }
      continue;
    }
    if (decision.action === "signaler") {
      console.error(`Vérification Stripe : prix de l'abonnement ${abonnement.id} sans offre correspondante.`);
      bilan.signales += 1;
    }
    // Statut à jour, et date de relecture : les clients relus le moins
    // récemment passent en premier au prochain passage.
    if (!(await suivreAbonnement(admin, suivi.profile_id, abonnement))) bilan.erreurs += 1;
  }

  return { actif: true, ...bilan, restants: bilan.examines < suivis.length };
}
