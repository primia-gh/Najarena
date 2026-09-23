import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { arrondir, trouverPalier } from "@/lib/classement";
import BoutonLien from "@/components/design/BoutonLien";
import LibelleSection from "@/components/design/LibelleSection";
import NumeroFiligrane from "@/components/design/NumeroFiligrane";
import Icone from "@/components/design/Icone";
import Panneau from "@/components/design/Panneau";
import Apparition from "@/components/design/Apparition";
import OuvertureLogo from "@/components/vitrine/OuvertureLogo";
import BandeauDefilant from "@/components/vitrine/BandeauDefilant";
import { BoucleBracket, BoucleCompte, BoucleRating } from "@/components/vitrine/Boucles";
import { CarteCvDetail, CarteCvFlottante } from "@/components/vitrine/CartesCvExemple";
import AfficheTournoi, { type VarianteAffiche } from "@/components/vitrine/AfficheTournoi";
import ApercuClassement from "@/components/vitrine/ApercuClassement";
import { IllustrationEquipe, IllustrationRecherche } from "@/components/vitrine/IllustrationsPortes";
import styles from "@/components/vitrine/vitrine.module.css";

// Accueil — refonte « Venin » (design-system/najarena/pages/accueil.md,
// maquette najarena-design/maquettes/accueil.dc.html). Seules les sections 03
// (tournois) et 04 (classement) lisent la base, avec les mêmes requêtes que
// /lol et /lol/classement. Pas de compteur de trafic (pages/accueil.md).
// Textes corrigés par rapport à la maquette quand elle promettait ce que le
// site ne fait pas (anti-smurf, classement par rôle, mise à jour « après
// chaque match », recruteurs qui « consultent vraiment ») — CLAUDE.md §7.

// game_id=1 est LoL — seule ligne de `games` en V1 (même convention que
// /lol et /lol/classement).
async function chargerAccueil() {
  const supabase = await createClient();

  const [{ data: saison }, { data: paliersData }, { data: tournoisData }] = await Promise.all([
    supabase.from("seasons").select("id").eq("game_id", 1).eq("est_courante", true).maybeSingle(),
    supabase.from("tiers").select("nom, rating_min").eq("game_id", 1),
    supabase
      .from("tournaments")
      .select("slug, nom, format, capacite, region, debute_le")
      .eq("game_id", 1)
      .in("statut", ["ouvert", "checkin"])
      .order("debute_le", { ascending: true })
      .limit(3),
  ]);

  const classement = saison
    ? ((
        await supabase
          .from("ratings")
          .select("rating, profile:profiles(pseudo, slug, avatar_url)")
          .eq("game_id", 1)
          .eq("season_id", saison.id)
          .eq("est_classe", true)
          .order("rating", { ascending: false })
          .limit(10)
      ).data ?? [])
    : [];

  const paliers = (paliersData ?? []).map((p) => ({ nom: p.nom, ratingMin: p.rating_min }));

  return { classement, paliers, tournois: tournoisData ?? [] };
}

// Heure de Paris explicite : le serveur (Vercel) tourne en UTC.
const FORMAT_DATE_AFFICHE = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

/** « SAM. 27/09 · 21:00 » */
function dateAffiche(iso: string) {
  const p = Object.fromEntries(
    FORMAT_DATE_AFFICHE.formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  );
  return `${p.weekday} ${p.day}/${p.month} · ${p.hour}:${p.minute}`.toUpperCase();
}

const ETAPES = [
  {
    numero: "01",
    titre: "Lie ton compte",
    texte: "Saisis ton Riot ID et prouve qu'il est à toi en changeant ton icône de profil.",
    boucle: <BoucleCompte />,
  },
  {
    numero: "02",
    titre: "Joue tes matchs",
    texte: "Inscris-toi à un tournoi et joue. Le résultat est lu dans la donnée officielle du jeu.",
    boucle: <BoucleBracket />,
  },
  {
    numero: "03",
    titre: "Ton rating monte",
    texte: "Chaque victoire vérifiée fait progresser ton rating et ton CV e-sport.",
    boucle: <BoucleRating />,
  },
];

const POINTS_CV = [
  "Rating Glicko-2 et classement national",
  "Niveau de preuve affiché sur chaque match",
  "Historique complet et journal des points public",
  "Lien partageable avec les équipes",
];

const REASSURANCE = [
  { icone: "bouclier", texte: "Données officielles" },
  { icone: "joueur", texte: "Inscription gratuite" },
  { icone: "coche", texte: "Sans pay-to-win" },
] as const;

