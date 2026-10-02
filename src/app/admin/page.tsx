import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { leverSuspension, resoudreLitigeAdmin, suspendreCompte } from "@/lib/admin-actions";
import { attribuerOffreAdmin } from "@/lib/offres-actions";
import { LABEL_OFFRE, chargerOffres, type Offre } from "@/lib/offres";
import { formaterDate } from "@/lib/tournois";
import { detecterSignaux } from "@/lib/signaux";
import { classeCarte } from "@/lib/ui";
import Bouton from "@/components/ui/Bouton";
import BoutonConfirmation from "@/components/ui/BoutonConfirmation";
import SectionTitre from "@/components/ui/SectionTitre";
import EtatVide from "@/components/ui/EtatVide";
import IllustrationEffectifVide from "@/components/ui/IllustrationEffectifVide";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";

export const metadata: Metadata = {
  title: "Administration — Najarena",
  robots: { index: false, follow: false },
};

interface AdminPageProps {
  searchParams: Promise<{ erreur?: string; message?: string }>;
}

// Signaux à examiner sur 30 jours (audit N11) : lecture des données
// publiques, calcul dans src/lib/signaux.ts. Jamais d'action automatique.
async function chargerSignaux(supabase: Awaited<ReturnType<typeof createClient>>) {
  const depuis = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ data: tournoisRecents }, { data: variationsRecentes }] = await Promise.all([
    supabase
      .from("tournaments")
      .select("id, nom, slug, organisateur_id, statut")
      .eq("nature", "tournoi")
      .gte("debute_le", depuis),
    supabase
      .from("rating_events")
      .select("profile_id, tournament_id, rating_avant, rating_apres")
      .eq("motif", "tournoi")
      .gte("cree_le", depuis),
  ]);
  const idsTournois = (tournoisRecents ?? []).map((t) => t.id);
  const { data: matchsRecents } =
    idsTournois.length > 0
      ? await supabase
          .from("matches")
          .select("tournament_id, match_participants(profile_id, est_gagnant), match_verdicts(niveau, est_definitif)")
          .in("tournament_id", idsTournois)
      : { data: [] };
  const signaux = detecterSignaux(
    (matchsRecents ?? []).map((m) => ({
      tournoiId: m.tournament_id,
      joueurs: m.match_participants.map((p) => ({ id: p.profile_id, gagnant: p.est_gagnant })),
      verifie: m.match_verdicts.some((v) => v.est_definitif && v.niveau !== "manuel"),
    })),
    (tournoisRecents ?? []).map((t) => ({ id: t.id, organisateurId: t.organisateur_id, statut: t.statut })),
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
  ]);

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
      signaux.petitsTournois.length ===
    0;

  const litiges = litigesData ?? [];
  const litigesOuverts = litiges.filter((l) => !l.resolution);
  const litigesResolus = litiges.filter((l) => l.resolution);
  const comptes = derniersInscrits ?? [];
  const suspensions = suspensionsData ?? [];
  const offresParCompte = await chargerOffres(supabase, comptes.map((c) => c.id));

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative px-grille">
      <Apparition>
      <Link
        href="/moi"
        className="inline-flex min-h-11 items-center font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
      >
        ← Mon compte
      </Link>

      <h1 className="mt-6 font-titre uppercase text-section font-black tracking-[1px] text-text hyphens-auto [overflow-wrap:anywhere]">
        Administration
      </h1>
      <p className="mt-1 font-texte tabular-nums text-[0.72rem] text-muted">Modération · Litiges</p>

      {erreur && (
        <p className={"mt-6 " + classeCarte("sceau") + " text-sm text-danger"}>{erreur}</p>
      )}
      {message && (
        <p className={"mt-6 " + classeCarte("atteste") + " text-sm text-accent"}>{message}</p>
      )}
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

      <Apparition delai={0.14}>
      <section className="mt-10" aria-labelledby="titre-signaux">
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
                        <span className="text-accent">Vérifié</span>
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

      <Apparition delai={0.2}>
      <section className="mt-10">
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
              </li>
            ))}
          </ul>
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
