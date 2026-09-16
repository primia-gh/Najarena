import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { envoyerMessage } from "@/lib/messagerie-actions";
import { formaterDate } from "@/lib/tournois";
import { classeCarte } from "@/lib/ui";
import Bouton from "@/components/ui/Bouton";
import FondArene from "@/components/accueil/FondArene";
import BracketBackground from "@/components/BracketBackground";
import Reveal from "@/components/accueil/Reveal";

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
    <main className="relative min-h-screen overflow-hidden pt-28 pb-16">
      <FondArene />
      <BracketBackground />
      <div className="relative mx-auto max-w-2xl px-6">
        <Reveal>
          <Link
            href="/moi/messages"
            className="font-mono text-[0.66rem] tracking-[0.18em] text-ardoise uppercase hover:text-encre"
          >
            ← Messages
          </Link>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-encre">
            {autre?.pseudo ?? "Joueur inconnu"}
          </h1>
        </Reveal>

        {erreur && (
          <p className={"mt-4 " + classeCarte("sceau") + " text-sm text-sceau-texte"}>{erreur}</p>
        )}

        <Reveal delai={0.1}>
          <div className="mt-6 flex flex-col gap-3">
            {messages.map((m) => {
              const estMoi = m.expediteur_id === userData.user!.id;
              return (
                <div
                  key={m.id}
                  className={`max-w-[80%] rounded-[3px] border border-trait px-3 py-2 text-sm ${
                    estMoi ? "self-end bg-carte text-encre" : "self-start bg-papier text-encre"
                  }`}
                >
                  <p>{m.contenu}</p>
                  <span className="mt-1 block font-mono text-[0.62rem] text-ardoise">
                    {formaterDate(m.envoye_le)}
                  </span>
                </div>
              );
            })}
          </div>
        </Reveal>

        <Reveal delai={0.15}>
          <form action={envoyerMessage} className="mt-6 flex flex-col gap-2">
            <input type="hidden" name="conversation_id" value={conversation.id} />
            <textarea
              name="message"
              rows={3}
              maxLength={2000}
              required
              placeholder="Écris ton message…"
              className="resize-none rounded-[3px] border border-trait bg-papier px-3 py-2 text-sm text-encre outline-none focus:border-encre focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sceau"
            />
            <Bouton libelleEnCours="Envoi…" className="self-start">
              Envoyer
            </Bouton>
          </form>
        </Reveal>
      </div>
    </main>
  );
}