export default async function Home() {
  const { classement, paliers, tournois } = await chargerAccueil();

  return (
    <main className="bg-bg font-texte text-text">
      {/* ================= 1. OUVERTURE ================= */}
      <section className="relative isolate overflow-hidden px-gouttiere pt-32 pb-20 lg:flex lg:min-h-[860px] lg:items-center lg:pt-28 lg:pb-24">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_70%_40%,#161A15_0%,#0B0C0B_55%,#080908_100%)]"
        />
        <OuvertureLogo className="-z-10 top-14 -left-[10%] aspect-[1440/860] w-[140%] opacity-70 lg:inset-0 lg:aspect-auto lg:w-auto lg:opacity-100" />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 -z-10 h-60 bg-[linear-gradient(180deg,rgba(8,9,8,0),#080908)]"
        />

        <div className="mx-auto flex w-full max-w-contenu flex-col gap-16 lg:flex-row lg:items-center">
          <div className="flex max-w-[760px] flex-col gap-9">
            <p className="flex items-center gap-3 text-libelle font-medium text-muted uppercase">
              <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulsation rounded-full bg-accent" />
              Résultats vérifiés automatiquement
            </p>
            <h1 className="font-titre text-ouverture font-black tracking-[-1px] uppercase">
              Prouve
              <br />
              ton <span className="text-accent">niveau.</span>
            </h1>
            <p className="max-w-[520px] text-courant text-text-2">
              Joue des tournois, grimpe au classement et construis un CV e-sport vérifié, à montrer aux
              équipes comme aux recruteurs.
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-9 gap-y-4">
              <BoutonLien href="/inscription" taille="grande">
                Rejoindre Najarena
              </BoutonLien>
              <BoutonLien href="/lol/tournois" variante="secondaire" fleche={false}>
                Voir les tournois
              </BoutonLien>
            </div>
            <ul className="mt-5 flex flex-wrap gap-x-8 gap-y-3 border-t border-line pt-7 text-[13px] tracking-[1px] text-muted">
              {REASSURANCE.map((r) => (
                <li key={r.texte} className="flex items-center gap-2.5">
                  <Icone nom={r.icone} className="text-accent" />
                  {r.texte}
                </li>
              ))}
            </ul>
          </div>

          <CarteCvFlottante className="w-full max-w-[400px] lg:ml-auto lg:w-[360px] xl:w-[400px]" />
        </div>
      </section>

      <BandeauDefilant />

      {/* ================= 2. COMMENT ÇA MARCHE ================= */}
      <section className="relative isolate px-gouttiere py-section">
        <NumeroFiligrane numero="01" className="top-10 right-[4%]" />
        <div className="mx-auto flex max-w-contenu flex-col gap-[72px]">
          <Apparition className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end lg:gap-20">
            <div className="flex flex-col gap-5">
              <LibelleSection numero="01">Comment ça marche</LibelleSection>
              <h2 className="font-titre text-section font-black uppercase">
                Trois étapes.
                <br />
                Rien à déclarer.
              </h2>
            </div>
            <p className="max-w-[380px] text-lg leading-[1.6] text-muted">
              Pas de captures d&apos;écran, pas d&apos;arbitre à relancer. La donnée officielle du jeu fait foi.
            </p>
          </Apparition>
          <ol className="grid gap-14 lg:grid-cols-3 lg:gap-8 xl:gap-10">
            {ETAPES.map((e, i) => (
              <li key={e.numero}>
                <Apparition delai={i * 0.08} className="flex flex-col gap-7">
                  {e.boucle}
                  <div className="flex gap-[22px] border-t border-[rgba(245,245,244,0.1)] pt-6">
                    <span aria-hidden="true" className="font-titre text-xl font-extrabold text-accent">
                      {e.numero}
                    </span>
                    <div className="flex flex-col gap-2.5">
                      <h3 className="font-titre text-[30px] leading-none font-extrabold tracking-[1px] uppercase">
                        {e.titre}
                      </h3>
                      <p className="text-[17px] leading-[1.6] text-muted">{e.texte}</p>
                    </div>
                  </div>
                </Apparition>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ================= 3. LE CV E-SPORT ================= */}
      <section className="relative isolate bg-bg-alt px-gouttiere py-section">
        <NumeroFiligrane numero="02" className="top-10 left-[4%]" />
        <div className="mx-auto flex max-w-contenu flex-col items-center gap-16 lg:flex-row xl:gap-[100px]">
          <Apparition className="flex w-full flex-col gap-[30px] lg:w-[400px] lg:shrink-0 xl:w-[460px]">
            <LibelleSection numero="02">Le CV e-sport</LibelleSection>
            <h2 className="font-titre text-section font-black uppercase">
              Prouvé.
              <br />
              Pas déclaré.
            </h2>
            <p className="text-lg leading-[1.65] text-text-2">
              Chaque match joué sur Najarena alimente un profil vérifiable : rating, classement national,
              historique des matchs, journal des points. Le document que tu envoies quand une équipe te demande
              ce que tu vaux.
            </p>
            <ul className="flex flex-col">
              {POINTS_CV.map((p) => (
                <li key={p} className="flex items-center justify-between gap-4 border-b border-line py-4">
                  {p}
                  <Icone nom="coche" epaisseur={2} className="text-accent" />
                </li>
              ))}
            </ul>
            <BoutonLien
              href="/inscription"
              variante="secondaire"
              className="self-start text-accent decoration-accent"
            >
              Créer mon CV e-sport
            </BoutonLien>
          </Apparition>
          <Apparition delai={0.1} className="w-full min-w-0 flex-1">
            <CarteCvDetail />
          </Apparition>
        </div>
      </section>

      {/* ================= 4. TOURNOIS À VENIR ================= */}
      <section id="tournois" className="relative isolate px-gouttiere py-section">
        <NumeroFiligrane numero="03" className="top-10 right-[28%]" />
        <div className="mx-auto flex max-w-contenu flex-col gap-16">
          <Apparition className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="flex flex-col gap-5">
              <LibelleSection numero="03">Tournois à venir</LibelleSection>
              <h2 className="font-titre text-section font-black uppercase">Ton prochain match.</h2>
            </div>
            <BoutonLien href="/lol/tournois" variante="secondaire" className="self-start md:self-auto">
              Tous les tournois
            </BoutonLien>
          </Apparition>

          {tournois.length > 0 ? (
            <ul className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
              {tournois.map((t, i) => (
                <li key={t.slug}>
                  <Apparition delai={i * 0.08} className="flex flex-col gap-6">
                    <AfficheTournoi
                      nom={t.nom}
                      format={t.format}
                      date={dateAffiche(t.debute_le)}
                      variante={((i % 3) + 1) as VarianteAffiche}
                    />
                    <div className="flex justify-between gap-4 text-xs tracking-[3px] text-muted uppercase">
                      <span>LoL · {t.format}</span>
                      <span className="tabular-nums">{dateAffiche(t.debute_le)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-[rgba(245,245,244,0.1)] pt-5">
                      <span className="text-sm text-muted">
                        {t.capacite} places · {t.region}
                      </span>
                      <Link
                        href={`/lol/tournois/${t.slug}`}
                        className="inline-flex min-h-11 items-center text-sm font-semibold tracking-[2px] text-accent uppercase transition-colors duration-200 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                      >
                        S&apos;inscrire<span aria-hidden="true">&nbsp;→</span>
                        <span className="sr-only"> au tournoi {t.nom}</span>
                      </Link>
                    </div>
                  </Apparition>
                </li>
              ))}
            </ul>
          ) : (
            <Panneau reperes className="flex flex-col items-start gap-5 px-8 py-12 sm:px-12">
              <p className="font-titre text-sous-titre font-extrabold uppercase">Aucun tournoi ouvert pour l&apos;instant.</p>
              <p className="max-w-[560px] text-muted">
                Les prochains créneaux s&apos;ouvrent ici dès qu&apos;un organisateur les publie. En attendant, un
                tournoi d&apos;exemple montre un bracket complet, verdict par verdict.
              </p>
              <div className="flex flex-wrap gap-x-9 gap-y-2">
                <BoutonLien href="/lol/tournois/demo" variante="secondaire">
                  Voir le tournoi d&apos;exemple
                </BoutonLien>
                <BoutonLien href="/organiser/nouveau" variante="secondaire">
                  Organiser un tournoi
                </BoutonLien>
              </div>
            </Panneau>
          )}
        </div>
      </section>

      {/* ================= 5. APERÇU DU CLASSEMENT ================= */}
      <section id="classement" className="relative isolate bg-bg-alt px-gouttiere py-section">
        <NumeroFiligrane numero="04" className="bottom-5 left-[4%]" />
        <div className="mx-auto flex max-w-contenu flex-col gap-16 lg:flex-row xl:gap-[100px]">
          <Apparition className="flex flex-col gap-7 lg:w-[360px] lg:shrink-0 xl:w-[400px]">
            <LibelleSection numero="04">Classement</LibelleSection>
            <h2 className="font-titre text-section font-black uppercase">
              Vise le
              <br />
              top 10.
            </h2>
            <p className="text-lg leading-[1.65] text-text-2">
              Un classement national calculé en Glicko-2, mis à jour à la clôture de chaque tournoi. Public,
              vérifiable, jamais remis à zéro.
            </p>
            <BoutonLien href="/lol/classement" variante="secondaire" className="self-start">
              Classement complet
            </BoutonLien>
          </Apparition>

          <Apparition delai={0.1} className="min-w-0 flex-1">
            {classement.length > 0 ? (
              <ApercuClassement
                legende="Top 10 du classement League of Legends, saison en cours"
                lignes={classement.map((c) => ({
                  pseudo: c.profile?.pseudo ?? "Joueur",
                  slug: c.profile?.slug ?? null,
                  avatarUrl: c.profile?.avatar_url ?? null,
                  palier: trouverPalier(c.rating, paliers)?.nom ?? null,
                  rating: arrondir(c.rating),
                }))}
              />
            ) : (
              <Panneau reperes className="flex flex-col items-start gap-5 px-8 py-12 sm:px-12">
                <p className="font-titre text-sous-titre font-extrabold uppercase">Le top 10 reste à écrire.</p>
                <p className="max-w-[560px] text-muted">
                  Personne n&apos;est encore classé cette saison : il faut une dizaine de matchs vérifiés pour que
                  le rating soit assez fiable (RD ≤ 150) et entrer au classement.
                </p>
                <BoutonLien href="/lol/tournois" variante="secondaire">
                  Jouer mon premier tournoi
                </BoutonLien>
              </Panneau>
            )}
          </Apparition>
        </div>
      </section>

      {/* ================= 6. DEUX PORTES D'ENTRÉE ================= */}
      <section className="px-gouttiere py-section">
        <div className="mx-auto grid max-w-contenu gap-16 md:grid-cols-2 md:gap-10">
          <Apparition className="flex flex-col gap-8">
            <IllustrationEquipe />
            <div className="flex flex-col gap-4">
              <LibelleSection>Pour les équipes</LibelleSection>
              <h2 className="font-titre text-sous-titre leading-[0.95] font-black uppercase">Recrute sur des preuves.</h2>
              <p className="max-w-[500px] text-[17px] leading-[1.6] text-muted">
                Crée ton équipe, publie ton annonce et trouve le joueur qui manque à ton roster parmi des profils
                classés et vérifiés.
              </p>
              <BoutonLien href="/equipe/nouvelle" variante="secondaire" className="mt-2 self-start">
                Créer mon équipe
              </BoutonLien>
            </div>
          </Apparition>
          <Apparition delai={0.1} className="flex flex-col gap-8">
            <IllustrationRecherche />
            <div className="flex flex-col gap-4">
              <LibelleSection>Pour les recruteurs</LibelleSection>
              <h2 className="font-titre text-sous-titre leading-[0.95] font-black uppercase">
                Repère les talents en premier.
              </h2>
              <p className="max-w-[500px] text-[17px] leading-[1.6] text-muted">
                Recherche de joueurs par niveau, liste de suivi, CV vérifiés et partageables : de quoi décider sur
                des preuves.
              </p>
              <BoutonLien href="/tarifs" variante="secondaire" className="mt-2 self-start">
                Voir les offres
              </BoutonLien>
            </div>
          </Apparition>
        </div>
      </section>

      {/* ================= 7. APPEL FINAL ================= */}
      <section
        id="rejoindre"
        className="relative isolate flex flex-col items-center gap-9 overflow-hidden border-t border-[rgba(245,245,244,0.06)] px-gouttiere py-[clamp(6rem,11vw,10rem)] text-center"
      >
        <div aria-hidden="true" className="fond-ecailles absolute inset-0 -z-10" />
        <div aria-hidden="true" className="absolute -top-[260px] left-1/2 -z-10 w-[800px] max-w-[180vw] -translate-x-1/2">
          <div className={`aspect-square rounded-full ${styles.haloFinal}`} />
        </div>
        <Image
          src="/brand/najarena-logo-blanc.svg"
          alt=""
          width={126}
          height={170}
          unoptimized
          className="h-[clamp(120px,12vw,170px)] w-auto drop-shadow-[0_0_40px_rgba(182,255,59,0.35)]"
        />
        <h2 className="font-titre text-[clamp(4rem,9.7vw,8.75rem)] leading-[0.88] font-black uppercase">
          L&apos;arène
          <br />
          t&apos;attend.
        </h2>
        <p className="text-[19px] text-text-2">Inscription gratuite. Pas de pay-to-win. Seul ton niveau compte.</p>
        <BoutonLien href="/inscription" taille="grande" className="mt-3">
          Rejoindre Najarena
        </BoutonLien>
      </section>
    </main>
  );
}
