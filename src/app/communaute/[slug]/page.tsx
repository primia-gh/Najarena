import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { arrondir, trouverPalier } from "@/lib/classement";
import { COULEUR_PALIER } from "@/lib/paliers";
import { formaterDate, LABEL_STATUT, type StatutPublic } from "@/lib/tournois";
import {
  classementInterne,
  DUREE_CODE_LIAISON_MINUTES,
  LIBELLE_ROLE_COMMUNAUTE,
  roleCommunaute,
} from "@/lib/communautes";
import {
  delierServeurDiscord,
  modifierCommunaute,
  nommerAdminCommunaute,
  obtenirCodeLiaisonDiscord,
  quitterCommunaute,
  rejoindreCommunaute,
  retirerMembreCommunaute,
} from "@/lib/communaute-actions";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import BoutonLien from "@/components/design/BoutonLien";
import LibelleSection from "@/components/design/LibelleSection";
import Panneau from "@/components/design/Panneau";
import Tableau from "@/components/design/Tableau";
import BoutonConfirmation from "@/components/ui/BoutonConfirmation";

// Espace communauté (03/10/2026, audit N30) : la page d'un serveur Discord
// ou d'une association — ses tournois, le classement interne de ses membres
// (leur rating officiel, jamais un rating à part) et ses membres.

const CHAMP =
  "min-h-11 w-full rounded-bouton border border-line-strong bg-bg px-3 py-2.5 font-texte text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const LIEN_ACTION = "inline-flex min-h-11 items-center text-mini font-semibold uppercase underline underline-offset-3";

const chargerCommunaute = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data: communaute } = await supabase
    .from("communautes")
    .select("id, slug, nom, description, couleur, lien_discord, discord_guild_id, proprietaire_id, cree_le")
    .eq("slug", slug)
    .maybeSingle();
  if (!communaute) return null;

  const [{ data: userData }, { data: membresData }, { data: tournoisData }, { data: saison }, { data: paliersData }] =
    await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("membres_communaute")
        .select("profile_id, role, rejoint_le, profile:profiles(pseudo, slug, supprime_le)")
        .eq("communaute_id", communaute.id)
        .order("rejoint_le", { ascending: true })
        .limit(500),
      supabase
        .from("tournaments")
        .select("slug, nom, statut, debute_le, format, capacite, region")
        .eq("communaute_id", communaute.id)
        .eq("nature", "tournoi")
        .neq("statut", "brouillon")
        .order("debute_le", { ascending: false })
        .limit(20),
      supabase.from("seasons").select("id").eq("game_id", 1).eq("est_courante", true).maybeSingle(),
      supabase.from("tiers").select("nom, rating_min").eq("game_id", 1),
    ]);

  const membres = (membresData ?? []).flatMap((m) =>
    m.profile && !m.profile.supprime_le
      ? [
          {
            profileId: m.profile_id,
            role: roleCommunaute(m.role) ?? "membre",
            pseudo: m.profile.pseudo,
            slug: m.profile.slug,
          },
        ]
      : [],
  );
  const { data: ratingsData } =
    saison && membres.length > 0
      ? await supabase
          .from("ratings")
          .select("profile_id, rating, est_classe")
          .eq("game_id", 1)
          .eq("season_id", saison.id)
          .in(
            "profile_id",
            membres.map((m) => m.profileId),
          )
      : { data: [] };

  return {
    communaute,
    moi: userData.user?.id ?? null,
    membres,
    tournois: tournoisData ?? [],
    ratings: new Map(
      (ratingsData ?? []).map((r) => [r.profile_id, { rating: Number(r.rating), estClasse: Boolean(r.est_classe) }]),
    ),
    paliers: (paliersData ?? []).map((p) => ({ nom: p.nom, ratingMin: p.rating_min })),
  };
});

interface CommunautePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ erreur?: string; message?: string; code?: string }>;
}

