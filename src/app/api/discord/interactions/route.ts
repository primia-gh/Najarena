import nacl from "tweetnacl";
import { createClient } from "@/lib/supabase/server";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { arrondir, trouverPalier } from "@/lib/classement";
import { formaterDate } from "@/lib/tournois";
import { URL_SITE } from "@/lib/notifications";
import { echapperDiscord } from "@/lib/echappement";
import { lienOrganiser, lireOption, peutGererServeur, type OptionCommande } from "@/lib/discord-commandes";
import { horodatageRecent } from "@/lib/boutons-discord";
import { traiterClicBouton } from "@/lib/boutons-discord-serveur";

// Bot Discord interactif (3e volet de la demande Discord du 2026-09-12).
// Pas de connexion WebSocket permanente à un "gateway" — incompatible avec
// l'hébergement serverless de Vercel. Discord propose justement un mode
// HTTP pour ça : il POST chaque interaction ici, on répond en JSON, aucun
// process qui tourne en continu. Nécessite de créer une application sur
// https://discord.com/developers/applications puis de renseigner cette URL
// comme "Interactions Endpoint URL" (onglet General Information) — Discord
// vérifie l'URL avec un PING au moment où on colle l'URL, donc le code de
// vérification de signature ci-dessous doit être en place AVANT de coller
// l'URL, sinon Discord refuse de l'enregistrer.
const clePublique = process.env.DISCORD_PUBLIC_KEY;

const TYPE_PING = 1;
const TYPE_APPLICATION_COMMAND = 2;
/** Clic sur un bouton d'un message du bot (idée en réserve n°10). */
const TYPE_MESSAGE_COMPONENT = 3;
const TYPE_PONG = 1;
const TYPE_MESSAGE = 4;
/** Message visible seulement de celui qui a lancé la commande. */
const EPHEMERE = 64;

interface InteractionDiscord {
  type: number;
  guild_id?: string;
  /** Sur un serveur : le membre qui agit ; en message privé : `user`. */
  member?: { permissions?: string; user?: { id?: string } };
  user?: { id?: string };
  data?: { name?: string; options?: OptionCommande[]; custom_id?: string };
  message?: { content?: string };
}

function reponseJson(corps: unknown) {
  return new Response(JSON.stringify(corps), {
    headers: { "Content-Type": "application/json" },
  });
}

function verifierSignature(corps: string, signature: string | null, timestamp: string | null): boolean {
  if (!clePublique || !signature || !timestamp) return false;
  try {
    return nacl.sign.detached.verify(
      Buffer.from(timestamp + corps),
      Buffer.from(signature, "hex"),
      Buffer.from(clePublique, "hex"),
    );
  } catch {
    return false;
  }
}

async function repondreClassement(): Promise<string> {
  const supabase = await createClient();

  // game_id=1 est LoL — seule ligne de `games` en V1 (voir docs/design-system.md
  // et le correctif du 13/09/2026 sur l'accueil) : pas besoin de résoudre
  // l'id depuis un slug.
  const { data: saison } = await supabase
    .from("seasons")
    .select("id")
    .eq("game_id", 1)
    .eq("est_courante", true)
    .maybeSingle();
  if (!saison) return "Le classement n'est pas encore ouvert — pas encore de saison en cours.";

  const [{ data: classement }, { data: paliersData }] = await Promise.all([
    supabase
      .from("ratings")
      .select("rating, profile:profiles(pseudo)")
      .eq("game_id", 1)
      .eq("season_id", saison.id)
      .eq("est_classe", true)
      .order("rating", { ascending: false })
      .limit(5),
    supabase.from("tiers").select("nom, rating_min").eq("game_id", 1),
  ]);

  if (!classement || classement.length === 0) {
    return "Personne n'est encore classé — il faut au moins une dizaine de matchs joués.";
  }

  const paliers = (paliersData ?? []).map((p) => ({ nom: p.nom, ratingMin: p.rating_min }));

  const lignes = classement.map((r, i) => {
    const palier = trouverPalier(r.rating, paliers);
    return `${i + 1}. **${echapperDiscord(r.profile?.pseudo ?? "Joueur inconnu")}** — ${arrondir(r.rating)}${palier ? ` (${palier.nom})` : ""}`;
  });

  return `**Classement LoL — Najarena**\n${lignes.join("\n")}\n${URL_SITE}/lol/classement`;
}

