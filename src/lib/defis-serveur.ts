import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { etatDefi, type EtatDefi } from "@/lib/defis";

// Défis du joueur connecté pour son tableau de bord (audit N16, N18) : la
// base ne lui montre que les siens (RLS « un joueur voit ses defis »).

export interface DefiAffiche {
  id: string;
  etat: EtatDefi;
  condition: string;
  expireLe: string;
  /** L'autre joueur ; nul pour un lien d'invitation pas encore utilisé. */
  autre: { pseudo: string; slug: string } | null;
  code: string | null;
  tournoi: { slug: string; statut: string } | null;
}

export interface MesDefis {
  recus: DefiAffiche[];
  envoyes: DefiAffiche[];
  invitations: DefiAffiche[];
  duels: DefiAffiche[];
}

export async function chargerMesDefis(supabase: SupabaseClient<Database>, moi: string): Promise<MesDefis> {
  const { data } = await supabase
    .from("defis")
    .select(
      "id, statut, condition_victoire, code_invitation, expire_le, lanceur_id, adversaire_id, lanceur:profiles!defis_lanceur_id_fkey(pseudo, slug), adversaire:profiles!defis_adversaire_id_fkey(pseudo, slug), tournoi:tournaments(slug, statut)",
    )
    .order("cree_le", { ascending: false })
    .limit(30);

  const maintenant = new Date();
  const mes: MesDefis = { recus: [], envoyes: [], invitations: [], duels: [] };
  for (const d of data ?? []) {
    const jeLance = d.lanceur_id === moi;
    const defi: DefiAffiche = {
      id: d.id,
      etat: etatDefi(d.statut, d.expire_le, maintenant),
      condition: d.condition_victoire,
      expireLe: d.expire_le,
      autre: jeLance ? d.adversaire : d.lanceur,
      code: d.code_invitation,
      tournoi: d.tournoi,
    };
    if (defi.etat === "accepte" && defi.tournoi) mes.duels.push(defi);
    else if (defi.etat !== "en_attente") continue;
    else if (!jeLance) mes.recus.push(defi);
    else if (d.adversaire_id) mes.envoyes.push(defi);
    else mes.invitations.push(defi);
  }
  return mes;
}