export async function generateMetadata({ params }: CommunautePageProps): Promise<Metadata> {
  const { slug } = await params;
  const donnees = await chargerCommunaute(slug);
  if (!donnees) return { title: "Communauté introuvable — Najarena" };
  const { communaute, membres } = donnees;
  return {
    title: `${communaute.nom} — Communauté Najarena`,
    description:
      communaute.description?.slice(0, 160) ??
      `${communaute.nom} sur Najarena : ${membres.length} membre${membres.length > 1 ? "s" : ""}, tournois League of Legends et classement interne vérifié.`,
    alternates: { canonical: `/communaute/${communaute.slug}` },
  };
}

export default async function CommunautePage({ params, searchParams }: CommunautePageProps) {
  const { slug } = await params;
  const { erreur, message, code } = await searchParams;
  const donnees = await chargerCommunaute(slug);
  if (!donnees) notFound();
  const { communaute, moi, membres, tournois, ratings, paliers } = donnees;

  const monRole = moi ? (membres.find((m) => m.profileId === moi)?.role ?? null) : null;
  const gere = monRole === "proprietaire" || monRole === "admin";
  const { classes, nonClasses } = classementInterne(membres, ratings);
  const enCours = tournois.filter((t) => t.statut === "ouvert" || t.statut === "checkin" || t.statut === "en_cours");
  const passes = tournois.filter((t) => t.statut === "termine" || t.statut === "annule");
  const champsCommunaute = (
    <>
      <input type="hidden" name="communaute_id" value={communaute.id} />
      <input type="hidden" name="slug" value={communaute.slug} />
    </>
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-12 px-grille">
        <Apparition>
          <Link
            href="/communautes"
            className="inline-flex min-h-11 items-center font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
          >
            ← Communautés
          </Link>
          <div className="mt-6 border-l-4 pl-5" style={{ borderColor: communaute.couleur }}>
            <p className="text-mini text-muted uppercase">Communauté</p>
            <h1 className="font-titre text-section font-black tracking-[1px] uppercase hyphens-auto [overflow-wrap:anywhere]">
              {communaute.nom}
            </h1>
            {communaute.description && (
              <p className="mt-3 max-w-2xl text-courant whitespace-pre-line text-text-2">{communaute.description}</p>
            )}
            <p className="mt-3 text-sm text-muted tabular-nums">
              {membres.length} membre{membres.length > 1 ? "s" : ""} · {tournois.length} tournoi
              {tournois.length > 1 ? "s" : ""}
              {communaute.discord_guild_id ? " · serveur Discord lié" : ""}
            </p>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            {!moi ? (
              <BoutonLien href={`/connexion?suite=${encodeURIComponent(`/communaute/${communaute.slug}`)}`}>
                Rejoindre
              </BoutonLien>
            ) : !monRole ? (
              <form action={rejoindreCommunaute}>
                {champsCommunaute}
                <BoutonEnvoi libelleEnCours="Entrée…">Rejoindre</BoutonEnvoi>
              </form>
            ) : monRole !== "proprietaire" ? (
              <form action={quitterCommunaute}>
                {champsCommunaute}
                <BoutonEnvoi variante="contour" libelleEnCours="Sortie…">
                  Quitter
                </BoutonEnvoi>
              </form>
            ) : null}
            {gere && (
              <BoutonLien
                href={`/organiser/nouveau?communaute=${encodeURIComponent(communaute.slug)}`}
                variante="contour"
              >
                Organiser un tournoi
              </BoutonLien>
            )}
            {communaute.lien_discord && (
              <a
                href={communaute.lien_discord}
                target="_blank"
                rel="nofollow ugc noopener noreferrer"
                className={`${LIEN_ACTION} text-accent`}
              >
                Rejoindre le serveur Discord
              </a>
            )}
          </div>
        </Apparition>

        {erreur && (
          <p role="alert" className="rounded-bouton border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {erreur}
          </p>
        )}
        {message && (
          <p
            role="status"
            className="rounded-bouton border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent"
          >
            {message}
          </p>
        )}

        <section className="flex flex-col gap-4">
          <LibelleSection as="h2">Tournois</LibelleSection>
          {tournois.length === 0 ? (
            <Panneau className="p-6">
              <p className="text-sm text-muted">
                Aucun tournoi publié dans la communauté pour l&apos;instant.
                {gere ? " Organise le premier : il apparaîtra ici et sur la liste des tournois." : ""}
              </p>
            </Panneau>
          ) : (
            <ul className="flex flex-col gap-2">
              {[...[...enCours].reverse(), ...passes].map((t) => (
                <li key={t.slug}>
                  <Panneau className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <Link href={`/lol/tournois/${t.slug}`} className="font-semibold hover:text-accent">
                      {t.nom}
                    </Link>
                    <span className="text-sm text-muted tabular-nums">
                      {t.format} · {t.capacite} places · {t.region} · {formaterDate(t.debute_le)} ·{" "}
                      <span className={t.statut === "termine" || t.statut === "annule" ? "" : "text-accent"}>
                        {LABEL_STATUT[t.statut as StatutPublic] ?? t.statut}
                      </span>
                    </span>
                  </Panneau>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <LibelleSection as="h2">Classement interne</LibelleSection>
          <p className="max-w-2xl text-sm text-muted">
            Le rating officiel Najarena des membres, saison en cours — gagné dans tous les tournois classés, pas
            seulement ceux de la communauté. Un joueur apparaît une fois classé (une dizaine de matchs vérifiés).
          </p>
          {classes.length === 0 ? (
            <Panneau className="p-6">
              <p className="text-sm text-muted">Aucun membre classé pour l&apos;instant.</p>
            </Panneau>
          ) : (
            <Tableau legende={`Classement interne — ${communaute.nom}`}>
              <thead>
                <tr>
                  <th scope="col">Rang</th>
                  <th scope="col">Joueur</th>
                  <th scope="col">Palier</th>
                  <th scope="col">Rating</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((m, i) => {
                  const palier = trouverPalier(m.rating, paliers);
                  return (
                    <tr key={m.profileId}>
                      <td className="tabular-nums">#{i + 1}</td>
                      <td>
                        <Link href={`/joueur/${m.slug}`} className="hover:text-accent">
                          {m.pseudo}
                        </Link>
                      </td>
                      <td style={{ color: palier ? COULEUR_PALIER[palier.nom.toLowerCase()] : undefined }}>
                        {palier?.nom ?? "—"}
                      </td>
                      <td className="tabular-nums">{arrondir(m.rating)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Tableau>
          )}
          {nonClasses > 0 && (
            <p className="text-xs text-muted tabular-nums">
              {nonClasses} membre{nonClasses > 1 ? "s" : ""} pas encore classé{nonClasses > 1 ? "s" : ""}.
            </p>
          )}
        </section>

        <section id="membres" className="flex scroll-mt-28 flex-col gap-4">
          <LibelleSection as="h2">Membres</LibelleSection>
          <ul className="flex flex-wrap gap-2">
            {membres.map((m) => (
              <li key={m.profileId}>
                <Panneau className="flex flex-wrap items-center gap-3 px-4 py-2">
                  <Link href={`/joueur/${m.slug}`} className="text-sm font-semibold hover:text-accent">
                    {m.pseudo}
                  </Link>
                  {m.role !== "membre" && (
                    <span className="text-mini text-muted uppercase">{LIBELLE_ROLE_COMMUNAUTE[m.role]}</span>
                  )}
                  {monRole === "proprietaire" && m.role !== "proprietaire" && (
                    <form action={nommerAdminCommunaute}>
                      {champsCommunaute}
                      <input type="hidden" name="profile_id" value={m.profileId} />
                      <input type="hidden" name="admin" value={m.role === "admin" ? "non" : "oui"} />
                      <button type="submit" className={`${LIEN_ACTION} text-muted hover:text-text`}>
                        {m.role === "admin" ? "Retirer admin" : "Nommer admin"}
                      </button>
                    </form>
                  )}
                  {gere &&
                    m.role !== "proprietaire" &&
                    m.profileId !== moi &&
                    (monRole === "proprietaire" || m.role === "membre") && (
                      <form action={retirerMembreCommunaute}>
                        {champsCommunaute}
                        <input type="hidden" name="profile_id" value={m.profileId} />
                        <BoutonConfirmation
                          confirmation={`Retirer ${m.pseudo} de la communauté ?`}
                          className={`${LIEN_ACTION} text-danger`}
                        >
                          Retirer
                        </BoutonConfirmation>
                      </form>
                    )}
                </Panneau>
              </li>
            ))}
          </ul>
        </section>

        {gere && (
          <section id="gestion" className="flex scroll-mt-28 flex-col gap-4 *:max-w-xl">
            <LibelleSection as="h2">Gestion</LibelleSection>
            <form action={modifierCommunaute} className="flex flex-col gap-4">
              {champsCommunaute}
              <label className="flex flex-col gap-1">
                <span className="text-mini text-muted uppercase">Description (publique)</span>
                <textarea
                  name="description"
                  rows={3}
                  maxLength={500}
                  defaultValue={communaute.description ?? ""}
                  className={`${CHAMP} resize-y`}
                />
              </label>
              <div className="flex flex-wrap gap-4">
                <label className="flex flex-col gap-1">
                  <span className="text-mini text-muted uppercase">Couleur</span>
                  <input
                    type="color"
                    name="couleur"
                    defaultValue={communaute.couleur}
                    className="h-11 w-20 rounded-bouton border border-line-strong bg-bg"
                  />
                </label>
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-mini text-muted uppercase">Invitation Discord</span>
                  <input
                    type="url"
                    name="lien_discord"
                    defaultValue={communaute.lien_discord ?? ""}
                    placeholder="https://discord.gg/…"
                    className={CHAMP}
                  />
                </label>
              </div>
              <BoutonEnvoi libelleEnCours="Enregistrement…" className="self-start">
                Enregistrer
              </BoutonEnvoi>
            </form>

            {monRole === "proprietaire" && (
              <Panneau className="flex flex-col gap-3 p-5">
                <p className="text-mini text-muted uppercase">Serveur Discord</p>
                {communaute.discord_guild_id ? (
                  <>
                    <p className="text-sm text-text-2">
                      Un serveur Discord est lié : la commande <code>/communaute</code> du bot y affiche cette page, vos
                      prochains tournois et le haut du classement interne.
                    </p>
                    <form action={delierServeurDiscord}>
                      {champsCommunaute}
                      <BoutonEnvoi variante="contour" libelleEnCours="…">
                        Délier le serveur
                      </BoutonEnvoi>
                    </form>
                  </>
                ) : code ? (
                  <p className="text-sm text-text-2">
                    Sur ton serveur Discord (le bot Najarena doit y être invité), un membre autorisé à gérer le serveur
                    tape <code className="font-semibold text-text">/lier code:{code}</code>. Code valable{" "}
                    {DUREE_CODE_LIAISON_MINUTES} minutes, une seule fois.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-text-2">
                      Lie ton serveur pour y utiliser <code>/communaute</code>, et <code>/organiser</code> pour préparer
                      un tournoi de la communauté depuis Discord. Seul un membre qui peut gérer le serveur le lie :
                      personne ne s&apos;approprie le serveur d&apos;un autre.
                    </p>
                    <form action={obtenirCodeLiaisonDiscord}>
                      {champsCommunaute}
                      <BoutonEnvoi variante="contour" libelleEnCours="…">
                        Obtenir un code de liaison
                      </BoutonEnvoi>
                    </form>
                  </>
                )}
              </Panneau>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
