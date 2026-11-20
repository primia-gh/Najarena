// Alertes « tournoi pour toi » (20/11/2026), côté serveur : à chaque passage
// de la tâche des tournois automatiques (toutes les 5 minutes), la base
// choisit et réserve les alertes à envoyer (reserver_alertes_tournoi : une
// seule fois par joueur et par tournoi, 3 au plus par 24 h, même si deux
// passages se croisent) ; on les envoie ici, en notification et en message
// privé Discord, jamais par e-mail.

import { creerClientAdmin } from "@/lib/supabase/admin";
import { envoyerRappel, URL_SITE } from "@/lib/notifications";
import { messageAlerte } from "@/lib/alertes-tournoi";

/**
 * Alertes réservées par passage, au plus (la base plafonne à 500). Une
 * alerte est notée envoyée avant l'envoi (au plus une fois, jamais en
 * double) : un petit lot laisse à la tâche le temps de toutes les envoyer
 * avant sa limite de durée ; le reste part au passage suivant.
 */
const ALERTES_PAR_PASSAGE = 100;

/** Nombre d'alertes envoyées ce passage, ou null si la base n'est pas joignable. */
export async function envoyerAlertesTournoi(): Promise<number | null> {
  const admin = creerClientAdmin();
  if (!admin) return null;
  const { data, error } = await admin.rpc("reserver_alertes_tournoi", { p_limite: ALERTES_PAR_PASSAGE });
  if (error) return null;
  const alertes = data ?? [];
  // Par paquets de 20 : un passage reste sous la durée maximale de la tâche.
  for (let i = 0; i < alertes.length; i += 20) {
    await Promise.all(
      alertes.slice(i, i + 20).map((a) => {
        const { titre, texte } = messageAlerte(a);
        return envoyerRappel(a.profile_id, titre, texte, `${URL_SITE}/lol/tournois/${a.slug}`).catch(() => undefined);
      }),
    );
  }
  return alertes.length;
}
