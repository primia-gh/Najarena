import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { formaterDate } from "@/lib/tournois";
import { classeCarte } from "@/lib/ui";
import EtatVide from "@/components/ui/EtatVide";
import IllustrationEffectifVide from "@/components/ui/IllustrationEffectifVide";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";

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
      "id, profile_a, profile_b, cree_le, a:profiles!conversations_profile_a_fkey(pseudo, slug), b:profiles!conversations_profile_b_fkey(pseudo, slug)",
    )
    .or(`profile_a.eq.${userData.user.id},profile_b.eq.${userData.user.id}`)
    .order("cree_le", { ascending: false });

  const conversations = conversationsData ?? [];
  const conversationIds = conversations.map((c) => c.id);

  const dernierMessageParConversation = new Map<
    string,
    { contenu: string; envoyeLe: string; nonLu: boolean }
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
      });
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative mx-auto max-w-5xl px-gouttiere">
        <Apparition>
          <Link
            href="/moi"
            className="inline-flex min-h-11 items-center font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
          >
            ← Mon compte
          </Link>
          <h1 className="mt-6 font-titre uppercase text-section font-black tracking-[1px] text-text hyphens-auto [overflow-wrap:anywhere]">
            Messages
          </h1>
        </Apparition>

        <Apparition delai={0.1}>
          <section className="mt-8">
            {conversations.length === 0 ? (
              <div className="mt-3">
                <EtatVide illustration={<IllustrationEffectifVide />}>
                  Aucune conversation pour l&apos;instant.
                </EtatVide>
              </div>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {conversations.map((c) => {
                  const autre = c.profile_a === userData.user!.id ? c.b : c.a;
                  const dernier = dernierMessageParConversation.get(c.id);
                  return (
                    <li key={c.id}>
                      <Link
                        href={`/moi/messages/${c.id}`}
                        className={"flex items-center justify-between gap-3 " + classeCarte(dernier?.nonLu ? "atteste" : "none", true)}
                      >
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-text">
                            {autre?.pseudo ?? "Joueur inconnu"}
                          </span>
                          {dernier && (
                            <p className="mt-0.5 truncate text-sm text-muted">{dernier.contenu}</p>
                          )}
                        </div>
                        {dernier && (
                          <span className="shrink-0 font-texte tabular-nums text-mini text-muted">
                            {formaterDate(dernier.envoyeLe)}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </Apparition>
      </div>
    </main>
  );
}
