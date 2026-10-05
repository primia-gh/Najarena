import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { envoyerMessage } from "@/lib/messagerie-actions";
import { formaterDate } from "@/lib/tournois";
import { classeChamp } from "@/lib/design";
import Alerte from "@/components/design/Alerte";
import Apparition from "@/components/design/Apparition";
import AvatarJoueur from "@/components/design/AvatarJoueur";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import FondEcailles from "@/components/design/FondEcailles";
import Icone from "@/components/design/Icone";
import LibelleSection from "@/components/design/LibelleSection";

export const metadata: Metadata = {
  title: "Conversation — Najarena",
  robots: { index: false, follow: false },
};

interface ConversationPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string; message?: string }>;
}

export default async function ConversationPage({ params, searchParams }: ConversationPageProps) {
  const { id } = await params;
  const { erreur, message } = await searchParams;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select(
      "id, profile_a, profile_b, a:profiles!conversations_profile_a_fkey(pseudo, slug, avatar_url), b:profiles!conversations_profile_b_fkey(pseudo, slug, avatar_url)",
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
    .select("id, expediteur_id, contenu, envoye_le, lu_le, en_revue")
    .eq("conversation_id", id)
    .order("envoye_le", { ascending: true });

  const messages = messagesData ?? [];

  const idsAMarquer = messages
    .filter((m) => m.expediteur_id !== userData.user!.id && m.lu_le === null)
    .map((m) => m.id);
  if (idsAMarquer.length > 0) {
    await supabase.from("messages").update({ lu_le: new Date().toISOString() }).in("id", idsAMarquer);
  }

  // Revue visuelle du 05/10/2026 : en-tête à la taille d'un sous-titre
  // (le pseudo en 88 px écrasait la conversation), bulles distinctes — les
  // tiennes à droite sur fond clair, celles de l'autre à gauche avec son
  // avatar —, et la note de modération lisible.
  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-8 px-grille *:max-w-3xl">
        <Apparition className="flex flex-col gap-6 border-b border-line pb-8">
          <Link
            href="/moi/messages"
            className="inline-flex min-h-11 items-center gap-2 self-start font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
          >
            <Icone nom="fleche-gauche" taille={14} />
            Messages
          </Link>
          <div className="flex items-center gap-4">
            <AvatarJoueur pseudo={autre?.pseudo ?? "?"} src={autre?.avatar_url ?? null} taille={56} />
            <div className="flex min-w-0 flex-col gap-2">
              <LibelleSection>Conversation</LibelleSection>
              <h1 className="truncate font-titre text-4xl leading-none font-black uppercase">
                {autre?.pseudo ?? "Joueur inconnu"}
              </h1>
            </div>
            {autre?.slug && (
              <Link
                href={`/joueur/${autre.slug}`}
                className="ml-auto hidden shrink-0 text-sm text-muted underline underline-offset-3 hover:text-text sm:inline"
              >
                Voir son CV
              </Link>
            )}
          </div>
        </Apparition>

        {(erreur || message) && (
          <div className="flex flex-col gap-3">
            {erreur && <Alerte type="erreur">{erreur}</Alerte>}
            {message && <Alerte type="succes">{message}</Alerte>}
          </div>
        )}

        <Apparition delai={0.08}>
          {messages.length === 0 ? (
            <p className="text-text-2">Aucun message pour l&apos;instant.</p>
          ) : (
            <ol className="flex flex-col gap-4" aria-label={`Messages avec ${autre?.pseudo ?? "ce joueur"}`}>
              {messages.map((m) => {
                const estMoi = m.expediteur_id === userData.user!.id;
                return (
                  <li key={m.id} className={`flex items-end gap-3 ${estMoi ? "justify-end" : "justify-start"}`}>
                    {!estMoi && <AvatarJoueur pseudo={autre?.pseudo ?? "?"} src={autre?.avatar_url ?? null} taille={32} />}
                    <div
                      className={`max-w-[80%] rounded-panneau px-4 py-3 ${
                        estMoi ? "rounded-br-none bg-[#1d201d] text-text" : "rounded-bl-none border border-line-strong text-text"
                      }`}
                    >
                      <p className="whitespace-pre-line [overflow-wrap:anywhere]">{m.contenu}</p>
                      <p className="mt-2 text-xs text-muted tabular-nums">
                        <span className="sr-only">{estMoi ? "Toi" : (autre?.pseudo ?? "Joueur")}, </span>
                        {formaterDate(m.envoye_le)}
                      </p>
                      {/* Modération (audit N27) : remis après relecture. */}
                      {m.en_revue && (
                        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-text-2">
                          <Icone nom="horloge" taille={12} />
                          En attente de relecture : pas encore remis.
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Apparition>

        <Apparition delai={0.12}>
          <form action={envoyerMessage} className="flex flex-col gap-3 border-t border-line pt-6">
            <input type="hidden" name="conversation_id" value={conversation.id} />
            <label className="flex flex-col gap-1.5">
              <span className="font-texte text-mini font-medium text-muted uppercase">Ton message</span>
              <textarea
                name="message"
                rows={3}
                maxLength={2000}
                required
                placeholder="Écris ton message…"
                className={`${classeChamp()} resize-none`}
              />
            </label>
            <BoutonEnvoi libelleEnCours="Envoi…" className="self-start">
              Envoyer
            </BoutonEnvoi>
          </form>
        </Apparition>
      </div>
    </main>
  );
}
