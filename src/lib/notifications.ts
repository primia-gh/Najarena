// Notifications e-mail — docs/audit et CLAUDE.md §5 (Discord annoncé comme
// canal principal, mais tant qu'il n'est pas construit, l'e-mail reste le
// seul canal réel). Ne bloque jamais l'action métier : une notification qui
// échoue est journalisée en silence, jamais renvoyée à l'appelant — un
// résultat de match ou un litige doit s'enregistrer même si Resend est en
// panne ou mal configuré.

import { Resend } from "resend";
import webpush, { WebPushError } from "web-push";
import { creerClientAdmin } from "@/lib/supabase/admin";

const cle = process.env.RESEND_API_KEY;
const resend = cle ? new Resend(cle) : null;

// Notifications push web — contrairement à Resend/Sentry, aucun compte
// externe requis : la paire de clés VAPID s'auto-génère localement (voir
// .env.local). Repli gracieux identique si absentes malgré tout.
const clePubliqueVapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const clePriveeVapid = process.env.VAPID_PRIVATE_KEY;
const sujetVapid = process.env.VAPID_SUBJECT;
const vapidConfigure = Boolean(clePubliqueVapid && clePriveeVapid && sujetVapid);
if (vapidConfigure) {
  webpush.setVapidDetails(sujetVapid!, clePubliqueVapid!, clePriveeVapid!);
}

// Domaine d'envoi non vérifié tant que le site n'est pas déployé sur un
// vrai domaine — voir .env.local. Resend refusera l'envoi avec ce repli
// par défaut jusqu'à ce qu'un domaine soit vérifié dans le tableau de
// bord Resend, ce qui est attendu tant que Najarena n'est pas en ligne.
const EXPEDITEUR = process.env.RESEND_FROM_EMAIL ?? "Najarena <onboarding@resend.dev>";

// Même repli que sitemap.ts/robots.ts/layout.tsx — jamais un domaine
// inventé, seulement le vrai domaine une fois choisi.
export const URL_SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function enveloppe(titre: string, corps: string): string {
  return `
    <div style="font-family:'JetBrains Mono',ui-monospace,monospace;max-width:480px;margin:0 auto;color:#12161d;">
      <p style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#5b6672;margin:0 0 16px;">Najarena</p>
      <h1 style="font-family:system-ui,sans-serif;font-size:20px;font-weight:800;margin:0 0 12px;">${titre}</h1>
      <div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#12161d;">${corps}</div>
    </div>
  `;
}

function texteBrut(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Chaque appelant de notifierJoueur inclut toujours exactement un lien
// (voir organisation-actions.ts/litige-actions.ts/admin-actions.ts/
// rapprochement.ts) — sert de cible de clic pour la notification push,
// sans avoir à faire passer une URL séparée dans chaque appel existant.
function extraireLien(html: string): string {
  const trouve = html.match(/href="([^"]+)"/);
  return trouve ? trouve[1] : URL_SITE;
}

/**
 * Envoie une notification push à tous les appareils abonnés d'un joueur.
 * N'agit pas si les clés VAPID sont absentes. Un abonnement expiré/révoqué
 * (statut 404/410 du service de push) est supprimé silencieusement plutôt
 * que retenté indéfiniment.
 */
async function envoyerPush(profileId: string, titre: string, corpsHtml: string): Promise<void> {
  if (!vapidConfigure) return;

  const admin = creerClientAdmin();
  if (!admin) return;

  const { data: abonnements } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("profile_id", profileId);

  if (!abonnements || abonnements.length === 0) return;

  const payload = JSON.stringify({
    titre,
    corps: texteBrut(corpsHtml),
    url: extraireLien(corpsHtml),
  });

  await Promise.all(
    abonnements.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
      } catch (err) {
        if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
          await admin.from("push_subscriptions").delete().eq("id", s.id);
        }
        // Toute autre erreur (réseau, service de push temporairement
        // indisponible...) ne doit jamais remonter à l'appelant.
      }
    }),
  );
}

// Notification Discord vers un serveur (CLAUDE.md §5 — canal de
// notification principal, jamais construit jusqu'ici, cf. mémoire du
// 2026-09-11). Contrairement à notifierJoueur (personnel, par joueur),
// celle-ci annonce un événement à toute la communauté sur un salon —
// aucun compte externe complexe requis, juste un webhook créé en 30
// secondes depuis les paramètres d'un salon Discord (Intégrations >
// Webhooks). Repli gracieux identique aux autres secrets.
const webhookDiscord = process.env.DISCORD_WEBHOOK_URL;

/**
 * Poste un message sur le serveur Discord configuré. N'agit pas si
 * DISCORD_WEBHOOK_URL est absente ; une panne du webhook ne doit jamais
 * faire échouer l'action métier qui l'appelle (même contrat que
 * notifierJoueur).
 */
export async function notifierDiscord(contenu: string): Promise<void> {
  if (!webhookDiscord) return;

  try {
    await fetch(webhookDiscord, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: contenu }),
    });
  } catch {
    // Idem : jamais remonté à l'appelant.
  }
}

/**
 * Envoie une notification (e-mail + push) à un joueur (par son profile_id).
 * N'agit pas si les secrets correspondants sont absents (même principe de
 * repli gracieux que creerClientAdmin) : l'absence de configuration ne
 * doit jamais faire échouer l'action qui déclenche la notification.
 */
export async function notifierJoueur(
  profileId: string,
  sujet: string,
  titre: string,
  corpsHtml: string,
): Promise<void> {
  await Promise.all([
    envoyerPush(profileId, titre, corpsHtml),
    (async () => {
      if (!resend) return;

      const admin = creerClientAdmin();
      if (!admin) return;

      try {
        const { data } = await admin.auth.admin.getUserById(profileId);
        const email = data.user?.email;
        if (!email) return;

        await resend.emails.send({
          from: EXPEDITEUR,
          to: email,
          subject: sujet,
          html: enveloppe(titre, corpsHtml),
        });
      } catch {
        // Une notification qui échoue ne doit jamais remonter à l'appelant.
      }
    })(),
  ]);
}
