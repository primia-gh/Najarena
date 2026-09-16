import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { inviterMembre, retirerMembre, refuserInvitation, mettreAJourEquipe } from "@/lib/equipe-actions";
import { TAILLE_MAX_EQUIPE } from "@/lib/equipe";
import { chargerOffre, ORDRE_OFFRE } from "@/lib/offres";
import { classeCarte } from "@/lib/ui";
import Bouton from "@/components/ui/Bouton";
import SectionTitre from "@/components/ui/SectionTitre";
import BoutonConfirmation from "@/components/ui/BoutonConfirmation";
import EtatVide from "@/components/ui/EtatVide";
import IllustrationEffectifVide from "@/components/ui/IllustrationEffectifVide";
import UploadLogo from "@/components/ui/UploadLogo";
import FondArene from "@/components/accueil/FondArene";
import BracketBackground from "@/components/BracketBackground";
import Reveal from "@/components/accueil/Reveal";

interface EquipePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ erreur?: string; message?: string }>;
}

async function chargerEquipe(slug: string) {
  const supabase = await createClient();

  const { data: equipe, error } = await supabase
    .from("teams")
    .select(
      "id, slug, nom, tag, capitaine_id, cree_le, game_id, description, contact_recrutement, logo_url, couleur_accent",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return { statut: "erreur" as const };
  }
  if (!equipe) {
    return { statut: "introuvable" as const };
  }

  // Quatre requêtes indépendantes entre elles, ne dépendant que de l'équipe
  // déjà chargée — lancées en parallèle plutôt qu'en série (correctif du
  // 13/09/2026, même logique que sur l'accueil).
  const [{ data: userData }, { data: jeu }, { data: capitaine }, { data: membresData }, infoOffreCapitaine] =
    await Promise.all([
      supabase.auth.getUser(),
      supabase.from("games").select("nom").eq("id", equipe.game_id).maybeSingle(),
      supabase.from("profiles").select("pseudo, slug").eq("id", equipe.capitaine_id).maybeSingle(),
      // Un membre invité mais pas encore accepté n'apparaît pas publiquement —
      // on n'affiche jamais une affiliation qu'un joueur n'a pas confirmée.
      supabase
        .from("team_members")
        .select("profile_id, role, accepte_le, profile:profiles(pseudo, slug)")
        .eq("team_id", equipe.id),
      chargerOffre(supabase, equipe.capitaine_id),
    ]);

  const peutBranding = ORDRE_OFFRE[infoOffreCapitaine.offre] >= ORDRE_OFFRE.verifie;

  const tousLesMembres = membresData ?? [];
  const membres = tousLesMembres.filter(
    (m) => m.accepte_le !== null && m.profile_id !== equipe.capitaine_id,
  );
  const invitesEnAttente = tousLesMembres.filter((m) => m.accepte_le === null);

  const estCapitaine = userData.user?.id === equipe.capitaine_id;
  const monAffiliation = userData.user
    ? tousLesMembres.find((m) => m.profile_id === userData.user!.id)
    : undefined;

  return {
    statut: "ok" as const,
    equipe,
    jeu,
    capitaine,
    membres,
    invitesEnAttente: estCapitaine ? invitesEnAttente : [],
    estCapitaine,
    peutQuitter: Boolean(monAffiliation?.accepte_le) && !estCapitaine,
    peutBranding,
  };
}

export async function generateMetadata({ params }: EquipePageProps): Promise<Metadata> {
  const { slug } = await params;
  const donnees = await chargerEquipe(slug);

  if (donnees.statut !== "ok") {
    return { title: "Équipe introuvable — Najarena" };
  }

  return {
    title: `${donnees.equipe.tag} ${donnees.equipe.nom} — Najarena`,
    description: `Page publique de l'équipe ${donnees.equipe.nom} sur Najarena.`,
  };
}

