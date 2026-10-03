import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { STATUTS_PUBLICS } from "@/lib/tournois";

// NEXT_PUBLIC_SITE_URL : à définir avec le vrai domaine avant mise en
// production (voir .env.local) — repli sur localhost en dev, jamais un
// domaine inventé.
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Refait le 28/09/2026 (audit M11) : ajoute les pages écrites pour le
// référencement (guide, journal, note du fondateur, tournoi d'exemple,
// coéquipiers, équipes) et ne propose plus à Google que les profils qui
// ont au moins un match joué — un profil vide n'a rien à montrer. Les
// tournois annulés n'y figurent plus.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const [{ data: tournois }, { data: ratings }, { data: equipes }, { data: recaps }, { data: communautes }] = await Promise.all([
    supabase
      .from("tournaments")
      .select("slug, cree_le")
      .eq("nature", "tournoi")
      .in(
        "statut",
        STATUTS_PUBLICS.filter((s) => s !== "annule"),
      ),
    supabase.from("ratings").select("maj_le, profil:profiles(slug)").gt("matchs_joues", 0),
    supabase.from("teams").select("slug, cree_le"),
    supabase.from("recaps_semaine").select("semaine, publie_le").eq("annonce", true).order("semaine", { ascending: false }).limit(52),
    supabase.from("communautes").select("slug, cree_le"),
  ]);

  const pagesStatiques: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/lol`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/lol/tournois`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/lol/classement`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE_URL}/registre`, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE_URL}/lol/saisons`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE_URL}/lol/tournois/demo`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${BASE_URL}/lol/coequipiers`, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE_URL}/lol/arene`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/lol/pronostics`, changeFrequency: "daily", priority: 0.5 },
    { url: `${BASE_URL}/communautes`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE_URL}/comment-ca-marche`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/faq`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/journal`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE_URL}/note-du-fondateur`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${BASE_URL}/tarifs`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/mentions-legales`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE_URL}/cgu`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE_URL}/confidentialite`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const pagesTournois: MetadataRoute.Sitemap = (tournois ?? []).map((t) => ({
    url: `${BASE_URL}/lol/tournois/${t.slug}`,
    lastModified: t.cree_le,
    changeFrequency: "hourly",
    priority: 0.7,
  }));

  // Un joueur peut avoir une ligne de rating par saison : on garde la plus
  // récente mise à jour.
  const derniereMaj = new Map<string, string>();
  for (const r of ratings ?? []) {
    const slug = r.profil?.slug;
    if (!slug) continue;
    const connue = derniereMaj.get(slug);
    if (!connue || r.maj_le > connue) derniereMaj.set(slug, r.maj_le);
  }
  const pagesJoueurs: MetadataRoute.Sitemap = Array.from(derniereMaj, ([slug, majLe]) => ({
    url: `${BASE_URL}/joueur/${slug}`,
    lastModified: majLe,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const pagesEquipes: MetadataRoute.Sitemap = (equipes ?? []).map((e) => ({
    url: `${BASE_URL}/equipe/${e.slug}`,
    lastModified: e.cree_le,
    changeFrequency: "weekly",
    priority: 0.4,
  }));

  // Récaps de semaine publiés (semaines avec au moins un tournoi clôturé).
  const pagesRecaps: MetadataRoute.Sitemap = (recaps ?? []).map((r) => ({
    url: `${BASE_URL}/lol/semaine/${r.semaine}`,
    lastModified: r.publie_le,
    changeFrequency: "yearly",
    priority: 0.4,
  }));

  // Espaces communauté (audit N30).
  const pagesCommunautes: MetadataRoute.Sitemap = (communautes ?? []).map((c) => ({
    url: `${BASE_URL}/communaute/${c.slug}`,
    lastModified: c.cree_le,
    changeFrequency: "weekly",
    priority: 0.4,
  }));

  return [...pagesStatiques, ...pagesTournois, ...pagesJoueurs, ...pagesEquipes, ...pagesRecaps, ...pagesCommunautes];
}
