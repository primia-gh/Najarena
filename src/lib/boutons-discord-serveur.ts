// Clic sur un bouton d'un message privé Discord (09/10/2026, idée en
// réserve n°10). La route /api/discord/interactions a déjà vérifié la
// signature de Discord ; l'identifiant Discord de celui qui a cliqué est
// donc sûr. L'action passe par agir_depuis_discord (docs/schema.sql), qui
// appelle les fonctions du site au nom du joueur lié à ce compte : mêmes
// règles, mêmes refus. Les notifications qui suivent partent après la
// réponse (Discord attend une réponse en moins de 3 secondes).

import { after } from "next/server";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { URL_SITE } from "@/lib/notifications";
import {
  composantsDiscord,
  lireIdBouton,
  messageRefusBouton,
  messageReussiteBouton,
  RIEN_A_CONFIRMER,
  type LigneComposants,
  type ResultatBouton,
} from "@/lib/boutons-discord";
import {
  apresDeclarationPret,
  boutonPret,
  matchDuDuel,
  prevenirDefiLance,
  prevenirReponseDefi,
} from "@/lib/suites-joueur";

const TYPE_MESSAGE = 4;
const TYPE_MISE_A_JOUR = 7;
/** Message visible seulement de celui qui a cliqué. */
const EPHEMERE = 64;

export type ReponseClic =
  | { type: typeof TYPE_MESSAGE; data: { content: string; flags: number; allowed_mentions: { parse: [] } } }
  | {
      type: typeof TYPE_MISE_A_JOUR;
      data: { content: string; components: LigneComposants[]; allowed_mentions: { parse: [] } };
    };

function refus(texte: string): ReponseClic {
  return { type: TYPE_MESSAGE, data: { content: `⚠️ ${texte}`, flags: EPHEMERE, allowed_mentions: { parse: [] } } };
}

/** Le message d'origine, complété du résultat ; ses boutons disparaissent (ou sont remplacés). */
function miseAJour(contenu: string, texte: string, composants: LigneComposants[] = []): ReponseClic {
  return {
    type: TYPE_MISE_A_JOUR,
    data: { content: `${contenu}\n\n✅ ${texte}`.slice(0, 2000), components: composants, allowed_mentions: { parse: [] } },
  };
}

interface ResultatAgir extends ResultatBouton {
  joueur?: string;
  defi?: string;
  adversaire?: string;
}

function lireResultat(valeur: unknown): ResultatAgir {
  if (!valeur || typeof valeur !== "object" || Array.isArray(valeur)) return {};
  const v = valeur as Record<string, unknown>;
  const texte = (cle: string) => (typeof v[cle] === "string" ? (v[cle] as string) : undefined);
  return {
    ok: v.ok === true,
    nouveau: v.nouveau === true,
    slug: texte("slug") ?? null,
    joueur: texte("joueur"),
    defi: texte("defi"),
    adversaire: texte("adversaire"),
  };
}

export async function traiterClicBouton(
  discordId: string | undefined,
  customId: string | undefined,
  contenuMessage: string | undefined,
): Promise<ReponseClic> {
  const bouton = lireIdBouton(customId);
  if (!bouton || !discordId) return refus("Ce bouton n'est plus valable.");
  const admin = creerClientAdmin();
  if (!admin) return refus(`Action indisponible pour l'instant : utilise le site, ${URL_SITE}`);

  const { data, error } = await admin.rpc("agir_depuis_discord", {
    p_discord_id: discordId,
    p_action: bouton.action,
    p_cible: bouton.cible,
  });
  if (error) return refus(messageRefusBouton(bouton.action, error.message));

  const resultat = lireResultat(data);
  const joueur = resultat.joueur;
  const contenu = contenuMessage ?? "";

  switch (bouton.action) {
    case "checkin": {
      const texte = messageReussiteBouton("checkin", resultat);
      return texte ? miseAJour(contenu, texte) : refus(RIEN_A_CONFIRMER);
    }
    case "pret": {
      // Lecture rapide de l'adversaire pour la réponse ; la notification
      // part ensuite.
      const { adversairePret } = joueur
        ? await apresDeclarationPret(bouton.cible, joueur, false)
        : { adversairePret: false };
      if (joueur && resultat.nouveau && !adversairePret) {
        after(() => apresDeclarationPret(bouton.cible, joueur, true).then(() => undefined));
      }
      return miseAJour(contenu, messageReussiteBouton("pret", resultat, { adversairePret }) ?? "");
    }
    case "defi_oui":
    case "defi_non": {
      const accepte = bouton.action === "defi_oui";
      if (joueur) after(() => prevenirReponseDefi(bouton.cible, joueur, accepte, resultat.slug ?? null));
      const matchId = accepte && resultat.slug ? await matchDuDuel(resultat.slug) : null;
      return miseAJour(
        contenu,
        messageReussiteBouton(bouton.action, resultat) ?? "",
        matchId
          ? composantsDiscord([boutonPret(matchId)], {
              libelle: "Salle de match",
              url: `${URL_SITE}/lol/tournois/${resultat.slug}#ton-match`,
            })
          : [],
      );
    }
    case "revanche": {
      const adversaireId = resultat.adversaire;
      if (joueur && adversaireId) after(() => prevenirDefiLance(joueur, adversaireId, resultat.defi ?? null));
      const { data: profil } = adversaireId
        ? await admin.from("profiles").select("pseudo").eq("id", adversaireId).maybeSingle()
        : { data: null };
      return miseAJour(contenu, messageReussiteBouton("revanche", resultat, { adversaire: profil?.pseudo }) ?? "");
    }
  }
}