export default async function EquipePage({ params, searchParams }: EquipePageProps) {
  const { slug } = await params;
  const { erreur, message } = await searchParams;
  const donnees = await chargerEquipe(slug);

  if (donnees.statut === "introuvable") {
    notFound();
  }

  if (donnees.statut === "erreur") {
    return (
      <main className="mx-auto max-w-3xl px-6 pt-28 pb-16">
        <p className="rounded-[3px] border border-sceau/30 bg-sceau/10 p-6 text-sm text-sceau-texte">
          Impossible de charger cette équipe pour l&apos;instant. Réessaie
          dans un instant.
        </p>
      </main>
    );
  }

  const { equipe, jeu, capitaine, membres, invitesEnAttente, estCapitaine, peutQuitter, peutBranding } = donnees;

  return (
    <main className="relative min-h-screen overflow-hidden pt-28 pb-16">
      <FondArene />
      <BracketBackground />
      <div className="relative mx-auto max-w-3xl px-6">
      {erreur && (
        <p className={"mt-4 " + classeCarte("sceau") + " text-sm text-sceau-texte"}>{erreur}</p>
      )}

      {message && (
        <p className={"mt-4 " + classeCarte("atteste") + " text-sm text-atteste"}>{message}</p>
      )}

      <Reveal>
      <div className="flex items-center gap-3">
        {equipe.logo_url ? (
          <Image
            src={equipe.logo_url}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 rounded-[3px] border border-trait object-cover"
            unoptimized
          />
        ) : (
          <span
            className="rounded-[3px] px-2 py-1 font-mono text-sm font-bold text-papier"
            style={{ background: equipe.couleur_accent ?? "var(--color-laiton)" }}
          >
            {equipe.tag}
          </span>
        )}
        <h1
          className="font-display text-4xl font-extrabold tracking-tight"
          style={{ color: equipe.couleur_accent ?? "var(--color-encre)" }}
        >
          {equipe.nom}
        </h1>
      </div>

      {jeu?.nom && (
        <div className="mt-1 font-mono text-[0.72rem] tracking-[0.14em] text-ardoise uppercase">
          {jeu.nom}
        </div>
      )}
      <div className="mt-1 font-mono text-[0.72rem] text-laiton">
        {membres.length + 1}/{TAILLE_MAX_EQUIPE} joueurs
      </div>

      {equipe.description && (
        <p className="mt-3 max-w-md text-sm text-encre">{equipe.description}</p>
      )}
      {equipe.contact_recrutement && (
        <p className="mt-1 text-sm text-ardoise">
          Recrutement : <span className="text-encre">{equipe.contact_recrutement}</span>
        </p>
      )}

      {capitaine && (
        <div className="mt-3 font-mono text-[0.78rem] text-ardoise">
          Capitaine :{" "}
          <Link href={`/joueur/${capitaine.slug}`} className="text-encre hover:underline">
            {capitaine.pseudo}
          </Link>
        </div>
      )}
      </Reveal>

      <Reveal delai={0.1}>
      <section className="mt-10">
        <SectionTitre>Membres</SectionTitre>
        {membres.length === 0 ? (
          <div className="mt-3">
            <EtatVide illustration={<IllustrationEffectifVide />}>
              Aucun autre membre pour l&apos;instant.
            </EtatVide>
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {membres.map((m) => (
              <li key={m.profile_id} className={"flex items-center justify-between " + classeCarte("none")}>
                <span className="text-sm font-medium text-encre">
                  {m.profile ? (
                    <Link href={`/joueur/${m.profile.slug}`} className="hover:underline">
                      {m.profile.pseudo}
                    </Link>
                  ) : (
                    "Joueur inconnu"
                  )}
                </span>
                <div className="flex items-center gap-3">
                  {m.role && (
                    <span className="font-mono text-[0.66rem] text-ardoise uppercase">
                      {m.role}
                    </span>
                  )}
                  {estCapitaine && (
                    <form action={retirerMembre}>
                      <input type="hidden" name="team_id" value={equipe.id} />
                      <input type="hidden" name="profile_id" value={m.profile_id} />
                      <input type="hidden" name="slug" value={equipe.slug} />
                      <BoutonConfirmation
                        type="submit"
                        confirmation={`Retirer ${m.profile?.pseudo ?? "ce joueur"} de l'équipe ?`}
                        aria-label={`Retirer ${m.profile?.pseudo ?? "ce membre"} de l'équipe`}
                        className="font-mono text-[0.64rem] text-sceau-texte underline underline-offset-3"
                      >
                        Retirer
                      </BoutonConfirmation>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {peutQuitter && (
          <form action={refuserInvitation} className="mt-3">
            <input type="hidden" name="team_id" value={equipe.id} />
            <BoutonConfirmation
              type="submit"
              confirmation="Quitter cette équipe ? Il faudra une nouvelle invitation pour la rejoindre à nouveau."
              className="font-mono text-[0.66rem] text-sceau-texte underline underline-offset-3"
            >
              Quitter l&apos;équipe
            </BoutonConfirmation>
          </form>
        )}
      </section>
      </Reveal>

      {estCapitaine && (
        <>
        <Reveal delai={0.12}>
        <section className="mt-10">
          <SectionTitre>Vitrine &amp; recrutement</SectionTitre>
          <form action={mettreAJourEquipe} className="mt-3 flex flex-col gap-3">
            <input type="hidden" name="team_id" value={equipe.id} />
            <input type="hidden" name="slug" value={equipe.slug} />
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[0.62rem] tracking-[0.14em] text-ardoise uppercase">
                Description (500 caractères max)
              </span>
              <textarea
                name="description"
                rows={3}
                maxLength={500}
                defaultValue={equipe.description ?? ""}
                placeholder="Présente ton équipe, ton ambition, ce que tu cherches"
                className="resize-none rounded-[3px] border border-trait bg-papier px-3 py-2 text-sm text-encre outline-none focus:border-encre focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sceau"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[0.62rem] tracking-[0.14em] text-ardoise uppercase">
                Contact recrutement
              </span>
              <input
                name="contact_recrutement"
                type="text"
                defaultValue={equipe.contact_recrutement ?? ""}
                placeholder="Discord, e-mail…"
                className="rounded-[3px] border border-trait bg-papier px-3 py-2 text-sm text-encre outline-none focus:border-encre focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sceau"
              />
            </label>

            {peutBranding ? (
              <>
                <UploadLogo type="equipe" id={equipe.id} logoActuel={equipe.logo_url} nomChamp="logo_url" />
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-[0.62rem] tracking-[0.14em] text-ardoise uppercase">
                    Couleur d&apos;accent
                  </span>
                  <input
                    name="couleur_accent"
                    type="color"
                    defaultValue={equipe.couleur_accent ?? "#D2A257"}
                    className="h-9 w-16 rounded-[3px] border border-trait bg-papier"
                  />
                </label>
              </>
            ) : (
              <p className="text-[0.78rem] text-ardoise">
                Logo et couleur d&apos;accent demandent l&apos;offre Vérifié ou plus.
              </p>
            )}

            <Bouton libelleEnCours="Enregistrement…" className="self-start">
              Enregistrer
            </Bouton>
          </form>
        </section>
        </Reveal>

        <Reveal delai={0.15}>
        <section className="mt-10">
          <SectionTitre>Gérer l&apos;équipe</SectionTitre>

          <form action={inviterMembre} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input type="hidden" name="team_id" value={equipe.id} />
            <input type="hidden" name="slug" value={equipe.slug} />
            <label className="flex-1">
              <span className="sr-only">Pseudo du joueur à inviter</span>
              <input
                name="pseudo"
                type="text"
                required
                placeholder="Pseudo du joueur à inviter"
                className="w-full rounded-[3px] border border-trait bg-papier px-3 py-2 text-sm text-encre outline-none focus:border-encre focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sceau"
              />
            </label>
            <Bouton libelleEnCours="Invitation…">Inviter</Bouton>
          </form>

          {invitesEnAttente.length > 0 && (
            <div className="mt-4">
              <h3 className="font-mono text-[0.64rem] tracking-[0.14em] text-ardoise uppercase">
                Invitations en attente
              </h3>
              <ul className="mt-2 flex flex-col gap-2">
                {invitesEnAttente.map((m) => (
                  <li key={m.profile_id} className={"flex items-center justify-between " + classeCarte("none")}>
                    <span className="text-sm text-ardoise">
                      {m.profile?.pseudo ?? "Joueur inconnu"}
                    </span>
                    <form action={retirerMembre}>
                      <input type="hidden" name="team_id" value={equipe.id} />
                      <input type="hidden" name="profile_id" value={m.profile_id} />
                      <input type="hidden" name="slug" value={equipe.slug} />
                      <button
                        type="submit"
                        aria-label={`Annuler l'invitation de ${m.profile?.pseudo ?? "ce joueur"}`}
                        className="font-mono text-[0.64rem] text-sceau-texte underline underline-offset-3"
                      >
                        Annuler
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
        </Reveal>
        </>
      )}
      </div>
    </main>
  );
}
