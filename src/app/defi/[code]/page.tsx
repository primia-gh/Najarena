import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { accepterInvitationDefi } from "@/lib/defi-actions";
import { etatDefi } from "@/lib/defis";
import { reglePartie1v1 } from "@/lib/reglement";
import { formaterDate } from "@/lib/tournois";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";
import Panneau from "@/components/design/Panneau";
import LibelleSection from "@/components/design/LibelleSection";
import BoutonLien from "@/components/design/BoutonLien";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";

// « Invite ton rival » (28/09/2026, audit N18) : la page du lien de défi
// envoyé à un ami. Pas encore inscrit, il crée son compte et lie son Riot
// ID, puis revient ici (paramètre « suite ») et relève le défi : le duel
// s'ouvre aussitôt. Page non indexée.

interface DefiPageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ erreur?: string }>;
}

const chargerInvitation = cache(async (code: string) => {
  const supabase = await createClient();
  const [{ data: invitation }, { data: userData }] = await Promise.all([
    supabase.rpc("lire_invitation_defi", { p_code: code }).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  if (!invitation) return null;

  const { data: compte } = userData.user
    ? await supabase
        .from("game_accounts")
        .select("region, verifie_le")
        .eq("profile_id", userData.user.id)
        .eq("game_id", 1)
        .eq("est_principal", true)
        .maybeSingle()
    : { data: null };
  const { data: moi } = userData.user
    ? await supabase.from("profiles").select("slug").eq("id", userData.user.id).maybeSingle()
    : { data: null };

  return { invitation, connecte: Boolean(userData.user), compte, monSlug: moi?.slug ?? null };
});

export async function generateMetadata({ params }: DefiPageProps): Promise<Metadata> {
  const { code } = await params;
  const donnees = await chargerInvitation(code);
  return {
    title: donnees ? `${donnees.invitation.lanceur_pseudo} te défie — Najarena` : "Défi introuvable — Najarena",
    description: "Un duel en 1v1 sur League of Legends, résultat lu dans la donnée officielle Riot.",
    robots: { index: false, follow: false },
  };
}

export default async function DefiPage({ params, searchParams }: DefiPageProps) {
  const { code } = await params;
  const { erreur } = await searchParams;
  const donnees = await chargerInvitation(code);
  if (!donnees) notFound();

  const { invitation: inv, connecte, compte, monSlug } = donnees;
  const ici = `/defi/${encodeURIComponent(code)}`;
  const etat = etatDefiAffiche(inv.statut, inv.expire_le);
  const condition = inv.condition_victoire === "classique" ? "classique" : "nexus";
  const estLeLanceur = monSlug === inv.lanceur_slug;
  const compteOk = Boolean(compte?.verifie_le) && compte?.region === inv.region;

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative px-grille *:max-w-xl">
        <Apparition>
          <LibelleSection>Défi en 1v1</LibelleSection>
          <h1 className="mt-2 font-titre text-section font-black tracking-[1px] uppercase [overflow-wrap:anywhere]">
            <Link href={`/joueur/${inv.lanceur_slug}`} className="text-accent hover:underline">
              {inv.lanceur_pseudo}
            </Link>{" "}
            te défie
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-text-2">
            Une partie de League of Legends, en 1v1, sur {inv.region ?? "son serveur"}. Le résultat est lu
            automatiquement dans la donnée officielle Riot : pas de capture d&apos;écran, pas de parole contre
            parole. S&apos;il est retrouvé chez Riot, le duel compte à votre classement Najarena.
          </p>

          {erreur && (
            <p role="alert" className="mt-6 rounded-bouton border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger">
              {erreur}
            </p>
          )}

          <Panneau className="mt-6 flex flex-col gap-4 p-6">
            <p className="text-sm leading-relaxed text-text-2">{reglePartie1v1(condition)}</p>

            {etat === "accepte" ? (
              <>
                <p className="text-sm text-text">Ce défi a déjà été relevé.</p>
                {inv.tournoi_slug && (
                  <BoutonLien href={`/lol/tournois/${inv.tournoi_slug}`} variante="contour" className="self-start">
                    Voir le duel
                  </BoutonLien>
                )}
              </>
            ) : etat !== "en_attente" ? (
              <p className="text-sm text-muted">
                {etat === "expire" ? "Ce lien de défi a expiré." : "Ce défi n'est plus ouvert."} Demande à{" "}
                {inv.lanceur_pseudo} de t&apos;en envoyer un nouveau.
              </p>
            ) : estLeLanceur ? (
              <p className="text-sm text-muted">
                C&apos;est ton lien : envoie-le à ton rival. Il est valable jusqu&apos;au {formaterDate(inv.expire_le)}.
              </p>
            ) : !connecte ? (
              <>
                <p className="text-sm text-text-2">
                  Pour relever le défi : crée ton compte (une minute), lie ton Riot ID, et le duel est prêt.
                </p>
                <div className="flex flex-wrap gap-3">
                  <BoutonLien href={`/inscription?suite=${encodeURIComponent(ici)}`}>Créer mon compte</BoutonLien>
                  <BoutonLien href={`/connexion?suite=${encodeURIComponent(ici)}`} variante="contour">
                    J&apos;ai déjà un compte
                  </BoutonLien>
                </div>
              </>
            ) : !compteOk ? (
              <>
                <p className="text-sm text-text-2">
                  {compte?.verifie_le
                    ? `Ce duel se joue sur ${inv.region} : ton compte Riot vérifié est sur ${compte.region}.`
                    : `Dernière étape : lie et vérifie ton compte Riot${inv.region ? ` (région ${inv.region})` : ""}. Tu reviendras ici ensuite.`}
                </p>
                {!compte?.verifie_le && (
                  <BoutonLien href={`/lier-riot?suite=${encodeURIComponent(ici)}`} className="self-start">
                    Lier mon compte Riot
                  </BoutonLien>
                )}
              </>
            ) : (
              <form action={accepterInvitationDefi} className="flex flex-col gap-3">
                <input type="hidden" name="code" value={code} />
                <p className="text-sm text-text-2">
                  Le duel s&apos;ouvre dès que tu le relèves : déclarez-vous prêts dans la salle de match, puis jouez.
                </p>
                <BoutonEnvoi libelleEnCours="Ouverture du duel…" className="self-start">
                  Relever le défi
                </BoutonEnvoi>
              </form>
            )}
          </Panneau>

          <p className="mt-6 text-xs text-muted">
            Lien valable jusqu&apos;au {formaterDate(inv.expire_le)} ·{" "}
            <Link href="/comment-ca-marche" className="underline underline-offset-3 hover:text-text">
              Comment ça marche
            </Link>
          </p>
        </Apparition>
      </div>
    </main>
  );
}

// Hors du composant : l'heure courante n'a pas sa place dans le rendu
// (règle « purity » du compilateur React).
function etatDefiAffiche(statut: string, expireLe: string) {
  return etatDefi(statut, expireLe, new Date());
}
