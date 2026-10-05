import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  ajouterEcheance,
  annulerDotation,
  enregistrerDotation,
  leverSuspension,
  noterVersement,
  preparerVersements,
  resoudreLitigeAdmin,
  retirerEcheance,
  suspendreCompte,
  traiterSignalement,
  verserParStripe,
} from "@/lib/admin-actions";
import { LIBELLE_RAISON } from "@/lib/moderation";
import { attribuerOffreAdmin } from "@/lib/offres-actions";
import { LABEL_OFFRE, chargerOffres, type Offre } from "@/lib/offres";
import { formaterDate } from "@/lib/tournois";
import { cashPrizesActifs, formaterEuros, LIBELLE_RANG } from "@/lib/dotations";
import { detecterSignaux } from "@/lib/signaux";
import { classeCarte } from "@/lib/ui";
import Bouton from "@/components/ui/Bouton";
import BoutonConfirmation from "@/components/ui/BoutonConfirmation";
import SectionTitre from "@/components/ui/SectionTitre";
import Alerte from "@/components/design/Alerte";
import Icone from "@/components/design/Icone";
import LibelleSection from "@/components/design/LibelleSection";
import EtatVide from "@/components/ui/EtatVide";
import IllustrationEffectifVide from "@/components/ui/IllustrationEffectifVide";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";
import DossierLitige, { lireSynthese } from "@/components/litige/DossierLitige";

export const metadata: Metadata = {
  title: "Administration — Najarena",
  robots: { index: false, follow: false },
};

const CHAMP_ADMIN =
  "min-h-11 rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// Hors du composant : la date courante ne se lit pas pendant le rendu.
function hier(): string {
  return new Date(Date.now() - 86_400_000).toISOString();
}

interface AdminPageProps {
  searchParams: Promise<{ erreur?: string; message?: string }>;
}

