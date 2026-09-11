import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { STATUTS_PUBLICS } from "@/lib/tournois";

// NEXT_PUBLIC_SITE_URL : à définir avec le vrai domaine avant mise en
// production (voir .env.local) — repli sur localhost en dev, jamais un
// domaine inventé.
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const [{ data: tournois }, { data: joueurs }] = await Promise.all([
    supabase
      .from("tournaments")
      .select("slug, cree_le")
      .in("statut", STATUTS_PUBLICS),
    supabase.from("profiles").select("slug, created_at"),
  ]);

  const pagesStatiques: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/lol`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/lol/tournois`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/lol/classement`, changeFrequency: "daily", priority: 0.8 },
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

  const pagesJoueurs: MetadataRoute.Sitemap = (joueurs ?? []).map((j) => ({
    url: `${BASE_URL}/joueur/${j.slug}`,
    lastModified: j.created_at,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...pagesStatiques, ...pagesTournois, ...pagesJoueurs];
}
