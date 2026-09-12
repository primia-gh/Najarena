import nacl from "tweetnacl";
import { createClient } from "@/lib/supabase/server";
import { arrondir, trouverPalier } from "@/lib/classement";
import { formaterDate } from "@/lib/tournois";
import { URL_SITE } from "@/lib/notifications";

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
const TYPE_PONG = 1;
const TYPE_MESSAGE = 4;

interface InteractionDiscord {
  type: number;
  data?: { name?: string };
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

  const { data: jeu } = await supabase.from("games").select("id").eq("slug", "lol").maybeSingle();
  if (!jeu) return "Classement indisponible pour l'instant.";

  const { data: saison } = await supabase
    .from("seasons")
    .select("id")
    .eq("game_id", jeu.id)
    .eq("est_courante", true)
    .maybeSingle();
  if (!saison) return "Le classement n'est pas encore ouvert — pas encore de saison en cours.";

  const [{ data: classement }, { data: paliersData }] = await Promise.all([
    supabase
      .from("ratings")
      .select("rating, profile:profiles(pseudo)")
      .eq("game_id", jeu.id)
      .eq("season_id", saison.id)
      .eq("est_classe", true)
      .order("rating", { ascending: false })
      .limit(5),
    supabase.from("tiers").select("nom, rating_min").eq("game_id", jeu.id),
  ]);

  if (!classement || classement.length === 0) {
    return "Personne n'est encore classé — il faut au moins une dizaine de matchs joués.";
  }

  const paliers = (paliersData ?? []).map((p) => ({ nom: p.nom, ratingMin: p.rating_min }));

  const lignes = classement.map((r, i) => {
    const palier = trouverPalier(r.rating, paliers);
    return `${i + 1}. **${r.profile?.pseudo ?? "Joueur inconnu"}** — ${arrondir(r.rating)}${palier ? ` (${palier.nom})` : ""}`;
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
    (t) => `• **${t.nom}** — ${t.capacite} joueurs, ${t.region}, ${formaterDate(t.debute_le)}\n  ${URL_SITE}/lol/tournois/${t.slug}`,
  );

  return `**Tournois ouverts — Najarena**\n${lignes.join("\n")}`;
}

export async function POST(request: Request) {
  const corps = await request.text();
  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");

  if (!verifierSignature(corps, signature, timestamp)) {
    return new Response("Signature invalide", { status: 401 });
  }

  const interaction = JSON.parse(corps) as InteractionDiscord;

  if (interaction.type === TYPE_PING) {
    return reponseJson({ type: TYPE_PONG });
  }

  if (interaction.type === TYPE_APPLICATION_COMMAND) {
    const nomCommande = interaction.data?.name;
    let contenu = "Commande inconnue.";

    if (nomCommande === "classement") {
      contenu = await repondreClassement();
    } else if (nomCommande === "tournois") {
      contenu = await repondreTournois();
    }

    return reponseJson({ type: TYPE_MESSAGE, data: { content: contenu } });
  }

  return reponseJson({ type: TYPE_PONG });
}
