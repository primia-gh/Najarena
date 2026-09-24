import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { envoyerMessage } from "@/lib/messagerie-actions";
import { formaterDate } from "@/lib/tournois";
import { classeCarte } from "@/lib/ui";
import Bouton from "@/components/ui/Bouton";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";

export const metadata: Metadata = {
  title: "Conversation — Najarena",
  robots: { index: false, follow: false },
};

interface ConversationPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string }>;
}

export default async function ConversationPage({ params, searchParams }: ConversationPageProps) {
  const { id } = await params;
  const { erreur } = await searchParams;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select(
      "id, profile_a, profile_b, a:profiles!conversations_profile_a_fkey(pseudo, slug), b:profiles!conversations_profile_b_fkey(pseudo, slug)",
    )
    .eq("id", id)
    .maybeSingle();

  // La policy RLS restreint déjà la lecture aux participants — si la
  // conversation n'apparaît pas, elle n'existe pas ou n'est pas la sienne :
  // même page 404 dans les deux cas, pas de fuite d'information.
  if (!conversation || (conversation.profile_a !== userData.user.id && conversation.profile_b !== userData.user.id)) {
    notFound();
  }

  const autre = conversation.profile_a === userData.user.id ? conversation.b : conversation.a;

  const { data: messagesData } = await supabase
    .from("messages")
    .select("id, expediteur_id, contenu, envoye_le, lu_le")
    .eq("conversation_id", id)
    .order("envoye_le", { ascending: true });

  const messages = messagesData ?? [];

  const idsAMarquer = messages
    .filter((m) => m.expediteur_id !== userData.user!.id && m.lu_le === null)
    .map((m) => m.id);
  if (idsAMarquer.length > 0) {
    await supabase.from("messages").update({ lu_le: new Date().toISOString() }).in("id", idsAMarquer);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative mx-auto max-w-3xl px-gouttiere">
        <Apparition>
          <Link
            href="/moi/messages"
            className="inline-flex min-h-11 items-center font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
          >
            ← Messages
          </Link>
          <h1 className="mt-2 font-titre uppercase text-section font-black tracking-[1px] text-text hyphens-auto [overflow-wrap:anywhere]">
            {autre?.pseudo ?? "Joueur inconnu"}
          </h1>
        </Apparition>

        {erreur && (
          <p className={"mt-4 " + classeCarte("sceau") + " text-sm text-danger"}>{erreur}</p>
        )}

        <Apparition delai={0.1}>
          <div className="mt-6 flex flex-col gap-3">
            {messages.map((m) => {
              const estMoi = m.expediteur_id === userData.user!.id;
              return (
                <div
                  key={m.id}
                  className={`max-w-[80%] rounded-[3px] border border-line px-3 py-2 text-sm ${
                    estMoi ? "self-end bg-surface text-text" : "self-start bg-bg text-text"
                  }`}
                >
                  <p>{m.contenu}</p>
                  <span className="mt-1 block font-texte tabular-nums text-mini text-muted">
                    {formaterDate(m.envoye_le)}
                  </span>
                </div>
              );
            })}
          </div>
        </Apparition>

        <Apparition delai={0.15}>
          <form action={envoyerMessage} className="mt-6 flex flex-col gap-2">
            <input type="hidden" name="conversation_id" value={conversation.id} />
            <textarea
              name="message"
              rows={3}
              maxLength={2000}
              required
              placeholder="Écris ton message…"
              className="resize-none min-h-11 rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            <Bouton libelleEnCours="Envoi…" className="self-start">
              Envoyer
            </Bouton>
          </form>
        </Apparition>
      </div>
    </main>
  );
}