// Signaux à examiner sur 30 jours (audit N11) : lecture des données
// publiques, calcul dans src/lib/signaux.ts. Jamais d'action automatique.
// Les défis (et duels de l'arène) comptent au classement : leurs matchs
// entrent dans les face-à-face et les groupes fermés, pas dans les
// signaux propres à un tournoi d'organisateur.
async function chargerSignaux(supabase: Awaited<ReturnType<typeof createClient>>) {
  const depuis = new Date(Date.now() - 30 * 86_400_000).toISOString();
  // Les tournois 5v5 (audit N21) ne touchent pas au rating individuel.
  const natures = ["tournoi", "defi"];
  const [{ data: tournoisRecents }, { data: variationsRecentes }, { data: matchsRecents }] = await Promise.all([
    supabase
      .from("tournaments")
      .select("id, nom, slug, organisateur_id, statut, nature")
      .in("nature", natures)
      .eq("format", "1v1")
      .gte("debute_le", depuis),
    supabase
      .from("rating_events")
      .select("profile_id, tournament_id, rating_avant, rating_apres")
      .eq("motif", "tournoi")
      .gte("cree_le", depuis),
    // Filtre par jointure plutôt que par liste d'identifiants : les duels
    // de l'arène peuvent se compter par centaines sur 30 jours.
    supabase
      .from("matches")
      .select(
        "tournament_id, tournament:tournaments!inner(nature, format, debute_le), match_participants(profile_id, est_gagnant), match_verdicts(niveau, est_definitif)",
      )
      .in("tournament.nature", natures)
      .eq("tournament.format", "1v1")
      .gte("tournament.debute_le", depuis),
  ]);
  const signaux = detecterSignaux(
    (matchsRecents ?? []).map((m) => ({
      tournoiId: m.tournament_id,
      joueurs: m.match_participants.map((p) => ({ id: p.profile_id, gagnant: p.est_gagnant })),
      verifie: m.match_verdicts.some((v) => v.est_definitif && v.niveau !== "manuel"),
    })),
    (tournoisRecents ?? [])
      .filter((t) => t.nature === "tournoi")
      .map((t) => ({ id: t.id, organisateurId: t.organisateur_id, statut: t.statut })),
    (variationsRecentes ?? []).map((v) => ({
      profileId: v.profile_id,
      tournoiId: v.tournament_id,
      avant: v.rating_avant,
      apres: v.rating_apres,
    })),
  );
  const idsSignales = new Set<string>([
    ...signaux.paires.flatMap((p) => [p.a, p.b]),
    ...signaux.organisateursJoueurs.map((o) => o.organisateurId),
    ...signaux.hausses.map((h) => h.profileId),
    ...signaux.groupesFermes.flatMap((g) => g.joueurs),
  ]);
  const { data: profilsSignales } =
    idsSignales.size > 0
      ? await supabase.from("profiles").select("id, pseudo, slug").in("id", [...idsSignales])
      : { data: [] };
  return { signaux, profilsSignales: profilsSignales ?? [], tournoisRecents: tournoisRecents ?? [] };
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const { erreur, message } = await searchParams;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { data: admin } = await supabase
    .from("admins")
    .select("profile_id")
    .eq("profile_id", userData.user.id)
    .maybeSingle();

  if (!admin) {
    return (
      <main className="px-grille *:max-w-xl pt-32 pb-24 font-texte text-text">
        <p className={classeCarte("sceau") + " text-sm text-danger"}>
          Accès réservé aux administrateurs.
        </p>
        <Link
          href="/moi"
          className="mt-4 inline-block text-sm text-muted underline underline-offset-3 hover:text-text"
        >
          Retour à mon compte
        </Link>
      </main>
    );
  }

  // Six requêtes indépendantes entre elles, lancées en parallèle plutôt
  // qu'en série (correctif du 13/09/2026, même logique que sur l'accueil).
  // Regroupées ici, après la vérification `admin` ci-dessus — jamais avant :
  // ce sont des requêtes coûteuses (comptages, jointures), on évite de les
  // lancer pour un visiteur non admin qui tombe sur /admin.
  const [
    { data: litigesData, error: erreurLitiges },
    { count: totalJoueurs },
    { count: tournoisActifs },
    { count: tournoisTotal },
    { count: matchsEnregistres },
    { data: derniersInscrits },
    { data: suspensionsData },
    { data: signalementsData },
    { data: echeancesData },
  ] = await Promise.all([
    supabase
      .from("disputes")
      .select(
        "id, motif, resolution, resolu_le, cree_le, match_id, ouvert_par:profiles!disputes_ouvert_par_fkey(pseudo, slug), resolu_par:profiles!disputes_resolu_par_fkey(pseudo, slug), match:matches(tour, tournament:tournaments(nom, slug))",
      )
      .order("cree_le", { ascending: false }),
    // « id » et pas « * » : l'identifiant Discord n'est plus lisible par
    // le public (droits par colonne, docs/schema.sql).
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("tournaments")
      .select("*", { count: "exact", head: true })
      .eq("nature", "tournoi")
      .in("statut", ["ouvert", "checkin", "en_cours"]),
    supabase.from("tournaments").select("*", { count: "exact", head: true }).eq("nature", "tournoi"),
    supabase.from("match_verdicts").select("*", { count: "exact", head: true }).eq("est_definitif", true),
    supabase
      .from("profiles")
      .select(
        "id, pseudo, slug, pays, created_at, game_accounts(verifie_le), admins(profile_id)",
      )
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("suspensions")
      .select(
        "id, motif, suspendu_le, profil:profiles!suspensions_profile_id_fkey(pseudo, slug), auteur:profiles!suspensions_suspendu_par_fkey(pseudo)",
      )
      .is("levee_le", null)
      .order("suspendu_le", { ascending: false }),
    // File de modération (audit N27).
    supabase
      .from("moderation_signalements")
      .select("id, contexte, extrait, raison, cree_le, auteur:profiles!moderation_signalements_auteur_id_fkey(pseudo, slug)")
      .eq("statut", "a_examiner")
      .order("cree_le", { ascending: true })
      .limit(50),
    // Calendrier des échéances à venir (audit N24).
    supabase
      .from("echeances")
      .select("id, type, nom, debut_le, lien_officiel, source, region")
      .gte("debut_le", hier())
      .order("debut_le", { ascending: true })
      .limit(40),
  ]);

  // Cash prizes (audit N32) : rien n'est lu tant qu'ils sont désactivés.
  const { data: dotationsData } = cashPrizesActifs()
    ? await supabase
        .from("dotations")
        .select(
          "tournament_id, sponsor_nom, repartition, statut, tournament:tournaments(nom, slug, statut), versements_dotation(profile_id, rang, montant_centimes, a_verifier, statut, reference, transfert_stripe_id, profile:profiles(pseudo, compte_versement:comptes_versement(verifie)))",
        )
        .order("cree_le", { ascending: false })
        .limit(30)
    : { data: [] };
  const dotations = dotationsData ?? [];

  const { signaux, profilsSignales, tournoisRecents } = await chargerSignaux(supabase);
  const joueurSignale = new Map(profilsSignales.map((p) => [p.id, p]));
  const tournoiSignale = new Map(tournoisRecents.map((t) => [t.id, t]));
  const lienJoueur = (id: string) => {
    const p = joueurSignale.get(id);
    return p ? (
      <Link href={`/joueur/${p.slug}`} className="font-semibold text-text hover:underline">
        {p.pseudo}
      </Link>
    ) : (
      "Joueur inconnu"
    );
  };
  const lienTournoi = (id: string | null) => {
    const t = id ? tournoiSignale.get(id) : undefined;
    return t ? (
      <Link href={`/lol/tournois/${t.slug}`} className="text-text hover:underline">
        {t.nom}
      </Link>
    ) : (
      "un tournoi"
    );
  };
  const aucunSignal =
    signaux.paires.length +
      signaux.organisateursJoueurs.length +
      signaux.hausses.length +
      signaux.petitsTournois.length +
      signaux.groupesFermes.length ===
    0;

  const litiges = litigesData ?? [];
  const litigesOuverts = litiges.filter((l) => !l.resolution);
  // Dossiers déjà préparés (audit N28).
  const { data: dossiersData } =
    litigesOuverts.length > 0
      ? await supabase
          .from("dossiers_litige")
          .select("dispute_id, faits, synthese")
          .in(
            "dispute_id",
            litigesOuverts.map((l) => l.id),
          )
      : { data: [] };
  const dossierParLitige = new Map(
    (dossiersData ?? []).map((d) => [d.dispute_id, { faits: d.faits, synthese: lireSynthese(d.synthese) }]),
  );
  const litigesResolus = litiges.filter((l) => l.resolution);
  const comptes = derniersInscrits ?? [];
  const suspensions = suspensionsData ?? [];
  const signalements = signalementsData ?? [];
  const offresParCompte = await chargerOffres(supabase, comptes.map((c) => c.id));

  // Revue visuelle du 05/10/2026 : ce qui attend une décision (textes à
  // relire, litiges ouverts, signaux) passe en tête, avec un bandeau de
  // compteurs qui mène à chaque rubrique ; les outils viennent ensuite, le
  // suivi (derniers inscrits, litiges résolus) à la fin. Actions inchangées.
  const nbSignaux =
    signaux.paires.length +
    signaux.organisateursJoueurs.length +
    signaux.hausses.length +
    signaux.petitsTournois.length +
    signaux.groupesFermes.length;
  const aTraiter = [
    { href: "#moderation", libelle: "Textes à relire", valeur: signalements.length },
    { href: "#litiges", libelle: "Litiges ouverts", valeur: litigesOuverts.length },
    { href: "#signaux", libelle: "Signaux (30 jours)", valeur: nbSignaux },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative px-grille">
      <Apparition className="flex flex-col gap-8 border-b border-line pb-10">
        <Link
          href="/moi"
          className="inline-flex min-h-11 items-center gap-2 self-start font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
        >
          <Icone nom="fleche-gauche" taille={14} />
          Mon compte
        </Link>
        <div>
          <LibelleSection>Modération · litiges · outils</LibelleSection>
          <h1 className="mt-3 font-titre text-sous-titre font-black uppercase">Administration</h1>
        </div>
        <nav aria-label="À traiter" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {aTraiter.map((t) => (
            <a
              key={t.href}
              href={t.href}
              className={`panneau flex items-end justify-between gap-4 p-5 transition-colors duration-200 hover:border-[rgba(245,245,244,0.25)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${
                t.valeur > 0 ? "border-l-2 border-l-danger" : ""
              }`}
            >
              <span className="flex flex-col gap-2">
                <span className="font-texte text-mini font-medium text-faint uppercase">{t.libelle}</span>
                <span
                  className={`font-titre text-5xl leading-none font-black tabular-nums ${t.valeur > 0 ? "text-danger" : "text-text"}`}
                >
                  {t.valeur}
                </span>
              </span>
              <span className="text-sm text-muted">{t.valeur > 0 ? "À traiter →" : "Rien à traiter"}</span>
            </a>
          ))}
        </nav>
        {(erreur || message) && (
          <div className="flex max-w-2xl flex-col gap-3">
            {erreur && <Alerte type="erreur">{erreur}</Alerte>}
            {message && <Alerte type="succes">{message}</Alerte>}
          </div>
        )}
      </Apparition>

      <Apparition delai={0.13}>
      <section id="moderation" className="mt-10 scroll-mt-28" aria-labelledby="titre-moderation">
        <SectionTitre>
          <span id="titre-moderation">Textes à relire ({signalements.length})</span>
        </SectionTitre>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Retenus par la modération automatique : insulte, menace ou lien dans un message privé (pas encore remis
          à son destinataire) ou un motif de litige. Les propos haineux et les arnaques sont refusés d&apos;office.
        </p>
        {signalements.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Rien à relire.</p>
        ) : (
          <ul className="mt-3 flex max-w-3xl flex-col gap-2">
            {signalements.map((s) => (
              <li key={s.id} className={"flex flex-col gap-2 " + classeCarte("sceau")}>
                <span className="text-mini text-muted uppercase">
                  {s.contexte === "message" ? "Message privé" : "Motif de litige"} ·{" "}
                  {LIBELLE_RAISON[s.raison] ?? s.raison} · {s.auteur ? s.auteur.pseudo : "Compte supprimé"} ·{" "}
                  <span className="tabular-nums">{formaterDate(s.cree_le)}</span>
                </span>
                <p className="text-sm text-text [overflow-wrap:anywhere]">« {s.extrait} »</p>
                <div className="flex flex-wrap gap-4">
                  <form action={traiterSignalement}>
                    <input type="hidden" name="signalement_id" value={s.id} />
                    <input type="hidden" name="decision" value="valider" />
                    <button type="submit" className="inline-flex min-h-11 items-center font-texte text-mini text-accent underline underline-offset-3">
                      {s.contexte === "message" ? "Valider et remettre" : "Valider"}
                    </button>
                  </form>
                  <form action={traiterSignalement}>
                    <input type="hidden" name="signalement_id" value={s.id} />
                    <input type="hidden" name="decision" value="rejeter" />
                    <button type="submit" className="inline-flex min-h-11 items-center font-texte text-mini text-danger underline underline-offset-3">
                      Rejeter
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      </Apparition>

      <Apparition delai={0.2}>
      <section id="litiges" className="mt-10 scroll-mt-28">
        <SectionTitre>Litiges ouverts ({litigesOuverts.length})</SectionTitre>

        {erreurLitiges ? (
          <p className={"mt-3 " + classeCarte("sceau") + " text-sm text-danger"}>
            Impossible de charger les litiges pour l&apos;instant.
          </p>
        ) : litigesOuverts.length === 0 ? (
          <p className={"mt-3 " + classeCarte("none") + " text-sm text-muted"}>
            Aucun litige ouvert.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {litigesOuverts.map((l) => (
              <li key={l.id} className={classeCarte("sceau")}>
                {l.match?.tournament && (
                  <Link
                    href={`/lol/tournois/${l.match.tournament.slug}`}
                    className="font-texte tabular-nums text-mini text-muted uppercase hover:text-text"
                  >
                    {l.match.tournament.nom} · Tour {l.match.tour}
                  </Link>
                )}
                <p className="mt-1 text-sm text-text">
                  Ouvert par{" "}
                  <span className="font-medium">{l.ouvert_par?.pseudo ?? "un joueur"}</span> le{" "}
                  {formaterDate(l.cree_le)}
                </p>
                <p className="mt-1 text-sm text-muted">{l.motif}</p>
                <form action={resoudreLitigeAdmin} className="mt-3 flex flex-col gap-2">
                  <input type="hidden" name="dispute_id" value={l.id} />
                  <label>
                    <span className="sr-only">
                      Résolution du litige
                      {l.match?.tournament
                        ? ` — ${l.match.tournament.nom}, tour ${l.match.tour}`
                        : ""}
                    </span>
                    <input
                      name="resolution"
                      type="text"
                      required
                      placeholder="Résolution (obligatoire)"
                      className="w-full min-h-11 rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    />
                  </label>
                  <Bouton
                    aria-label={`Résoudre le litige${l.match?.tournament ? ` — ${l.match.tournament.nom}, tour ${l.match.tour}` : ""}`}
                    libelleEnCours="Résolution…"
                    className="self-start"
                  >
                    Résoudre
                  </Bouton>
                </form>
                <DossierLitige disputeId={l.id} dossier={dossierParLitige.get(l.id) ?? null} depuis="admin" />
              </li>
            ))}
          </ul>
        )}
      </section>
      </Apparition>

      <Apparition delai={0.14}>
      <section id="signaux" className="mt-10 scroll-mt-28" aria-labelledby="titre-signaux">
        <SectionTitre>
          <span id="titre-signaux">Signaux à examiner (30 jours)</span>
        </SectionTitre>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Des schémas qui peuvent trahir une entente pour gonfler un classement. Ce sont des signaux, pas des preuves :
          à regarder avant toute décision. Rien n&apos;est fait automatiquement.
        </p>
        {aucunSignal ? (
          <p className="mt-3 text-sm text-muted">Rien à signaler.</p>
        ) : (
          <ul className="mt-3 flex max-w-3xl flex-col gap-2 text-sm text-text-2">
            {signaux.paires.map((p) => (
              <li key={`paire-${p.a}-${p.b}`}>
                <span className="text-mini font-semibold text-danger uppercase">Face-à-face répétés</span> — {lienJoueur(p.a)}{" "}
                et {lienJoueur(p.b)} : <span className="tabular-nums">{p.matchs}</span> matchs (
                <span className="tabular-nums">
                  {p.victoiresA}–{p.victoiresB}
                </span>
                ).
              </li>
            ))}
            {signaux.organisateursJoueurs.map((o) => (
              <li key={`orga-${o.tournoiId}`}>
                <span className="text-mini font-semibold text-danger uppercase">Organisateur joueur</span> —{" "}
                {lienJoueur(o.organisateurId)} joue dans son propre tournoi {lienTournoi(o.tournoiId)}.
              </li>
            ))}
            {signaux.hausses.map((h) => (
              <li key={`hausse-${h.profileId}-${h.tournoiId}`}>
                <span className="text-mini font-semibold text-danger uppercase">Hausse forte</span> —{" "}
                {lienJoueur(h.profileId)} :{" "}
                <span className="tabular-nums">
                  +{Math.round(h.apres - h.avant)} ({Math.round(h.avant)} → {Math.round(h.apres)})
                </span>{" "}
                sur {lienTournoi(h.tournoiId)}.
              </li>
            ))}
            {signaux.groupesFermes.map((g) => (
              <li key={`groupe-${g.joueurs.join("-")}`}>
                <span className="text-mini font-semibold text-danger uppercase">Groupe fermé</span> —{" "}
                {g.joueurs.map((j, i) => (
                  <span key={j}>
                    {i > 0 ? ", " : ""}
                    {lienJoueur(j)}
                  </span>
                ))}{" "}
                : <span className="tabular-nums">{g.matchsInternes}</span> matchs vérifiés entre eux (
                <span className="tabular-nums">{Math.round(g.part * 100)} %</span> de leurs matchs).
              </li>
            ))}
            {signaux.petitsTournois.map((t) => (
              <li key={`petit-${t.tournoiId}`}>
                <span className="text-mini font-semibold text-danger uppercase">Très petit tournoi classé</span> —{" "}
                {lienTournoi(t.tournoiId)} : <span className="tabular-nums">{t.joueurs}</span> joueurs, compte au
                classement.
              </li>
            ))}
          </ul>
        )}
      </section>
      </Apparition>

      <Apparition delai={0.1}>
      <section className="mt-10">
        <SectionTitre>Vue d&apos;ensemble</SectionTitre>
        <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-[3px] border border-line bg-surface shadow-[0_1px_2px_rgba(18,22,29,0.05),0_10px_24px_-16px_rgba(18,22,29,0.15)] sm:grid-cols-4">
          <div className="border-r border-b border-line p-4 sm:border-b-0">
            <div className="font-texte tabular-nums text-mini tracking-[0.16em] text-muted uppercase">
              Joueurs
            </div>
            <div className="mt-0.5 font-texte tabular-nums text-2xl font-bold tracking-tight text-text">
              {totalJoueurs ?? 0}
            </div>
          </div>
          <div className="border-b border-line p-4 sm:border-r sm:border-b-0">
            <div className="font-texte tabular-nums text-mini tracking-[0.16em] text-muted uppercase">
              Tournois actifs
            </div>
            <div className="mt-0.5 font-texte tabular-nums text-2xl font-bold tracking-tight text-text">
              {tournoisActifs ?? 0}
            </div>
          </div>
          <div className="border-r border-line p-4">
            <div className="font-texte tabular-nums text-mini tracking-[0.16em] text-muted uppercase">
              Tournois créés
            </div>
            <div className="mt-0.5 font-texte tabular-nums text-2xl font-bold tracking-tight text-text">
              {tournoisTotal ?? 0}
            </div>
          </div>
          <div className="p-4">
            <div className="font-texte tabular-nums text-mini tracking-[0.16em] text-muted uppercase">
              Matchs enregistrés
            </div>
            <div className="mt-0.5 font-texte tabular-nums text-2xl font-bold tracking-tight text-text">
              {matchsEnregistres ?? 0}
            </div>
          </div>
        </div>
      </section>
      </Apparition>

      <Apparition delai={0.12}>
      <section className="mt-10">
        <SectionTitre>Attribuer une offre</SectionTitre>
        <p className="mt-1 text-sm text-muted">
          En attendant Stripe — comptes offerts, tests, streamers partenaires.
        </p>
        <form action={attribuerOffreAdmin} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label className="flex-1">
            <span className="sr-only">Pseudo du joueur</span>
            <input
              name="pseudo"
              type="text"
              required
              placeholder="Pseudo du joueur"
              className="w-full min-h-11 rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
          </label>
          <label>
            <span className="sr-only">Offre à attribuer</span>
            <select
              name="offre"
              defaultValue="verifie"
              className="w-full min-h-11 rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto"
            >
              <option value="gratuit">Gratuit (révoquer)</option>
              <option value="verifie">Vérifié</option>
              <option value="elite">Elite</option>
              <option value="organisateur">Organisateur</option>
            </select>
          </label>
          <Bouton libelleEnCours="Attribution…">Attribuer</Bouton>
        </form>
      </section>
      </Apparition>

      <Apparition delai={0.13}>
      <section id="suspensions" className="mt-10 scroll-mt-28">
        <SectionTitre>Suspendre un compte</SectionTitre>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          En cas de manquement manifeste aux CGU. Le joueur ne peut plus se connecter ni s&apos;inscrire, il
          est retiré des tournois pas encore commencés et reçoit le motif par e-mail. Ses résultats passés
          restent affichés.
        </p>
        <form action={suspendreCompte} className="mt-3 flex max-w-2xl flex-col gap-2">
          <label>
            <span className="sr-only">Pseudo du joueur</span>
            <input
              name="pseudo"
              type="text"
              required
              placeholder="Pseudo du joueur"
              className="w-full min-h-11 rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
          </label>
          <label>
            <span className="sr-only">Motif (communiqué au joueur)</span>
            <textarea
              name="motif"
              required
              minLength={3}
              maxLength={500}
              rows={2}
              placeholder="Motif, communiqué au joueur"
              className="w-full rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
          </label>
          <BoutonConfirmation
            type="submit"
            confirmation="Suspendre ce compte ? Le joueur est déconnecté, retiré des tournois à venir et prévenu par e-mail."
            className="inline-flex min-h-11 items-center self-start font-texte tabular-nums text-mini text-danger uppercase underline underline-offset-3"
          >
            Suspendre le compte
          </BoutonConfirmation>
        </form>

        {suspensions.length > 0 && (
          <ul className="mt-5 flex max-w-2xl flex-col">
            {suspensions.map((su) => (
              <li
                key={su.id}
                className="flex flex-wrap items-start justify-between gap-3 border-b border-line py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-sm">
                    {su.profil ? (
                      <Link href={`/joueur/${su.profil.slug}`} className="font-semibold text-text hover:underline">
                        {su.profil.pseudo}
                      </Link>
                    ) : (
                      "Compte supprimé"
                    )}{" "}
                    <span className="text-muted tabular-nums">
                      · suspendu le {formaterDate(su.suspendu_le)}
                      {su.auteur ? ` par ${su.auteur.pseudo}` : ""}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-text-2">{su.motif}</p>
                </div>
                <form action={leverSuspension}>
                  <input type="hidden" name="suspension_id" value={su.id} />
                  <BoutonConfirmation
                    type="submit"
                    confirmation="Lever cette suspension ? Le joueur pourra se reconnecter et s'inscrire."
                    className="inline-flex min-h-11 items-center font-texte tabular-nums text-mini text-accent uppercase underline underline-offset-3"
                  >
                    Lever
                  </BoutonConfirmation>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
      </Apparition>

      <Apparition delai={0.125}>
      <section id="echeances" className="mt-10 scroll-mt-28" aria-labelledby="titre-echeances">
        <SectionTitre>
          <span id="titre-echeances">Échéances (Nexus Tour, Clash…)</span>
        </SectionTitre>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Les joueurs peuvent chercher une équipe pour une échéance à venir (/lol/coequipiers). Clash est lu dans
          l&apos;API Riot quatre fois par jour ; le reste se saisit ici, avec le lien officiel qui prouve la date —
          jamais une date supposée.
        </p>
        <form action={ajouterEcheance} className="mt-3 grid max-w-2xl gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="font-texte text-mini font-medium text-muted uppercase">Type</span>
            <select name="type" defaultValue="nexus_tour" className={CHAMP_ADMIN}>
              <option value="nexus_tour">Nexus Tour</option>
              <option value="clash">Clash (hors calendrier Riot)</option>
              <option value="autre">Autre compétition</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-texte text-mini font-medium text-muted uppercase">Nom</span>
            <input name="nom" required minLength={3} maxLength={80} placeholder="Nexus Tour — étape 3" className={CHAMP_ADMIN} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-texte text-mini font-medium text-muted uppercase">Début (heure de Paris)</span>
            <input name="debut_le" type="datetime-local" required className={CHAMP_ADMIN} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-texte text-mini font-medium text-muted uppercase">Lien officiel</span>
            <input name="lien_officiel" type="url" required placeholder="https://" className={CHAMP_ADMIN} />
          </label>
          <Bouton libelleEnCours="Ajout…" className="self-start">
            Ajouter l&apos;échéance
          </Bouton>
        </form>
        {(echeancesData ?? []).length > 0 && (
          <ul className="mt-4 flex max-w-2xl flex-col gap-2">
            {(echeancesData ?? []).map((e) => (
              <li key={e.id} className={"flex flex-wrap items-center justify-between gap-2 " + classeCarte("none")}>
                <span className="text-sm text-text">
                  <span className="font-semibold">{e.nom}</span> ·{" "}
                  <span className="tabular-nums">{formaterDate(e.debut_le)}</span>
                  {e.region ? ` · ${e.region}` : ""} ·{" "}
                  <span className="text-muted">{e.source === "riot" ? "lu chez Riot" : "saisi"}</span>
                </span>
                {e.source === "admin" && (
                  <form action={retirerEcheance}>
                    <input type="hidden" name="echeance_id" value={e.id} />
                    <BoutonConfirmation
                      type="submit"
                      confirmation={`Retirer « ${e.nom} » ?`}
                      className="inline-flex min-h-11 items-center font-texte text-mini text-danger underline underline-offset-3"
                    >
                      Retirer
                    </BoutonConfirmation>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      </Apparition>

      <Apparition delai={0.127}>
      <section id="dotations" className="mt-10 scroll-mt-28" aria-labelledby="titre-dotations">
        <SectionTitre>
          <span id="titre-dotations">Cash prizes sponsorisés</span>
        </SectionTitre>
        {!cashPrizesActifs() ? (
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Désactivés. À n&apos;allumer (variable CASH_PRIZES_ACTIFS=1 sur l&apos;hébergeur) qu&apos;après le statut
            juridique de l&apos;éditeur, des CGU relues par un juriste et la vérification des règles Riot sur les
            tournois dotés. Une fois allumés : la dotation s&apos;affiche, les gagnants sont désignés d&apos;après le
            bracket, chacun fait vérifier son identité par Stripe, puis le gain est versé par Stripe depuis le solde
            alimenté par le sponsor (ou hors du site, avec sa référence).
          </p>
        ) : (
          <>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Dotation financée par un sponsor, annoncée avant la fin des inscriptions d&apos;un tournoi 1v1. Montants
              en euros par rang : vainqueur, finaliste, chaque demi-finaliste, chaque quart de finaliste.
            </p>
            <form action={enregistrerDotation} className="mt-3 grid max-w-2xl gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="font-texte text-mini font-medium text-muted uppercase">Adresse du tournoi</span>
                <input name="slug" required placeholder="coupe-du-jeudi-ab12c" className={CHAMP_ADMIN} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-texte text-mini font-medium text-muted uppercase">Sponsor</span>
                <input name="sponsor_nom" required minLength={2} maxLength={60} className={CHAMP_ADMIN} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-texte text-mini font-medium text-muted uppercase">Site du sponsor (facultatif)</span>
                <input name="sponsor_lien" type="url" placeholder="https://" className={CHAMP_ADMIN} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-texte text-mini font-medium text-muted uppercase">Répartition (€)</span>
                <input name="repartition" required placeholder="100, 50, 25" className={CHAMP_ADMIN} />
              </label>
              <Bouton libelleEnCours="Enregistrement…" className="self-start">
                Enregistrer la dotation
              </Bouton>
            </form>
            {dotations.length > 0 && (
              <ul className="mt-4 flex max-w-3xl flex-col gap-3">
                {dotations.map((d) => (
                  <li key={d.tournament_id} className={"flex flex-col gap-2 " + classeCarte("none")}>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>
                        <Link href={`/lol/tournois/${d.tournament?.slug ?? ""}`} className="font-semibold hover:text-accent">
                          {d.tournament?.nom ?? "Tournoi"}
                        </Link>{" "}
                        · {d.sponsor_nom} · {d.repartition.map((c) => formaterEuros(c)).join(" / ")}
                        {d.statut === "annulee" ? " · annulée" : ""}
                      </span>
                      {d.statut === "validee" && (
                        <span className="flex flex-wrap gap-3">
                          {d.tournament?.statut === "termine" && (
                            <form action={preparerVersements}>
                              <input type="hidden" name="tournament_id" value={d.tournament_id} />
                              <button type="submit" className="inline-flex min-h-11 items-center text-mini text-accent underline underline-offset-3">
                                Désigner les gagnants
                              </button>
                            </form>
                          )}
                          <form action={annulerDotation}>
                            <input type="hidden" name="tournament_id" value={d.tournament_id} />
                            <BoutonConfirmation
                              type="submit"
                              confirmation="Annuler cette dotation ?"
                              className="inline-flex min-h-11 items-center text-mini text-danger underline underline-offset-3"
                            >
                              Annuler
                            </BoutonConfirmation>
                          </form>
                        </span>
                      )}
                    </div>
                    {d.versements_dotation.map((v) => (
                      <div key={v.profile_id} className="flex flex-col gap-2 border-t border-line pt-2 text-sm">
                        <span className="min-w-48">
                          {LIBELLE_RANG[v.rang] ?? `Rang ${v.rang}`} : {v.profile?.pseudo ?? "Joueur"} ·{" "}
                          <span className="tabular-nums">{formaterEuros(v.montant_centimes)}</span>
                          {v.a_verifier && <span className="text-danger"> · décidé à la main, à vérifier</span>}
                          {/* Identité vérifiée par Stripe (audit N32). */}
                          {v.statut === "a_verser" && (
                            <span className="text-muted">
                              {" "}
                              · identité{" "}
                              {v.profile?.compte_versement?.verifie ? "vérifiée par Stripe" : "pas encore vérifiée par Stripe"}
                            </span>
                          )}
                        </span>
                        {v.transfert_stripe_id ? (
                          <span className="text-mini text-accent uppercase">
                            Versé par Stripe · <span className="tabular-nums normal-case">{v.transfert_stripe_id}</span>
                          </span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                            {v.statut === "a_verser" && v.profile?.compte_versement?.verifie && (
                              <form action={verserParStripe} className="flex flex-wrap items-center gap-3">
                                <input type="hidden" name="tournament_id" value={d.tournament_id} />
                                <input type="hidden" name="profile_id" value={v.profile_id} />
                                {v.a_verifier && (
                                  <label className="flex items-center gap-2 text-xs text-text">
                                    <input type="checkbox" name="rang_verifie" value="oui" required className="accent-accent" />
                                    Rang vérifié
                                  </label>
                                )}
                                <BoutonConfirmation
                                  type="submit"
                                  confirmation={`Verser ${formaterEuros(v.montant_centimes)} à ${v.profile?.pseudo ?? "ce joueur"} par Stripe ?`}
                                  className="inline-flex min-h-11 items-center text-mini font-semibold text-accent underline underline-offset-3"
                                >
                                  Verser par Stripe
                                </BoutonConfirmation>
                              </form>
                            )}
                            <form action={noterVersement} className="flex flex-wrap items-center gap-2">
                              <input type="hidden" name="tournament_id" value={d.tournament_id} />
                              <input type="hidden" name="profile_id" value={v.profile_id} />
                              <select name="statut" defaultValue={v.statut} className={CHAMP_ADMIN}>
                                <option value="a_verser">À verser</option>
                                <option value="verse">Versé</option>
                                <option value="refuse">Refusé</option>
                              </select>
                              <input
                                name="reference"
                                defaultValue={v.reference ?? ""}
                                placeholder="Référence du virement"
                                maxLength={120}
                                className={CHAMP_ADMIN}
                              />
                              <button type="submit" className="inline-flex min-h-11 items-center text-mini text-accent underline underline-offset-3">
                                Noter
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
      </Apparition>

      <Apparition delai={0.15}>
      <section className="mt-10">
        <SectionTitre>Derniers inscrits</SectionTitre>
        {comptes.length === 0 ? (
          <div className="mt-3">
            <EtatVide illustration={<IllustrationEffectifVide />}>
              Aucun compte pour l&apos;instant.
            </EtatVide>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-[3px] border border-line bg-surface shadow-[0_1px_2px_rgba(18,22,29,0.05),0_10px_24px_-16px_rgba(18,22,29,0.15)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-4 py-2 font-texte tabular-nums text-mini tracking-[0.12em] text-muted uppercase">
                    Joueur
                  </th>
                  <th className="px-4 py-2 font-texte tabular-nums text-mini tracking-[0.12em] text-muted uppercase">
                    Inscrit le
                  </th>
                  <th className="px-4 py-2 font-texte tabular-nums text-mini tracking-[0.12em] text-muted uppercase">
                    Riot ID
                  </th>
                  <th className="px-4 py-2 font-texte tabular-nums text-mini tracking-[0.12em] text-muted uppercase">
                    Rôle
                  </th>
                  <th className="px-4 py-2 font-texte tabular-nums text-mini tracking-[0.12em] text-muted uppercase">
                    Offre
                  </th>
                </tr>
              </thead>
              <tbody>
                {comptes.map((c) => {
                  const offre = offresParCompte.get(c.id)?.offre as Exclude<Offre, "gratuit"> | undefined;
                  return (
                  <tr key={c.id} className="border-b border-line last:border-b-0">
                    <td className="px-4 py-2">
                      <Link href={`/joueur/${c.slug}`} className="font-medium text-text hover:underline">
                        {c.pseudo}
                      </Link>
                    </td>
                    <td className="px-4 py-2 font-texte tabular-nums text-[0.72rem] text-muted">
                      {formaterDate(c.created_at)}
                    </td>
                    <td className="px-4 py-2 font-texte tabular-nums text-[0.72rem]">
                      {c.game_accounts.some((g) => g.verifie_le) ? (
                        <span className="inline-flex items-center gap-1.5 text-text-2">
                          <Icone nom="coche" taille={12} />
                          Vérifié
                        </span>
                      ) : (
                        <span className="text-muted">Non lié</span>
                      )}
                    </td>
                    <td className="px-4 py-2 font-texte tabular-nums text-[0.72rem] text-muted">
                      {c.admins ? "Admin" : "Joueur"}
                    </td>
                    <td className="px-4 py-2 font-texte tabular-nums text-[0.72rem] text-muted">
                      {offre ? LABEL_OFFRE[offre] : "Gratuit"}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      </Apparition>

      <Apparition delai={0.25}>
      <section className="mt-10">
        <SectionTitre>Litiges résolus</SectionTitre>
        {litigesResolus.length === 0 ? (
          <p className={"mt-3 " + classeCarte("none") + " text-sm text-muted"}>
            Aucun litige résolu pour l&apos;instant.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {litigesResolus.map((l) => (
              <li key={l.id} className={classeCarte("atteste")}>
                {l.match?.tournament && (
                  <span className="font-texte tabular-nums text-mini text-muted uppercase">
                    {l.match.tournament.nom} · Tour {l.match.tour}
                  </span>
                )}
                <p className="mt-1 text-sm text-text">{l.motif}</p>
                <p className="mt-1 text-sm text-accent">
                  Résolu par {l.resolu_par?.pseudo ?? "un administrateur"} : {l.resolution}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      </Apparition>
      </div>
    </main>
  );
}
