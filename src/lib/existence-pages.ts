// Vraies pages 404 (22/11/2026). Les pages joueur, tournoi et équipe ont un écran
// de chargement (loading.tsx) : dès qu'il s'affiche, la réponse part avec
// le code 200 et un notFound() de la page ne peut plus le changer (Google
// recevait « page trouvée » pour une adresse qui n'existe pas). Le layout
// du segment vérifie donc l'existence avant l'écran de chargement, par une
// lecture légère. En cas d'erreur de lecture, on ne conclut rien : la page
// décide comme avant.

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { adresseActuelleProfil } from "@/lib/visites-profil";
import { estVisiblePubliquement } from "@/lib/tournois";

/** Aucun profil à cette adresse, ni ancienne adresse d'un joueur qui a changé de pseudo. */
export const profilIntrouvable = cache(async (slug: string): Promise<boolean> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id").eq("slug", slug).maybeSingle();
  if (error || data) return false;
  return (await adresseActuelleProfil(supabase, slug)) === null;
});

/** Aucun tournoi visible publiquement à cette adresse (même règle que la page). */
export const tournoiIntrouvable = cache(async (slug: string): Promise<boolean> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tournaments").select("statut").eq("slug", slug).maybeSingle();
  if (error) return false;
  return !data || !estVisiblePubliquement(data.statut);
});

/** Aucune équipe à cette adresse. */
export const equipeIntrouvable = cache(async (slug: string): Promise<boolean> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("teams").select("id").eq("slug", slug).maybeSingle();
  if (error) return false;
  return !data;
});