async function repondreTournois(): Promise<string> {
  const supabase = await createClient();

  const { data: tournois } = await supabase
    .from("tournaments")
    .select("nom, slug, capacite, region, debute_le")
    .eq("statut", "ouvert")
    .order("debute_le", { ascending: true })
    .limit(5);

  if (!tournois || tournois.length === 0) {
    return "Aucun tournoi ouvert pour l'instant.";
  }

  const lignes = tournois.map(
    (t) =>
      `• **${echapperDiscord(t.nom)}** — ${t.capacite} joueurs, ${t.region}, ${formaterDate(t.debute_le)}\n  ${URL_SITE}/lol/tournois/${t.slug}`,
  );

  return `**Tournois ouverts — Najarena**\n${lignes.join("\n")}`;
}

// Espaces communauté (03/10/2026, audit N30) : /communaute affiche la
// communauté liée au serveur, /lier lie le serveur à une communauté (code
// donné sur la page de la communauté, membre autorisé à gérer le serveur),
// /organiser renvoie un lien pré-rempli vers la création de tournoi — le
// bot n'écrit jamais lui-même un tournoi : l'organisateur relit et valide
// sur le site, avec toutes les règles habituelles.
async function communauteDuServeur(guildId: string | undefined) {
  if (!guildId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("communautes")
    .select("id, slug, nom")
    .eq("discord_guild_id", guildId)
    .maybeSingle();
  return data;
}

async function repondreCommunaute(guildId: string | undefined): Promise<string> {
  if (!guildId) return "Cette commande s'utilise sur un serveur Discord.";
  const communaute = await communauteDuServeur(guildId);
  if (!communaute) {
    return `Aucune communauté Najarena n'est liée à ce serveur. Son fondateur peut la lier depuis la page de la communauté : ${URL_SITE}/communautes`;
  }

  const supabase = await createClient();
  const [{ count: nbMembres }, { data: tournois }, { data: membres }, { data: saison }] = await Promise.all([
    supabase
      .from("membres_communaute")
      .select("profile_id", { count: "exact", head: true })
      .eq("communaute_id", communaute.id),
    supabase
      .from("tournaments")
      .select("nom, slug, debute_le")
      .eq("communaute_id", communaute.id)
      .in("statut", ["ouvert", "checkin", "en_cours"])
      .order("debute_le", { ascending: true })
      .limit(3),
    supabase.from("membres_communaute").select("profile_id").eq("communaute_id", communaute.id).limit(500),
    supabase.from("seasons").select("id").eq("game_id", 1).eq("est_courante", true).maybeSingle(),
  ]);
  const ids = (membres ?? []).map((m) => m.profile_id);
  const { data: top } =
    saison && ids.length > 0
      ? await supabase
          .from("ratings")
          .select("rating, profile:profiles(pseudo)")
          .eq("game_id", 1)
          .eq("season_id", saison.id)
          .eq("est_classe", true)
          .in("profile_id", ids)
          .order("rating", { ascending: false })
          .limit(5)
      : { data: [] };

  const lignes = [`**${echapperDiscord(communaute.nom)}** — ${nbMembres ?? 0} membre(s) sur Najarena`];
  if ((tournois ?? []).length > 0) {
    lignes.push("", "**Prochains tournois**");
    for (const t of tournois ?? []) {
      lignes.push(`• ${echapperDiscord(t.nom)} — ${formaterDate(t.debute_le)}\n  ${URL_SITE}/lol/tournois/${t.slug}`);
    }
  }
  if ((top ?? []).length > 0) {
    lignes.push("", "**Classement interne (rating officiel)**");
    (top ?? []).forEach((r, i) =>
      lignes.push(`${i + 1}. ${echapperDiscord(r.profile?.pseudo ?? "Joueur")} — ${arrondir(r.rating)}`),
    );
  }
  lignes.push("", `${URL_SITE}/communaute/${communaute.slug}`);
  return lignes.join("\n");
}

async function repondreLier(interaction: InteractionDiscord): Promise<string> {
  if (!interaction.guild_id) return "Cette commande s'utilise sur le serveur Discord à lier.";
  if (!peutGererServeur(interaction.member?.permissions)) {
    return "Seul un membre autorisé à gérer ce serveur peut le lier à une communauté.";
  }
  const code = lireOption(interaction.data?.options, "code") ?? "";
  const admin = creerClientAdmin();
  if (!admin) return "Liaison indisponible pour l'instant.";
  const { data: nom, error } = await admin.rpc("lier_serveur_discord", {
    p_code: code,
    p_guild_id: interaction.guild_id,
  });
  if (error?.message.includes("SERVEUR_DEJA_LIE")) return "Ce serveur est déjà lié à une autre communauté Najarena.";
  if (error || !nom) {
    return "Code inconnu ou expiré : demande un nouveau code sur la page de la communauté (valable 30 minutes).";
  }
  return `Serveur lié à la communauté **${echapperDiscord(nom)}**. Tapez /communaute pour l'afficher.`;
}

async function repondreOrganiser(interaction: InteractionDiscord): Promise<string> {
  const options = interaction.data?.options;
  const communaute = await communauteDuServeur(interaction.guild_id);
  const aujourdhuiParis = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const resultat = lienOrganiser(
    {
      nom: lireOption(options, "nom"),
      jour: lireOption(options, "jour"),
      heure: lireOption(options, "heure"),
      places: lireOption(options, "places"),
      region: lireOption(options, "region"),
      communaute: communaute?.slug,
    },
    aujourdhuiParis,
    URL_SITE,
  );
  if (!resultat.ok) return resultat.erreur;
  return `Ton tournoi est prêt à être créé : relis-le et valide-le sur Najarena (connexion requise).\n${resultat.lien}`;
}

export async function POST(request: Request) {
  const corps = await request.text();
  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");

  if (!verifierSignature(corps, signature, timestamp)) {
    return new Response("Signature invalide", { status: 401 });
  }
  // Signature valable mais ancienne : requête captée puis rejouée.
  if (!horodatageRecent(timestamp, Date.now())) {
    return new Response("Requête trop ancienne", { status: 401 });
  }

  const interaction = JSON.parse(corps) as InteractionDiscord;

  if (interaction.type === TYPE_PING) {
    return reponseJson({ type: TYPE_PONG });
  }

  if (interaction.type === TYPE_APPLICATION_COMMAND) {
    const nomCommande = interaction.data?.name;
    let contenu = "Commande inconnue.";
    let ephemere = false;

    if (nomCommande === "classement") {
      contenu = await repondreClassement();
    } else if (nomCommande === "tournois") {
      contenu = await repondreTournois();
    } else if (nomCommande === "communaute") {
      contenu = await repondreCommunaute(interaction.guild_id);
    } else if (nomCommande === "lier") {
      contenu = await repondreLier(interaction);
      ephemere = true;
    } else if (nomCommande === "organiser") {
      contenu = await repondreOrganiser(interaction);
      ephemere = true;
    }

    return reponseJson({
      type: TYPE_MESSAGE,
      data: { content: contenu, ...(ephemere ? { flags: EPHEMERE } : {}), allowed_mentions: { parse: [] } },
    });
  }

  if (interaction.type === TYPE_MESSAGE_COMPONENT) {
    const discordId = interaction.user?.id ?? interaction.member?.user?.id;
    return reponseJson(await traiterClicBouton(discordId, interaction.data?.custom_id, interaction.message?.content));
  }

  return reponseJson({ type: TYPE_PONG });
}
