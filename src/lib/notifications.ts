// Notifications e-mail — docs/audit et CLAUDE.md §5 (Discord annoncé comme
// canal principal, mais tant qu'il n'est pas construit, l'e-mail reste le
// seul canal réel). Ne bloque jamais l'action métier : une notification qui
// échoue est journalisée en silence, jamais renvoyée à l'appelant — un
// résultat de match ou un litige doit s'enregistrer même si Resend est en
// panne ou mal configuré.

import { Resend } from "resend";
import { creerClientAdmin } from "@/lib/supabase/admin";

const cle = process.env.RESEND_API_KEY;
const resend = cle ? new Resend(cle) : null;

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

/**
 * Envoie un e-mail de notification à un joueur (par son profile_id).
 * N'agit pas si RESEND_API_KEY ou SUPABASE_SERVICE_ROLE_KEY sont absentes
 * (mêmes principe de repli gracieux que creerClientAdmin) : l'absence de
 * configuration ne doit jamais faire échouer l'action qui déclenche la
 * notification.
 */
export async function notifierJoueur(
  profileId: string,
  sujet: string,
  titre: string,
  corpsHtml: string,
): Promise<void> {
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
}
