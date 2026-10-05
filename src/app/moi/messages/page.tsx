import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { formaterDate } from "@/lib/tournois";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";
import AvatarJoueur from "@/components/design/AvatarJoueur";
import Icone from "@/components/design/Icone";
import LibelleSection from "@/components/design/LibelleSection";
import Panneau from "@/components/design/Panneau";

export const metadata: Metadata = {
  title: "Messages — Najarena",
  robots: { index: false, follow: false },
};

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { data: conversationsData } = await supabase
    .from("conversations")
    .select(
      "id, profile_a, profile_b, cree_le, a:profiles!conversations_profile_a_fkey(pseudo, slug, avatar_url), b:profiles!conversations_profile_b_fkey(pseudo, slug, avatar_url)",
    )
    .or(`profile_a.eq.${userData.user.id},profile_b.eq.${userData.user.id}`)
    .order("cree_le", { ascending: false });

  const conversations = conversationsData ?? [];
  const conversationIds = conversations.map((c) => c.id);

  const dernierMessageParConversation = new Map<
    string,
    { contenu: string; envoyeLe: string; nonLu: boolean; deMoi: boolean }
  >();
  if (conversationIds.length > 0) {
    const { data: messagesData } = await supabase
      .from("messages")
      .select("conversation_id, contenu, envoye_le, expediteur_id, lu_le")
      .in("conversation_id", conversationIds)
      .order("envoye_le", { ascending: true });

    for (const m of messagesData ?? []) {
      dernierMessageParConversation.set(m.conversation_id, {
        contenu: m.contenu,
        envoyeLe: m.envoye_le,
        nonLu: m.expediteur_id !== userData.user.id && m.lu_le === null,
        deMoi: m.expediteur_id === userData.user.id,
      });
    }
  }

  // Revue visuelle du 05/10/2026 : la conversation qui vient de recevoir un
  // message remonte en tête (avant : ordre de création), et un message non
  // lu se signale par un libellé « Nouveau », pas seulement par une couleur.
  const triees = [...conversations].sort((x, y) => {
    const dx = dernierMessageParConversation.get(x.id)?.envoyeLe ?? x.cree_le;
    const dy = dernierMessageParConversation.get(y.id)?.envoyeLe ?? y.cree_le;
    return Date.parse(dy) - Date.parse(dx);
  });
  const nonLues = triees.filter((c) => dernierMessageParConversation.get(c.id)?.nonLu).length;

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-10 px-grille *:max-w-3xl">
        <Apparition>
          <Link
            href="/moi"
            className="inline-flex min-h-11 items-center gap-2 font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
          >
            <Icone nom="fleche-gauche" taille={14} />
            Mon compte
          </Link>
          <LibelleSection className="mt-6">
            Messagerie{nonLues > 0 ? ` · ${nonLues} non lue${nonLues > 1 ? "s" : ""}` : ""}
          </LibelleSection>
          <h1 className="mt-3 font-titre text-sous-titre font-black uppercase">Messages</h1>
        </Apparition>

        <Apparition delai={0.08}>
          {triees.length === 0 ? (
            <Panneau reperes className="flex flex-col items-start gap-4 p-8">
              <p className="font-titre text-3xl font-black uppercase">Aucune conversation.</p>
              <p className="text-text-2">
                Une conversation s&apos;ouvre quand un organisateur te contacte depuis ton CV (bouton « Contacter », offre
                Organisateur). Tu lui réponds ensuite ici.
              </p>
            </Panneau>
          ) : (
            <ul className="border-t border-line-strong">
              {triees.map((c) => {
                const autre = c.profile_a === userData.user!.id ? c.b : c.a;
                const dernier = dernierMessageParConversation.get(c.id);
                return (
                  <li key={c.id}>
                    <Link
                      href={`/moi/messages/${c.id}`}
                      className="group flex items-center gap-4 border-b border-line py-4 hover:bg-[rgba(245,245,244,0.02)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      <AvatarJoueur pseudo={autre?.pseudo ?? "?"} src={autre?.avatar_url ?? null} taille={44} />
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex items-center gap-3">
                          <span className={`truncate ${dernier?.nonLu ? "font-bold text-text" : "font-semibold text-text"} group-hover:text-accent`}>
                            {autre?.pseudo ?? "Joueur inconnu"}
                          </span>
                          {dernier?.nonLu && (
                            <span className="inline-flex items-center gap-1.5 rounded-bouton bg-accent px-1.5 py-px font-texte text-[10px] font-bold tracking-[2px] text-on-accent uppercase">
                              Nouveau
                            </span>
                          )}
                        </span>
                        {dernier && (
                          <span className={`truncate text-sm ${dernier.nonLu ? "text-text-2" : "text-muted"}`}>
                            {dernier.deMoi && <span className="text-faint">Toi : </span>}
                            {dernier.contenu}
                          </span>
                        )}
                      </span>
                      {dernier && (
                        <span className="shrink-0 text-xs text-muted tabular-nums">{formaterDate(dernier.envoyeLe)}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Apparition>
      </div>
    </main>
  );
}
