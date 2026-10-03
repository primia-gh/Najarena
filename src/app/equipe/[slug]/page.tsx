import { cache } from "react";
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
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";
import { chargerEquipesCapitaine, chargerPalmaresEquipe, chargerScrimsEquipe } from "@/lib/equipes-tournoi";
import { formaterDate } from "@/lib/tournois";
import { annulerScrim, proposerScrim, repondreScrim } from "@/lib/scrim-actions";
import { etatScrim, LIBELLE_ETAT_SCRIM, resultatScrim } from "@/lib/scrims";
import { libelleEquipe, TAILLE_ALIGNEMENT } from "@/lib/cinq-contre-cinq";
import { ChoixAlignement } from "@/components/tournoi/FormulaireAlignement";

interface EquipePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ erreur?: string; message?: string }>;
}

// cache : generateMetadata et la page partagent un seul chargement par requête.
const chargerEquipe = cache(async (slug: string) => {
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
  const [{ data: userData }, { data: jeu }, { data: capitaine }, { data: membresData }, infoOffreCapitaine, palmares] =
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
      // Tournois 5v5 joués (audit N21) : seuls résultats d'équipe affichés.
      chargerPalmaresEquipe(supabase, equipe.id, equipe.capitaine_id),
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

  // Scrims (audit N22) : la liste publique, les propositions en attente
  // (lisibles des seuls capitaines concernés) et, pour un visiteur capitaine
  // d'une autre équipe, de quoi en proposer un.
  const [scrimsJoues, { data: propositionsData }, { data: compteVisiteur }] = await Promise.all([
    chargerScrimsEquipe(supabase, equipe.id, equipe.capitaine_id),
    estCapitaine
      ? supabase
          .from("scrims")
          .select(
            "id, prevu_le, best_of, statut, region, tournament_id, equipe_a_id, equipe_b_id, equipe_a:teams!scrims_equipe_a_id_fkey(nom, tag, slug), equipe_b:teams!scrims_equipe_b_id_fkey(nom, tag, slug)",
          )
          .or(`equipe_a_id.eq.${equipe.id},equipe_b_id.eq.${equipe.id}`)
          .in("statut", ["propose", "accepte"])
      : Promise.resolve({ data: [] }),
    userData.user
      ? supabase
          .from("game_accounts")
          .select("region, verifie_le")
          .eq("profile_id", userData.user.id)
          .eq("game_id", equipe.game_id)
          .eq("est_principal", true)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const regionVisiteur = compteVisiteur?.verifie_le ? compteVisiteur.region : null;
  const equipesVisiteur = userData.user
    ? await chargerEquipesCapitaine(supabase, userData.user.id, equipe.game_id, regionVisiteur)
    : [];
  const maintenant = new Date();
  const propositions = (propositionsData ?? []).filter((p) => p.statut === "propose" && new Date(p.prevu_le) > maintenant);
  const scrimParTournoi = new Map(
    (propositionsData ?? []).filter((p) => p.tournament_id).map((p) => [p.tournament_id as string, p.id]),
  );

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
    palmares,
    visiteurId: userData.user?.id ?? null,
    regionVisiteur,
    scrims: scrimsJoues.map((sc) => ({
      ...sc,
      etat: etatScrim({ statut: "accepte", prevuLe: sc.prevuLe, statutTournoi: sc.statutTournoi }, maintenant),
      resultat: sc.statutTournoi === "termine" ? resultatScrim(sc.estGagnant, sc.niveau) : null,
      scrimId: scrimParTournoi.get(sc.tournamentId) ?? null,
    })),
    propositionsRecues: propositions.filter((p) => p.equipe_b_id === equipe.id),
    propositionsEnvoyees: propositions.filter((p) => p.equipe_a_id === equipe.id),
    // Membres de cette équipe que son capitaine peut aligner (réponse à un scrim).
    membresAlignables: equipesVisiteur.find((e) => e.id === equipe.id)?.membres ?? [],
    // Autres équipes du visiteur, depuis lesquelles proposer un scrim.
    equipesPourProposer: equipesVisiteur.filter((e) => e.id !== equipe.id),
  };
});

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
      <main className="px-grille *:max-w-3xl pt-32 pb-24 font-texte text-text">
        <p className="rounded-[3px] border border-danger/30 bg-danger/10 p-6 text-sm text-danger">
          Impossible de charger cette équipe pour l&apos;instant. Réessaie
          dans un instant.
        </p>
      </main>
    );
  }

  const {
    equipe,
    jeu,
    capitaine,
    membres,
    invitesEnAttente,
    estCapitaine,
    peutQuitter,
    peutBranding,
    palmares,
    visiteurId,
    regionVisiteur,
    scrims,
    propositionsRecues,
    propositionsEnvoyees,
    membresAlignables,
    equipesPourProposer,
  } = donnees;
  const CHAMP_SCRIM =
    "min-h-11 rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative px-grille">
      {erreur && (
        <p className={"mt-4 " + classeCarte("sceau") + " text-sm text-danger"}>{erreur}</p>
      )}

      {message && (
        <p className={"mt-4 " + classeCarte("atteste") + " text-sm text-accent"}>{message}</p>
      )}

      <Apparition>
      <div className="flex items-center gap-3">
        {equipe.logo_url ? (
          <Image
            src={equipe.logo_url}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 rounded-[3px] border border-line object-cover"
            unoptimized
          />
        ) : (
          <span
            className="rounded-[3px] px-2 py-1 font-texte tabular-nums text-sm font-bold text-bg"
            style={{ background: equipe.couleur_accent ?? "#d2a257" }}
          >
            {equipe.tag}
          </span>
        )}
        <h1
          className="font-titre uppercase text-4xl font-extrabold tracking-tight"
          style={{ color: equipe.couleur_accent ?? "var(--color-text)" }}
        >
          {equipe.nom}
        </h1>
      </div>

      {jeu?.nom && (
        <div className="mt-1 font-texte tabular-nums text-[0.72rem] tracking-[0.14em] text-muted uppercase">
          {jeu.nom}
        </div>
      )}
      <div className="mt-1 font-texte tabular-nums text-[0.72rem] text-accent">
        {membres.length + 1}/{TAILLE_MAX_EQUIPE} joueurs
      </div>

      {equipe.description && (
        <p className="mt-3 max-w-md text-sm text-text">{equipe.description}</p>
      )}
      {equipe.contact_recrutement && (
        <p className="mt-1 text-sm text-muted">
          Recrutement : <span className="text-text">{equipe.contact_recrutement}</span>
        </p>
      )}

      {capitaine && (
        <div className="mt-3 font-texte tabular-nums text-[0.78rem] text-muted">
          Capitaine :{" "}
          <Link href={`/joueur/${capitaine.slug}`} className="text-text hover:underline">
            {capitaine.pseudo}
          </Link>
        </div>
      )}
      </Apparition>

      <Apparition delai={0.1}>
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
                <span className="text-sm font-medium text-text">
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
                    <span className="font-texte tabular-nums text-mini text-muted uppercase">
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
                        className="inline-flex min-h-11 items-center font-texte tabular-nums text-mini text-danger underline underline-offset-3"
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
              className="inline-flex min-h-11 items-center font-texte tabular-nums text-mini text-danger underline underline-offset-3"
            >
              Quitter l&apos;équipe
            </BoutonConfirmation>
          </form>
        )}
      </section>
      </Apparition>

      <Apparition delai={0.11}>
      <section className="mt-10">
        <SectionTitre>Palmarès</SectionTitre>
        {palmares.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Aucun tournoi 5v5 joué pour l&apos;instant.{" "}
            <Link href="/lol/tournois" className="text-text underline underline-offset-3 hover:text-accent">
              Voir les tournois
            </Link>
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {palmares.map((t) => (
              <li key={t.slug} className={"flex flex-wrap items-center justify-between gap-2 " + classeCarte("none")}>
                <span className="flex min-w-0 flex-col">
                  <Link href={`/lol/tournois/${t.slug}`} className="truncate text-sm font-medium text-text hover:underline">
                    {t.nom}
                  </Link>
                  <span className="text-xs text-muted tabular-nums">{formaterDate(t.debuteLe)}</span>
                </span>
                <span className="flex flex-col items-end">
                  <span
                    className={`font-texte text-mini uppercase ${t.libelle === "Vainqueur" ? "font-semibold text-accent" : "text-text-2"}`}
                  >
                    {t.libelle}
                  </span>
                  {t.victoiresVerifiees > 0 && (
                    <span className="text-xs text-muted tabular-nums">
                      {t.victoiresVerifiees} victoire{t.victoiresVerifiees > 1 ? "s" : ""} vérifiée
                      {t.victoiresVerifiees > 1 ? "s" : ""} chez Riot
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      </Apparition>

      <Apparition delai={0.115}>
      <section id="scrims" className="mt-10 scroll-mt-28">
        <SectionTitre>Scrims</SectionTitre>
        <p className="mt-2 max-w-lg text-sm text-muted">
          Matchs d&apos;entraînement entre équipes, lus dans la donnée Riot comme un match de tournoi : les dix
          joueurs inscrits doivent être dans la partie. Ils ne comptent pas au classement individuel.
        </p>

        {estCapitaine && propositionsRecues.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            <h3 className="font-texte text-mini font-medium text-muted uppercase">Propositions reçues</h3>
            {propositionsRecues.map((p) => (
              <div key={p.id} className={"flex flex-col gap-3 " + classeCarte("atteste")}>
                <p className="text-sm text-text">
                  {p.equipe_a ? (
                    <Link href={`/equipe/${p.equipe_a.slug}`} className="font-semibold hover:underline">
                      {libelleEquipe(p.equipe_a.tag, p.equipe_a.nom)}
                    </Link>
                  ) : (
                    "Une équipe"
                  )}{" "}
                  propose un scrim le <span className="tabular-nums">{formaterDate(p.prevu_le)}</span> (heure de
                  Paris), en Bo{p.best_of}, sur {p.region}.
                </p>
                {membresAlignables.length >= TAILLE_ALIGNEMENT ? (
                  <form action={repondreScrim} className="flex flex-col gap-3">
                    <input type="hidden" name="scrim_id" value={p.id} />
                    <input type="hidden" name="slug" value={equipe.slug} />
                    <input type="hidden" name="reponse" value="accepter" />
                    <ChoixAlignement
                      region={p.region}
                      capitaineId={equipe.capitaine_id}
                      membres={membresAlignables}
                      coches={membresAlignables.slice(0, TAILLE_ALIGNEMENT).map((m) => m.profileId)}
                    />
                    <Bouton libelleEnCours="Envoi…" className="self-start">
                      Accepter avec ces cinq joueurs
                    </Bouton>
                  </form>
                ) : (
                  <p className="text-xs text-muted">
                    Il faut cinq membres dans l&apos;équipe pour accepter un scrim.
                  </p>
                )}
                <form action={repondreScrim}>
                  <input type="hidden" name="scrim_id" value={p.id} />
                  <input type="hidden" name="slug" value={equipe.slug} />
                  <input type="hidden" name="reponse" value="refuser" />
                  <BoutonConfirmation
                    type="submit"
                    confirmation="Refuser ce scrim ?"
                    className="inline-flex min-h-11 items-center font-texte text-mini text-danger underline underline-offset-3"
                  >
                    Refuser
                  </BoutonConfirmation>
                </form>
              </div>
            ))}
          </div>
        )}

        {estCapitaine && propositionsEnvoyees.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            <h3 className="font-texte text-mini font-medium text-muted uppercase">Propositions envoyées</h3>
            {propositionsEnvoyees.map((p) => (
              <div key={p.id} className={"flex flex-wrap items-center justify-between gap-2 " + classeCarte("none")}>
                <span className="text-sm text-text">
                  Contre {p.equipe_b ? libelleEquipe(p.equipe_b.tag, p.equipe_b.nom) : "une équipe"} ·{" "}
                  <span className="tabular-nums">{formaterDate(p.prevu_le)}</span> · Bo{p.best_of} ·{" "}
                  <span className="text-muted">{LIBELLE_ETAT_SCRIM.propose}</span>
                </span>
                <form action={annulerScrim}>
                  <input type="hidden" name="scrim_id" value={p.id} />
                  <input type="hidden" name="slug" value={equipe.slug} />
                  <BoutonConfirmation
                    type="submit"
                    confirmation="Retirer cette proposition de scrim ?"
                    className="inline-flex min-h-11 items-center font-texte text-mini text-danger underline underline-offset-3"
                  >
                    Retirer
                  </BoutonConfirmation>
                </form>
              </div>
            ))}
          </div>
        )}

        {scrims.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Aucun scrim joué ou programmé pour l&apos;instant.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {scrims.map((sc) => (
              <li key={sc.slug} className={"flex flex-wrap items-center justify-between gap-2 " + classeCarte("none")}>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium text-text">
                    Contre{" "}
                    {sc.adversaire.slug ? (
                      <Link href={`/equipe/${sc.adversaire.slug}`} className="hover:underline">
                        {sc.adversaire.libelle}
                      </Link>
                    ) : (
                      sc.adversaire.libelle
                    )}
                  </span>
                  <Link href={`/lol/tournois/${sc.slug}`} className="text-xs text-muted tabular-nums hover:underline">
                    {formaterDate(sc.prevuLe)}
                  </Link>
                </span>
                <span className="flex items-center gap-3">
                  <span
                    className={`font-texte text-mini uppercase ${
                      sc.resultat?.startsWith("Victoire vérifiée") ? "font-semibold text-accent" : "text-text-2"
                    }`}
                  >
                    {sc.resultat ?? LIBELLE_ETAT_SCRIM[sc.etat]}
                  </span>
                  {estCapitaine && sc.scrimId && sc.etat === "a_venir" && (
                    <form action={annulerScrim}>
                      <input type="hidden" name="scrim_id" value={sc.scrimId} />
                      <input type="hidden" name="slug" value={equipe.slug} />
                      <BoutonConfirmation
                        type="submit"
                        confirmation="Annuler ce scrim ? L'équipe adverse sera prévenue."
                        className="inline-flex min-h-11 items-center font-texte text-mini text-danger underline underline-offset-3"
                      >
                        Annuler
                      </BoutonConfirmation>
                    </form>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {equipesPourProposer.length > 0 && (
          <div className="mt-4 flex flex-col gap-3">
            {!regionVisiteur ? (
              <p className="text-sm text-muted">
                Pour proposer un scrim, lie et vérifie ton compte Riot : il fixe la région du match.{" "}
                <Link href="/lier-riot" className="text-text underline underline-offset-3">
                  Lier mon compte Riot
                </Link>
              </p>
            ) : (
              equipesPourProposer.map((e) =>
                e.membres.length < TAILLE_ALIGNEMENT ? (
                  <p key={e.id} className="text-sm text-muted">
                    {libelleEquipe(e.tag, e.nom)} compte {e.membres.length} membre{e.membres.length > 1 ? "s" : ""} :
                    il en faut {TAILLE_ALIGNEMENT} pour proposer un scrim.
                  </p>
                ) : (
                  <details key={e.id} className={classeCarte("none")}>
                    <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-sm font-semibold text-text hover:text-accent [&::-webkit-details-marker]:hidden">
                      Proposer un scrim avec {libelleEquipe(e.tag, e.nom)}
                    </summary>
                    <form action={proposerScrim} className="mt-2 flex flex-col gap-3">
                      <input type="hidden" name="equipe_id" value={e.id} />
                      <input type="hidden" name="adversaire_id" value={equipe.id} />
                      <input type="hidden" name="slug" value={equipe.slug} />
                      <label className="flex flex-col gap-1">
                        <span className="font-texte text-mini font-medium text-muted uppercase">
                          Date et heure (heure de Paris)
                        </span>
                        <input type="datetime-local" name="prevu_le" required className={CHAMP_SCRIM} />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="font-texte text-mini font-medium text-muted uppercase">Format</span>
                        <select name="best_of" defaultValue="1" className={CHAMP_SCRIM}>
                          <option value="1">Best-of-1</option>
                          <option value="3">Best-of-3</option>
                        </select>
                      </label>
                      <ChoixAlignement
                        region={regionVisiteur}
                        capitaineId={visiteurId ?? ""}
                        membres={e.membres}
                        coches={e.membres.slice(0, TAILLE_ALIGNEMENT).map((m) => m.profileId)}
                      />
                      <Bouton libelleEnCours="Envoi…" className="self-start">
                        Proposer le scrim
                      </Bouton>
                    </form>
                  </details>
                ),
              )
            )}
          </div>
        )}
      </section>
      </Apparition>

      {estCapitaine && (
        <>
        <Apparition delai={0.12}>
        <section className="mt-10">
          <SectionTitre>Vitrine &amp; recrutement</SectionTitre>
          <form action={mettreAJourEquipe} className="mt-3 flex flex-col gap-3">
            <input type="hidden" name="team_id" value={equipe.id} />
            <input type="hidden" name="slug" value={equipe.slug} />
            <label className="flex flex-col gap-1">
              <span className="font-texte text-mini font-medium text-muted uppercase">
                Description (500 caractères max)
              </span>
              <textarea
                name="description"
                rows={3}
                maxLength={500}
                defaultValue={equipe.description ?? ""}
                placeholder="Présente ton équipe, ton ambition, ce que tu cherches"
                className="resize-none min-h-11 rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-texte text-mini font-medium text-muted uppercase">
                Contact recrutement
              </span>
              <input
                name="contact_recrutement"
                type="text"
                defaultValue={equipe.contact_recrutement ?? ""}
                placeholder="Discord, e-mail…"
                className="min-h-11 rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
            </label>

            {peutBranding ? (
              <>
                <UploadLogo type="equipe" id={equipe.id} logoActuel={equipe.logo_url} nomChamp="logo_url" />
                <label className="flex flex-col gap-1">
                  <span className="font-texte text-mini font-medium text-muted uppercase">
                    Couleur d&apos;accent
                  </span>
                  <input
                    name="couleur_accent"
                    type="color"
                    defaultValue={equipe.couleur_accent ?? "#D2A257"}
                    className="h-9 w-16 rounded-[3px] border border-line bg-bg"
                  />
                </label>
              </>
            ) : (
              <p className="text-[0.78rem] text-muted">
                Logo et couleur d&apos;accent demandent l&apos;offre Vérifié ou plus.
              </p>
            )}

            <Bouton libelleEnCours="Enregistrement…" className="self-start">
              Enregistrer
            </Bouton>
          </form>
        </section>
        </Apparition>

        <Apparition delai={0.15}>
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
                className="w-full min-h-11 rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
            </label>
            <Bouton libelleEnCours="Invitation…">Inviter</Bouton>
          </form>

          {invitesEnAttente.length > 0 && (
            <div className="mt-4">
              <h3 className="font-texte text-mini font-medium text-muted uppercase">
                Invitations en attente
              </h3>
              <ul className="mt-2 flex flex-col gap-2">
                {invitesEnAttente.map((m) => (
                  <li key={m.profile_id} className={"flex items-center justify-between " + classeCarte("none")}>
                    <span className="text-sm text-muted">
                      {m.profile?.pseudo ?? "Joueur inconnu"}
                    </span>
                    <form action={retirerMembre}>
                      <input type="hidden" name="team_id" value={equipe.id} />
                      <input type="hidden" name="profile_id" value={m.profile_id} />
                      <input type="hidden" name="slug" value={equipe.slug} />
                      <button
                        type="submit"
                        aria-label={`Annuler l'invitation de ${m.profile?.pseudo ?? "ce joueur"}`}
                        className="inline-flex min-h-11 items-center font-texte tabular-nums text-mini text-danger underline underline-offset-3"
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
        </Apparition>
        </>
      )}
      </div>
    </main>
  );
}
